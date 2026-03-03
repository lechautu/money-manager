import type { ChatApiResponse, SessionInfoResponse } from '../types/aiChat';

const AI_GATEWAY_BASE = '/ai-api';

export class AIChatServiceError extends Error {
    code: string;
    retryable: boolean;
    constructor(code: string, message: string, retryable = false) {
        super(message);
        this.code = code;
        this.retryable = retryable;
    }
}

async function request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = `${AI_GATEWAY_BASE}${path}`;
    const opts: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);

    let res: Response;
    try {
        res = await fetch(url, opts);
    } catch {
        throw new AIChatServiceError('NETWORK_ERROR', 'Network request failed', true);
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const errCode = data?.error?.code || 'UNKNOWN_ERROR';
        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        const retryable = data?.error?.retryable ?? res.status >= 500;
        throw new AIChatServiceError(errCode, errMsg, retryable);
    }

    return data as T;
}

export const AIChatService = {
    /** Send a message or start a new conversation */
    async sendMessage(message: string, sessionId?: string | null): Promise<ChatApiResponse> {
        return request<ChatApiResponse>('POST', '/chat', {
            message,
            ...(sessionId ? { sessionId } : {}),
            locale: 'en-US',
            timezone: 'Asia/Ho_Chi_Minh',
        });
    },

    /** Approve or reject a pending action */
    async approveAction(sessionId: string, approvalToken: string, decision: 'approve' | 'reject'): Promise<ChatApiResponse> {
        return request<ChatApiResponse>('POST', '/approve', {
            sessionId,
            approvalToken,
            decision,
        });
    },

    /** Get session info (lightweight refresh) */
    async getSession(sessionId: string): Promise<SessionInfoResponse> {
        return request<SessionInfoResponse>('GET', `/session/${sessionId}`);
    },

    /** Delete session / Clear history */
    async clearHistory(sessionId: string): Promise<void> {
        await request<void>('DELETE', `/session/${sessionId}`);
    },
};
