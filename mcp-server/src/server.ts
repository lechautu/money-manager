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

// --- Factory: create a new McpServer with all tools registered ---
function createMcpServerInstance(): McpServer {
    const server = new McpServer({
        name: 'mm2-mcp-server',
        version: '1.0.0',
    });

    for (const tool of tools) {
        const shape: Record<string, any> = {};
        if (tool.inputSchema.properties) {
            for (const [key, prop] of Object.entries(tool.inputSchema.properties as Record<string, any>)) {
                const required = tool.inputSchema.required?.includes(key);
                let zodType: z.ZodTypeAny;

                const createZodType = (p: any): z.ZodTypeAny => {
                    if (p.enum) {
                        if (p.type === 'string') {
                            return z.enum(p.enum as [string, ...string[]]);
                        }
                        // For numbers, we can use z.union or z.literal
                        const literals = p.enum.map((v: any) => z.literal(v));
                        if (literals.length === 1) return literals[0];
                        return z.union([literals[0], literals[1], ...literals.slice(2)]);
                    }

                    switch (p.type) {
                        case 'number':
                        case 'integer':
                            return z.number();
                        case 'boolean':
                            return z.boolean();
                        case 'array':
                            if (p.items) {
                                return z.array(createZodType(p.items));
                            }
                            return z.array(z.any());
                        case 'object':
                            if (p.properties) {
                                const subShape: Record<string, any> = {};
                                for (const [k, v] of Object.entries(p.properties)) {
                                    const isReq = p.required?.includes(k);
                                    let zType = createZodType(v);
                                    subShape[k] = isReq ? zType : zType.optional();
                                }
                                return z.object(subShape);
                            }
                            return z.record(z.any());
                        case 'string':
                        default:
                            return z.string();
                    }
                };

                zodType = createZodType(prop);
                shape[key] = required ? zodType : zodType.optional();
            }
        }

        server.tool(
            tool.name,
            tool.description,
            shape,
            async (args, extra) => {
                const requestId = uuidv4();
                const startTime = Date.now();

                try {
                    const tier = tool.tier;
                    // Extract _approval from args (injected by AI gateway for auto-approve)
                    const toolArgs = { ...(args as Record<string, any>) };
                    const approvalHeader = toolArgs._approval as string | undefined;
                    delete toolArgs._approval;

                    const result = await executeToolViaGateway(tool.name, toolArgs, {
                        userId: 'mcp-user',
                        requestId,
                        approvalHeader,
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
                    log('error', `Tool execution failed: ${tool.name} â€” ${err.message}`, {
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

    return server;
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
        // New session â€” create a fresh McpServer + transport pair
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => uuidv4(),
        });

        transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid) transports.delete(sid);
        };

        // Create a new McpServer instance for this session
        const sessionServer = createMcpServerInstance();
        await sessionServer.connect(transport);

        // handleRequest processes the initialize message and assigns sessionId
        await transport.handleRequest(req, res, req.body);

        // Store AFTER handleRequest so transport.sessionId is populated
        if (transport.sessionId) {
            transports.set(transport.sessionId, transport);
        }
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


