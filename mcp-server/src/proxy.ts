import { v4 as uuidv4 } from 'uuid';
import { log } from './logger.js';

const MM_API_BASE_URL = process.env.MM_API_BASE_URL || 'http://localhost:3200';
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10);

export interface ProxyContext {
    userId: string;
    idempotencyKey?: string;
    requestId?: string;
    approvalHeader?: string;
}

export async function executeToolViaGateway(
    toolName: string,
    args: Record<string, any>,
    context: ProxyContext
): Promise<{ ok: boolean; data?: any; error?: any; statusCode: number }> {
    const requestId = context.requestId || uuidv4();
    const url = `${MM_API_BASE_URL}/api/v1/${toolName}`;
    const startTime = Date.now();

    const headers: Record<string, string> = {
        'content-type': 'application/json',
        'x-user-id': context.userId,
        'x-request-id': requestId,
    };

    if (context.idempotencyKey) {
        headers['idempotency-key'] = context.idempotencyKey;
    }

    if (context.approvalHeader) {
        headers['x-mm-approval'] = context.approvalHeader;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // Determine HTTP method and final URL/body
    let method = 'POST';
    let finalUrl = url;
    let finalBody: string | undefined = JSON.stringify(args);

    if (toolName.startsWith('get_') || toolName.startsWith('search_') || toolName === 'has_password') {
        method = 'GET';
        finalBody = undefined;
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(args)) {
            if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
            }
        }
        const qs = searchParams.toString();
        if (qs) finalUrl += `?${qs}`;
    } else if (toolName.startsWith('delete_') || toolName.startsWith('clear_')) {
        // Note: bulk_delete_transactions is POST in our routes, but delete_account is DELETE
        if (toolName === 'delete_account' || toolName === 'delete_category' ||
            toolName === 'delete_subcategory' || toolName === 'delete_transaction' ||
            toolName === 'delete_recurring_rule' || toolName === 'delete_installment_plan' ||
            toolName === 'delete_budget' || toolName === 'clear_month_budgets') {
            method = 'DELETE';
        }
    }

    try {
        log('info', `Proxying tool call: ${toolName} [${method}]`, {
            request_id: requestId,
            tool_name: toolName,
            args,
        });

        const response = await fetch(finalUrl, {
            method,
            headers,
            body: finalBody,
            signal: controller.signal,
        });

        const latencyMs = Date.now() - startTime;
        const body = await response.json().catch(() => ({}));

        log('info', `Tool Gateway responded: ${toolName}`, {
            request_id: requestId,
            tool_name: toolName,
            status_code: response.status,
            latency_ms: latencyMs,
        });

        if (response.ok) {
            return { ok: true, data: body, statusCode: response.status };
        } else {
            return {
                ok: false,
                error: body.error || { code: 'GATEWAY_ERROR', message: `Tool Gateway returned ${response.status}` },
                statusCode: response.status,
            };
        }
    } catch (err: any) {
        const latencyMs = Date.now() - startTime;

        if (err.name === 'AbortError') {
            log('error', `Tool Gateway timeout: ${toolName}`, {
                request_id: requestId,
                tool_name: toolName,
                latency_ms: latencyMs,
            });
            return {
                ok: false,
                error: { code: 'TIMEOUT', message: `Tool Gateway request timed out after ${REQUEST_TIMEOUT_MS}ms` },
                statusCode: 504,
            };
        }

        log('error', `Tool Gateway connection error: ${toolName} — ${err.message}`, {
            request_id: requestId,
            tool_name: toolName,
            latency_ms: latencyMs,
        });
        return {
            ok: false,
            error: { code: 'CONNECTION_ERROR', message: `Failed to connect to Tool Gateway: ${err.message}` },
            statusCode: 502,
        };
    } finally {
        clearTimeout(timeout);
    }
}
