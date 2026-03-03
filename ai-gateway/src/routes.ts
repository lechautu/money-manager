import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { log } from './logger.js';
import { createSession, getSession, updateSession, type Session } from './sessionStore.js';
import { runOrchestrator } from './orchestrator.js';
import { validateApprovalToken } from './approvalManager.js';
import { callTool } from './mcpClient.js';

export const aiRoutes = Router();

// --- POST /chat ---
aiRoutes.post('/chat', async (req, res) => {
    const traceId = `tr_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    try {
        const { sessionId, message, locale, timezone, clientContext, resume } = req.body;
        if (!message && !resume) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '"message" or "resume" required' }, trace: { traceId } }); return; }

        let session: Session;
        if (sessionId) {
            const s = getSession(sessionId);
            if (!s) { res.status(404).json({ error: { code: 'SESSION_EXPIRED', message: 'Session not found or expired' }, trace: { traceId } }); return; }
            session = s;
        } else {
            session = createSession();
        }

        log('info', `Chat: session=${session.id}`, { session_id: session.id, trace_id: traceId });

        // Handle resume (options selection)
        let userMessage = message;
        if (resume?.type === 'options' && resume.selectedOptionIds && session.pendingOptions) {
            const selected = session.pendingOptions.options.filter((o: any) => resume.selectedOptionIds.includes(o.id));
            userMessage = `Tôi chọn: ${selected.map((o: any) => o.label).join(', ')}`;
            updateSession(session.id, { pendingOptions: null, state: 'RESUMED' });
        }

        const result = await runOrchestrator(session, userMessage, {
            locale: locale || 'vi-VN',
            timezone: timezone || 'Asia/Ho_Chi_Minh',
            currency: clientContext?.currency || 'VND',
        }, { traceId });

        res.json({ sessionId: session.id, ...result });
    } catch (err: any) {
        log('error', `Chat error: ${err.message}`, { trace_id: traceId });
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', retryable: true }, trace: { traceId } });
    }
});

// --- POST /approve ---
aiRoutes.post('/approve', async (req, res) => {
    const traceId = `tr_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    try {
        const { sessionId, approvalToken, decision } = req.body;
        if (!sessionId || !approvalToken || !decision) {
            res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '"sessionId", "approvalToken", "decision" required' }, trace: { traceId } });
            return;
        }

        const session = getSession(sessionId);
        if (!session) { res.status(404).json({ error: { code: 'SESSION_EXPIRED', message: 'Session expired' }, trace: { traceId } }); return; }

        const v = validateApprovalToken(session.pendingApproval, approvalToken);
        if (!v.valid) { res.status(403).json({ error: { code: 'APPROVAL_EXPIRED', message: v.error }, trace: { traceId } }); return; }

        log('info', `Approve ${decision}: tool=${session.pendingApproval!.toolName}`, { session_id: sessionId, trace_id: traceId, tool_name: session.pendingApproval!.toolName });

        if (decision === 'reject') {
            session.pendingApproval!.used = true;
            updateSession(sessionId, { state: 'DONE', pendingApproval: null });
            res.json({ sessionId, assistantMessage: 'Đã hủy thao tác.', ui: {}, requiresApproval: false, actions: [], trace: { traceId, toolCalls: [], totalLatencyMs: 0 } });
            return;
        }

        // Execute approved tool
        const pending = session.pendingApproval!;
        pending.used = true;

        const toolResult = await callTool(pending.toolName, pending.toolArgs, { traceId, approval: 'approved' });
        updateSession(sessionId, { state: 'DONE', pendingApproval: null });

        // Add tool result to messages, let LLM summarize
        session.messages.push({ role: 'tool', content: JSON.stringify(toolResult.ok ? toolResult.data : toolResult.error), toolCallId: `approved_${pending.toolName}` });
        const result = await runOrchestrator(session, null, {}, { traceId });

        res.json({
            sessionId,
            assistantMessage: result.assistantMessage || (toolResult.ok ? 'Thao tác thành công.' : `Lỗi: ${toolResult.error?.message}`),
            ui: result.ui,
            requiresApproval: false,
            actions: [{ toolName: pending.toolName, success: toolResult.ok, data: toolResult.data, error: toolResult.error }, ...result.actions],
            trace: { traceId, toolCalls: [{ name: pending.toolName, success: toolResult.ok }, ...result.trace.toolCalls], totalLatencyMs: result.trace.totalLatencyMs },
        });
    } catch (err: any) {
        log('error', `Approve error: ${err.message}`, { trace_id: traceId });
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', retryable: true }, trace: { traceId } });
    }
});

// --- GET /session/:id ---
aiRoutes.get('/session/:id', (req, res) => {
    const s = getSession(req.params.id);
    if (!s) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }); return; }
    res.json({ id: s.id, state: s.state, messageCount: s.messages.length, hasPendingApproval: !!s.pendingApproval, createdAt: new Date(s.createdAt).toISOString() });
});
