import 'dotenv/config';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadAndValidateManifest, getTierForTool } from './toolRegistry.js';
import { authMiddleware, identityMiddleware, checkApprovalGuard } from './security.js';
import { executeToolViaGateway } from './proxy.js';
import { log } from './logger.js';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const PORT = parseInt(process.env.PORT || '3100', 10);
const MCP_PATH = process.env.MCP_PATH || '/mcp';

// --- Load and validate manifest ---
const { manifest, tools } = loadAndValidateManifest();
log('info', `Loaded ${tools.length} tools from manifest (version ${manifest.manifest_version}, updated ${manifest.last_updated})`);

// --- Create MCP Server ---
const mcpServer = new McpServer({
    name: 'mm2-mcp-server',
    version: '1.0.0',
});

// Register all tools dynamically from manifest
for (const tool of tools) {
    // Build zod schema shape for parameters validation
    // We use a passthrough object schema since the actual validation 
    // happens at the Tool Gateway level
    const shape: Record<string, any> = {};
    if (tool.inputSchema.properties) {
        for (const [key, prop] of Object.entries(tool.inputSchema.properties as Record<string, any>)) {
            const required = tool.inputSchema.required?.includes(key);
            let zodType: z.ZodTypeAny;

            switch (prop.type) {
                case 'number':
                case 'integer':
                    zodType = z.number();
                    break;
                case 'boolean':
                    zodType = z.boolean();
                    break;
                case 'array':
                    zodType = z.array(z.any());
                    break;
                default:
                    zodType = z.string();
            }

            shape[key] = required ? zodType : zodType.optional();
        }
    }

    mcpServer.tool(
        tool.name,
        tool.description,
        shape,
        async (args, extra) => {
            const requestId = uuidv4();
            const startTime = Date.now();

            try {
                // Get tier for approval check
                const tier = tool.tier;

                // Extract headers from the transport context if available
                // For now, approval checks will be done via the proxy headers
                const result = await executeToolViaGateway(tool.name, args as Record<string, any>, {
                    userId: 'mcp-user', // Will be overridden by transport-level identity
                    requestId,
                    approvalHeader: tier === 2 ? undefined : undefined,
                });

                const latencyMs = Date.now() - startTime;
                log('info', `Tool executed: ${tool.name}`, {
                    request_id: requestId,
                    tool_name: tool.name,
                    tier,
                    latency_ms: latencyMs,
                    status_code: result.statusCode,
                });

                if (result.ok) {
                    return {
                        content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
                    };
                } else {
                    return {
                        content: [{ type: 'text' as const, text: JSON.stringify(result.error, null, 2) }],
                        isError: true,
                    };
                }
            } catch (err: any) {
                log('error', `Tool execution failed: ${tool.name} — ${err.message}`, {
                    request_id: requestId,
                    tool_name: tool.name,
                });
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify({ code: 'INTERNAL_ERROR', message: err.message }) }],
                    isError: true,
                };
            }
        }
    );
}

// --- Express App ---
const app = express();

// Health check
app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Version info
app.get('/version', (_req, res) => {
    res.json({
        app: 'mm2-mcp-server',
        manifest_version: manifest.manifest_version,
        manifest_last_updated: manifest.last_updated,
        tools_count: tools.length,
    });
});

// MCP Streamable HTTP transport
// Auth + Identity middleware applied to MCP path
app.use(MCP_PATH, authMiddleware, identityMiddleware);

// Store transports for session management
const transports = new Map<string, StreamableHTTPServerTransport>();

// Handle POST requests for client-to-server messages
app.post(MCP_PATH, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
        // Existing session
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
    } else if (!sessionId) {
        // New session — create transport
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => uuidv4(),
        });

        transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid) transports.delete(sid);
        };

        await mcpServer.connect(transport);

        if (transport.sessionId) {
            transports.set(transport.sessionId, transport);
        }

        await transport.handleRequest(req, res, req.body);
    } else {
        // Invalid session
        res.status(400).json({ error: 'Invalid or expired session' });
    }
});

// Handle GET requests for server-to-client notifications (SSE)
app.get(MCP_PATH, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
        res.status(400).json({ error: 'Invalid or missing session' });
        return;
    }
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
});

// Handle DELETE requests for session termination
app.delete(MCP_PATH, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
        res.status(400).json({ error: 'Invalid or missing session' });
        return;
    }
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
    transports.delete(sessionId);
});

// Start server
app.listen(PORT, () => {
    log('info', `mm2 MCP Server running on http://localhost:${PORT}`);
    log('info', `MCP endpoint: http://localhost:${PORT}${MCP_PATH}`);
    log('info', `Health check: http://localhost:${PORT}/healthz`);
    log('info', `Registered ${tools.length} tools (Tier 0: ${tools.filter(t => t.tier === 0).length}, Tier 1: ${tools.filter(t => t.tier === 1).length}, Tier 2: ${tools.filter(t => t.tier === 2).length})`);
});
