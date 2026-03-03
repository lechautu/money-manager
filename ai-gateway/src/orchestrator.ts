import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { log } from './logger.js';
import { getTools, callTool, isToolAllowed } from './mcpClient.js';
import { chatCompletion, convertToolsToOpenAI } from './llmProvider.js';
// approvalManager no longer used — AI confirms via chat instead
import type { ChatMessage, Session } from './sessionStore.js';
import { trimMessages, updateSession } from './sessionStore.js';

const MAX_TOOL_CALLS = parseInt(process.env.MAX_TOOL_CALLS_PER_TURN || '8', 10);
const MAX_WALL_TIME = parseInt(process.env.MAX_TURN_WALL_TIME_MS || '25000', 10);

function buildSystemPrompt(ctx: { locale?: string; timezone?: string; currency?: string }): string {
    const locale = ctx.locale || 'en-US';
    const tz = ctx.timezone || 'Asia/Ho_Chi_Minh';
    const currency = ctx.currency || 'VND';
    const today = new Date().toLocaleDateString(locale, { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });

    return `You are the financial assistant for the Money Manager 2 app.

## Principles
- Locale: ${locale}, Timezone: ${tz}, Currency: ${currency}, Today: ${today}
- Answer concisely, accurately, and friendly.
- Use tools to manipulate data. Do not make up accounts/categories/payees — always use search/get tools.
- When ambiguous (multiple results), list options for the user to choose. DO NOT guess the target.
- **CRITICAL: For destructive/sensitive actions (delete, bulk delete, import/restore data, clear), you MUST ask the user for explicit confirmation BEFORE calling the tool.** Describe what will happen and ask "Are you sure?" or similar. Only call the tool after the user confirms with "yes", "ok", "confirm", etc.
- Format currency amounts according to locale (e.g. 150,000).`;
}

/**
 * Ensures message history is valid for OpenAI.
 * Every assistant message with toolCalls MUST be immediately followed by tool responses for ALL those IDs.
 * If a turn is unfinished and not at the very end, it is repaired by stripping the toolCalls.
 */
function sanitizeHistory(messages: ChatMessage[]): ChatMessage[] {
    const sanitized: ChatMessage[] = [];
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];

        if (msg.role === 'assistant' && msg.toolCalls?.length) {
            const callIds = new Set(msg.toolCalls.map(tc => tc.id));
            const responses = new Map<string, ChatMessage>();

            // Look ahead for responses
            let nextNonToolIdx = i + 1;
            while (nextNonToolIdx < messages.length && messages[nextNonToolIdx].role === 'tool') {
                const toolMsg = messages[nextNonToolIdx];
                if (toolMsg.toolCallId && callIds.has(toolMsg.toolCallId)) {
                    responses.set(toolMsg.toolCallId, toolMsg);
                }
                nextNonToolIdx++;
            }

            const allAnswered = responses.size === callIds.size;
            const isEndOfHistory = nextNonToolIdx === messages.length;

            if (allAnswered) {
                // Valid turn
                sanitized.push(msg);
                // Add all tool responses we found
                for (let j = i + 1; j < nextNonToolIdx; j++) {
                    sanitized.push(messages[j]);
                }
                i = nextNonToolIdx - 1;
            } else if (isEndOfHistory) {
                // Unfinished turn at the end (e.g. waiting for approval/execution)
                // We keep it to process it in the loop
                sanitized.push(msg);
                for (let j = i + 1; j < nextNonToolIdx; j++) {
                    sanitized.push(messages[j]);
                }
                i = nextNonToolIdx - 1;
            } else {
                // Broken turn in middle of history
                log('warn', `Sanitizing broken history turn at index ${i}. Missing responses for: ${[...callIds].filter(id => !responses.has(id)).join(', ')}`);
                const repaired = { ...msg };
                delete repaired.toolCalls;
                if (!repaired.content) repaired.content = "... (interrupted)";
                sanitized.push(repaired);
                // Skip the partial tool messages to avoid dangling 'tool' roles
                i = nextNonToolIdx - 1;
            }
        } else if (msg.role === 'tool') {
            // Dangling tool message (no assistant parent found above)
            log('warn', `Removing dangling tool message at index ${i}`);
            continue;
        } else {
            sanitized.push(msg);
        }
    }
    return sanitized;
}

export interface OrchestratorResult {
    assistantMessage: string | null;
    ui: { options?: Array<{ id: string; label: string }>; actionPreview?: { title: string; items: Array<{ id: string; label: string }> } };
    requiresApproval: boolean;
    approval?: { approvalToken: string; expiresAt: string; actionType: string; preview: any };
    actions: Array<{ toolName: string; success: boolean; data?: any; error?: any }>;
    trace: { traceId: string; toolCalls: Array<{ name: string; success: boolean; latencyMs?: number }>; totalLatencyMs: number };
}

