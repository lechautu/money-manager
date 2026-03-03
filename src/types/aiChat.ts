// ── AI Chat Entity Types ──

export type EntityType = 'user' | 'assistant' | 'waiting' | 'confirmation' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'failed';
export type ConfirmationStatus = 'pending' | 'confirming' | 'confirmed_yes' | 'confirmed_no' | 'expired';

// Base
export interface ChatEntityBase {
    id: string;
    type: EntityType;
    serverSequence?: number; // monotonic ordering from server (traceId-derived or timestamp)
    createdAt: number;       // client timestamp for display only, NOT for ordering
}

// User message
export interface UserMessage extends ChatEntityBase {
    type: 'user';
    content: string;
    status: MessageStatus;
    error?: string;
}

// Assistant message
export interface AssistantMessage extends ChatEntityBase {
    type: 'assistant';
    content: string;
}

// Waiting indicator (typing bubble)
export interface WaitingIndicator extends ChatEntityBase {
    type: 'waiting';
    linkedTurnId?: string; // the user message id this is waiting for
}

// In-chat confirmation card
export interface ConfirmationCard extends ChatEntityBase {
    type: 'confirmation';
    preview: string;           // description of the action
    actionType: string;        // tool name
    approvalToken: string;
    expiresAt: string;         // ISO string
    status: ConfirmationStatus;
    error?: string;            // inline error on confirm failure
    resultSummary?: string;    // after confirm ack
}

// System divider message (e.g. "Session expired")
export interface SystemMessage extends ChatEntityBase {
    type: 'system';
    content: string;
}

// Union
export type ChatEntity = UserMessage | AssistantMessage | WaitingIndicator | ConfirmationCard | SystemMessage;

// ── API Response Types ──

export interface ChatApiResponse {
    sessionId: string;
    assistantMessage: string | null;
    ui: {
        options?: Array<{ id: string; label: string }>;
        actionPreview?: { title: string; items: Array<{ id: string; label: string }> };
    };
    requiresApproval: boolean;
    approval?: {
        approvalToken: string;
        expiresAt: string;
        actionType: string;
        preview: any;
    };
    actions: Array<{ toolName: string; success: boolean; data?: any; error?: any }>;
    trace: {
        traceId: string;
        toolCalls: Array<{ name: string; success: boolean; latencyMs?: number }>;
        totalLatencyMs: number;
    };
    error?: { code: string; message: string; retryable?: boolean };
}

export interface SessionInfoResponse {
    id: string;
    state: string;
    messageCount: number;
    hasPendingApproval: boolean;
    createdAt: string;
    error?: { code: string; message: string };
}

// ── Store State ──

export interface AIChatState {
    sessionId: string | null;
    entities: ChatEntity[];
    isWaiting: boolean;
    pendingConfirmationId: string | null;
    lastRefreshAt: number;
    isOffline: boolean;
    failureCount: number;
}
