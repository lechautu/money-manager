import { v4 as uuidv4 } from 'uuid';
import { log } from './logger.js';
import { getTools, callTool, isToolAllowed } from './mcpClient.js';
import { chatCompletion, convertToolsToOpenAI } from './llmProvider.js';
import { createApprovalToken } from './approvalManager.js';
import type { ChatMessage, Session } from './sessionStore.js';
import { trimMessages, updateSession } from './sessionStore.js';

const MAX_TOOL_CALLS = parseInt(process.env.MAX_TOOL_CALLS_PER_TURN || '8', 10);
const MAX_WALL_TIME = parseInt(process.env.MAX_TURN_WALL_TIME_MS || '25000', 10);

function buildSystemPrompt(ctx: { locale?: string; timezone?: string; currency?: string }): string {
    const locale = ctx.locale || 'vi-VN';
    const tz = ctx.timezone || 'Asia/Ho_Chi_Minh';
    const currency = ctx.currency || 'VND';
    const today = new Date().toLocaleDateString(locale, { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });

    return `Bạn là trợ lý tài chính của ứng dụng Money Manager 2.

## Nguyên tắc
- Locale: ${locale}, Timezone: ${tz}, Currency: ${currency}, Hôm nay: ${today}
- Trả lời ngắn gọn, chính xác, thân thiện.
- Dùng tool để thao tác dữ liệu. Không tự bịa account/category/payee — dùng tool search/get.
- Khi ambiguous (nhiều kết quả), liệt kê options để user chọn. KHÔNG tự đoán target.
- Thao tác nhạy cảm (xóa/clear) cần user confirm — hệ thống sẽ tự chặn.
- Format số tiền theo locale (VD: 150.000đ).`;
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
    const trimmed = trimMessages(session.messages, 40);

    // --- Loop ---
    while (true) {
        // Budget: wall time
        if (Date.now() - t0 > MAX_WALL_TIME) {
            log('warn', 'Orchestrator timeout', { trace_id: traceId, session_id: session.id });
            return mkResult('Xin lỗi, xử lý quá lâu. Vui lòng thử lại.', { actions, toolTrace, traceId, t0 });
        }
        // Budget: tool calls
        if (toolCallCount >= MAX_TOOL_CALLS) {
            return mkResult('Đã đạt giới hạn thao tác. Vui lòng gửi yêu cầu tiếp.', { actions, toolTrace, traceId, t0 });
        }

        // Call LLM
        let llm;
        try {
            updateSession(session.id, { state: 'TOOL_CALLING' });
            llm = await chatCompletion(trimmed, openaiTools, { traceId });
        } catch (err: any) {
            log('error', `LLM error: ${err.message}`, { trace_id: traceId });
            return mkResult('Hệ thống AI đang gặp sự cố. Vui lòng thử lại sau.', { actions, toolTrace, traceId, t0 });
        }

        // Final text response
        if (llm.toolCalls.length === 0) {
            const msg = llm.content || '';
            session.messages.push({ role: 'assistant', content: msg });
            trimmed.push({ role: 'assistant', content: msg });
            updateSession(session.id, { state: 'DONE', messages: session.messages });
            return mkResult(msg, { actions, toolTrace, traceId, t0 });
        }

        // Process tool calls
        session.messages.push({ role: 'assistant', content: llm.content, toolCalls: llm.toolCalls });
        trimmed.push({ role: 'assistant', content: llm.content, toolCalls: llm.toolCalls });

        for (const tc of llm.toolCalls) {
            toolCallCount++;
            const tcT0 = Date.now();

            if (!isToolAllowed(tc.name)) {
                const err = JSON.stringify({ error: `Tool '${tc.name}' not found` });
                session.messages.push({ role: 'tool', content: err, toolCallId: tc.id });
                trimmed.push({ role: 'tool', content: err, toolCallId: tc.id });
                toolTrace.push({ name: tc.name, success: false, latencyMs: Date.now() - tcT0 });
                continue;
            }

            let args: Record<string, any>;
            try { args = JSON.parse(tc.arguments); } catch {
                const err = JSON.stringify({ error: 'Invalid JSON arguments' });
                session.messages.push({ role: 'tool', content: err, toolCallId: tc.id });
                trimmed.push({ role: 'tool', content: err, toolCallId: tc.id });
                toolTrace.push({ name: tc.name, success: false, latencyMs: Date.now() - tcT0 });
                continue;
            }

            const result = await callTool(tc.name, args, { traceId, approval: opts.approvalHeader });
            const tcLatency = Date.now() - tcT0;

            // APPROVAL_REQUIRED
            if (!result.ok && result.error?.code === 'APPROVAL_REQUIRED') {
                const approval = createApprovalToken(tc.name, args, { toolName: tc.name, args });
                updateSession(session.id, { state: 'PENDING_APPROVAL', pendingApproval: approval, messages: session.messages });
                toolTrace.push({ name: tc.name, success: false, latencyMs: tcLatency });

                const previewMsg = llm.content || `Hành động "${tc.name}" cần xác nhận trước khi thực hiện.`;
                return {
                    assistantMessage: previewMsg,
                    ui: { actionPreview: { title: tc.name, items: [{ id: tc.name, label: JSON.stringify(args) }] } },
                    requiresApproval: true,
                    approval: { approvalToken: approval.approvalToken, expiresAt: new Date(approval.expiresAt).toISOString(), actionType: tc.name, preview: approval.preview },
                    actions,
                    trace: { traceId, toolCalls: toolTrace, totalLatencyMs: Date.now() - t0 },
                };
            }

            const content = JSON.stringify(result.ok ? result.data : result.error);
            session.messages.push({ role: 'tool', content, toolCallId: tc.id });
            trimmed.push({ role: 'tool', content, toolCallId: tc.id });
            toolTrace.push({ name: tc.name, success: result.ok, latencyMs: tcLatency });
            actions.push({ toolName: tc.name, success: result.ok, data: result.ok ? result.data : undefined, error: result.ok ? undefined : result.error });
        }

        updateSession(session.id, { messages: session.messages });
    }
}

function mkResult(msg: string, o: { actions: OrchestratorResult['actions']; toolTrace: Array<{ name: string; success: boolean; latencyMs?: number }>; traceId: string; t0: number }): OrchestratorResult {
    return { assistantMessage: msg, ui: {}, requiresApproval: false, actions: o.actions, trace: { traceId: o.traceId, toolCalls: o.toolTrace, totalLatencyMs: Date.now() - o.t0 } };
}