export async function runOrchestrator(
    session: Session,
    userMessage: string | null,
    ctx: { locale?: string; timezone?: string; currency?: string } = {},
    opts: { traceId?: string; approvalHeader?: string } = {}
): Promise<OrchestratorResult> {
    const traceId = opts.traceId || `tr_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const t0 = Date.now();
    const toolTrace: Array<{ name: string; success: boolean; latencyMs?: number }> = [];
    const actions: OrchestratorResult['actions'] = [];
    let toolCallCount = 0;

    // System prompt on first message
    if (session.messages.length === 0) {
        session.messages.push({ role: 'system', content: buildSystemPrompt(ctx) });
    }

    // Add user message
    if (userMessage) {
        session.messages.push({ role: 'user', content: userMessage });
    }

    const mcpTools = getTools();
    const openaiTools = convertToolsToOpenAI(mcpTools);

    // --- Loop ---
    while (true) {
        const turnT0 = Date.now();
        // Budget checks
        if (Date.now() - t0 > MAX_WALL_TIME) {
            log('warn', 'Orchestrator timeout', { trace_id: traceId, session_id: session.id, elapsed: Date.now() - t0 });
            return mkResult('Sorry, processing took too long. Please try again.', { actions, toolTrace, traceId, t0 });
        }
        if (toolCallCount >= MAX_TOOL_CALLS) {
            return mkResult('Action limit reached. Please send your request again.', { actions, toolTrace, traceId, t0 });
        }

        // Sanitize and Trim
        session.messages = sanitizeHistory(session.messages);
        const trimmed = trimMessages(session.messages, 40);

        const lastMsg = trimmed[trimmed.length - 1];

        // Resume or Call LLM
        let llm: { content: string | null; toolCalls: Array<{ id: string; name: string; arguments: string }> };

        if (lastMsg?.role === 'assistant' && lastMsg.toolCalls?.length) {
            const existingToolResponses = new Set(
                trimmed.filter(m => m.role === 'tool' && m.toolCallId).map(m => m.toolCallId)
            );
            const missingToolCalls = lastMsg.toolCalls.filter(tc => !existingToolResponses.has(tc.id));

            if (missingToolCalls.length > 0) {
                llm = { content: lastMsg.content, toolCalls: missingToolCalls };
                log('info', `Resuming ${missingToolCalls.length} tool calls`, { trace_id: traceId });
            } else {
                updateSession(session.id, { state: 'TOOL_CALLING' });
                llm = await chatCompletion(trimmed, openaiTools, { traceId });
            }
        } else {
            updateSession(session.id, { state: 'TOOL_CALLING' });
            llm = await chatCompletion(trimmed, openaiTools, { traceId });
        }

        // 1. Final text response
        if (llm.toolCalls.length === 0) {
            const msg = llm.content || '';
            session.messages.push({ role: 'assistant', content: msg });
            updateSession(session.id, { state: 'DONE', messages: session.messages });
            const totalLatencyMs = Date.now() - t0;
            log('info', 'Orchestrator turn complete', { trace_id: traceId, total_ms: totalLatencyMs, turns: Math.floor(toolCallCount / 5) + 1 });
            return mkResult(msg, { actions, toolTrace, traceId, t0 });
        }

        // 2. Process tool calls
        if (session.messages[session.messages.length - 1] !== lastMsg || lastMsg?.role !== 'assistant') {
            session.messages.push({ role: 'assistant', content: llm.content, toolCalls: llm.toolCalls });
        }

        for (const tc of llm.toolCalls) {
            toolCallCount++;
            const tcT0 = Date.now();

            if (!isToolAllowed(tc.name)) {
                const err = JSON.stringify({ error: `Tool '${tc.name}' not found` });
                session.messages.push({ role: 'tool', content: err, toolCallId: tc.id });
                toolTrace.push({ name: tc.name, success: false, latencyMs: Date.now() - tcT0 });
                continue;
            }

            let args: Record<string, any>;
            try { args = JSON.parse(tc.arguments); } catch {
                const err = JSON.stringify({ error: 'Invalid JSON arguments' });
                session.messages.push({ role: 'tool', content: err, toolCallId: tc.id });
                toolTrace.push({ name: tc.name, success: false, latencyMs: Date.now() - tcT0 });
                continue;
            }

            const result = await callTool(tc.name, args, { traceId, approval: opts.approvalHeader });
            const tcLatency = Date.now() - tcT0;

            const content = JSON.stringify(result.ok ? result.data : result.error);
            session.messages.push({ role: 'tool', content, toolCallId: tc.id });
            toolTrace.push({ name: tc.name, success: result.ok, latencyMs: tcLatency });
            actions.push({ toolName: tc.name, success: result.ok, data: result.ok ? result.data : undefined, error: result.ok ? undefined : result.error });
        }

        updateSession(session.id, { messages: session.messages });
        log('info', `Orchestrator turn shift: ${Date.now() - turnT0}ms`, { trace_id: traceId });
    }
}

function mkResult(msg: string, o: { actions: OrchestratorResult['actions']; toolTrace: Array<{ name: string; success: boolean; latencyMs?: number }>; traceId: string; t0: number }): OrchestratorResult {
    return { assistantMessage: msg, ui: {}, requiresApproval: false, actions: o.actions, trace: { traceId: o.traceId, toolCalls: o.toolTrace, totalLatencyMs: Date.now() - o.t0 } };
}
