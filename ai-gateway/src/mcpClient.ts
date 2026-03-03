/**
 * MCP Client — Direct HTTP proxy to MCP Server using JSON-RPC over Streamable HTTP.
 * Tracks mcp-session-id header for session continuity.
 */
import { v4 as uuidv4 } from 'uuid';
import { log } from './logger.js';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3100';
const MCP_BEARER = process.env.MCP_BEARER || '';
const MCP_PATH = '/mcp';

interface MCPTool {
    name: string;
    description: string;
    inputSchema: Record<string, any>;
}

let cachedTools: MCPTool[] = [];
let mcpSessionId: string | null = null;

async function mcpRequest(method: string, params: any = {}, isNotification = false): Promise<any> {
    const url = `${MCP_SERVER_URL}${MCP_PATH}`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${MCP_BEARER}`,
        'x-user-id': 'ai-gateway',
    };

    // Include session ID if we have one
    if (mcpSessionId) {
        headers['mcp-session-id'] = mcpSessionId;
    }

    const body: any = {
        jsonrpc: '2.0',
        method,
    };

    if (!isNotification) {
        body.id = uuidv4();
    }

    if (Object.keys(params).length > 0) {
        body.params = params;
    }

    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    // Capture session ID from response headers
    const sessionHeader = response.headers.get('mcp-session-id');
    if (sessionHeader) {
        mcpSessionId = sessionHeader;
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`MCP ${response.status}: ${text.slice(0, 300)}`);
    }

    // Notifications don't expect a response body
    if (isNotification) {
        return null;
    }

    const contentType = response.headers.get('content-type') || '';

    // Handle SSE (text/event-stream)
    if (contentType.includes('text/event-stream')) {
        const text = await response.text();
        const lines = text.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (line.startsWith('data: ')) {
                try {
                    const parsed = JSON.parse(line.slice(6));
                    if (parsed.result !== undefined) return parsed.result;
                    if (parsed.error) throw new Error(parsed.error.message || JSON.stringify(parsed.error));
                } catch (e: any) {
                    if (e.message?.startsWith('MCP')) throw e;
                }
            }
        }
        throw new Error('No JSON-RPC result in SSE response');
    }

    // Regular JSON
    const result = await response.json();

    if (Array.isArray(result)) {
        const match = result.find((r: any) => r.id === body.id);
        if (match?.error) throw new Error(match.error.message || JSON.stringify(match.error));
        return match?.result;
    }

    if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
    return result.result;
}

export async function initMCPClient(): Promise<void> {
    mcpSessionId = null; // Reset session

    const initResult = await mcpRequest('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'mm2-ai-gateway', version: '1.0.0' },
    });

    log('info', `MCP initialized: server=${JSON.stringify(initResult?.serverInfo || {})}, sessionId=${mcpSessionId}`);

    // Send initialized notification (uses the session ID captured above)
    try {
        await mcpRequest('notifications/initialized', {}, true);
    } catch { /* notification */ }

    await refreshTools();
}

export async function refreshTools(): Promise<MCPTool[]> {
    const result = await mcpRequest('tools/list', {});
    cachedTools = (result.tools || []).map((t: any) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || { type: 'object', properties: {} },
    }));
    log('info', `MCP tools loaded: ${cachedTools.length} tools`);
    return cachedTools;
}

export function getTools(): MCPTool[] { return cachedTools; }
export function isToolAllowed(name: string): boolean { return cachedTools.some(t => t.name === name); }

export interface ToolCallResult {
    ok: boolean;
    data?: any;
    error?: { code: string; message: string };
}

export async function callTool(
    toolName: string,
    args: Record<string, any>,
    headers?: { traceId?: string; approval?: string }
): Promise<ToolCallResult> {
    if (!isToolAllowed(toolName)) {
        return { ok: false, error: { code: 'TOOL_NOT_FOUND', message: `Tool '${toolName}' not in allowlist` } };
    }

    const startTime = Date.now();
    try {
        log('info', `MCP tool call: ${toolName}`, { tool_name: toolName, trace_id: headers?.traceId });

        // Inject approval into arguments so MCP server can forward it to tool gateway
        const callArgs = { ...args };
        if (headers?.approval) {
            callArgs._approval = headers.approval;
        }

        const result = await mcpRequest('tools/call', { name: toolName, arguments: callArgs });
        const latencyMs = Date.now() - startTime;
        log('info', `MCP tool done: ${toolName}`, { tool_name: toolName, latency_ms: latencyMs, trace_id: headers?.traceId });

        const textContent = (result.content || [])
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('');

        let parsed: any;
        try { parsed = JSON.parse(textContent); } catch { parsed = textContent; }

        if (result.isError) {
            if (parsed?.code === 'APPROVAL_REQUIRED') {
                return { ok: false, error: { code: 'APPROVAL_REQUIRED', message: parsed.message || 'Approval required' } };
            }
            return { ok: false, error: { code: parsed?.code || 'TOOL_EXECUTION_ERROR', message: parsed?.message || textContent } };
        }

        return { ok: true, data: parsed };
    } catch (err: any) {
        log('error', `MCP tool failed: ${toolName} — ${err.message}`, { tool_name: toolName, latency_ms: Date.now() - startTime, trace_id: headers?.traceId });
        return { ok: false, error: { code: 'MCP_CONNECTION_ERROR', message: err.message } };
    }
}
