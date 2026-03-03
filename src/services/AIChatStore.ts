import { v4 as uuidv4 } from 'uuid';
import type {
    AIChatState,
    ChatEntity,
    UserMessage,
    AssistantMessage,
    WaitingIndicator,
    ConfirmationCard,
    SystemMessage,
    ChatApiResponse,
} from '../types/aiChat';
import { AIChatService, AIChatServiceError } from './AIChatService';

// ── Constants ──
const STORAGE_KEY = 'ai-chat-state';
const REFRESH_COOLDOWN_MS = 5000;
const OFFLINE_THRESHOLD = 3;

// ── Initial State ──
function defaultState(): AIChatState {
    return {
        sessionId: null,
        entities: [],
        isWaiting: false,
        pendingConfirmationId: null,
        lastRefreshAt: 0,
        isOffline: false,
        failureCount: 0,
    };
}

// ── Persistence ──
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function loadState(): AIChatState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<AIChatState>;
            return { ...defaultState(), ...parsed };
        }
    } catch { /* ignore */ }
    return defaultState();
}

function saveState(state: AIChatState) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                sessionId: state.sessionId,
                entities: state.entities,
                pendingConfirmationId: state.pendingConfirmationId,
            }));
        } catch { /* quota exceeded, ignore */ }
    }, 300);
}

// ── Store (singleton) ──
type Listener = () => void;
let state: AIChatState = loadState();
const listeners = new Set<Listener>();
let sequenceCounter = state.entities.reduce(
    (max, e) => Math.max(max, e.serverSequence ?? 0), 0
) + 1;

function emit() {
    saveState(state);
    listeners.forEach((l) => l());
}

function updateState(patch: Partial<AIChatState>) {
    state = { ...state, ...patch };
    emit();
}

function upsertEntity(entity: ChatEntity) {
    const idx = state.entities.findIndex((e) => e.id === entity.id);
    const next = [...state.entities];
    if (idx >= 0) {
        next[idx] = entity;
    } else {
        next.push(entity);
    }
    state = { ...state, entities: next };
    emit();
}

function removeEntity(id: string) {
    state = { ...state, entities: state.entities.filter((e) => e.id !== id) };
    emit();
}

function nextSeq(): number {
    return sequenceCounter++;
}

// ── Process API response into entities ──
function processApiResponse(resp: ChatApiResponse, userMsgId?: string) {
    // Update sessionId
    if (resp.sessionId && resp.sessionId !== state.sessionId) {
        state = { ...state, sessionId: resp.sessionId };
    }

    // Remove waiting indicator for this turn
    if (userMsgId) {
        const waitingId = `wait_${userMsgId}`;
        state = { ...state, entities: state.entities.filter((e) => e.id !== waitingId) };
    }

    // Add assistant message
    if (resp.assistantMessage) {
        const assistantMsg: AssistantMessage = {
            id: `asst_${resp.trace.traceId}`,
            type: 'assistant',
            content: resp.assistantMessage,
            serverSequence: nextSeq(),
            createdAt: Date.now(),
        };
        upsertEntity(assistantMsg);
    }

    // Handle approval required → confirmation card
    if (resp.requiresApproval && resp.approval) {
        // Check if there's already a pending confirmation → expire the new one
        if (state.pendingConfirmationId) {
            const confirmCard: ConfirmationCard = {
                id: `confirm_${resp.approval.approvalToken}`,
                type: 'confirmation',
                preview: typeof resp.approval.preview === 'string' ? resp.approval.preview : JSON.stringify(resp.approval.preview),
                actionType: resp.approval.actionType,
                approvalToken: resp.approval.approvalToken,
                expiresAt: resp.approval.expiresAt,
                status: 'expired',
                serverSequence: nextSeq(),
                createdAt: Date.now(),
            };
            upsertEntity(confirmCard);
        } else {
            const confirmCard: ConfirmationCard = {
                id: `confirm_${resp.approval.approvalToken}`,
                type: 'confirmation',
                preview: typeof resp.approval.preview === 'string' ? resp.approval.preview : JSON.stringify(resp.approval.preview),
                actionType: resp.approval.actionType,
                approvalToken: resp.approval.approvalToken,
                expiresAt: resp.approval.expiresAt,
                status: 'pending',
                serverSequence: nextSeq(),
                createdAt: Date.now(),
            };
            upsertEntity(confirmCard);
            state = { ...state, pendingConfirmationId: confirmCard.id };
        }
    }

    // Clear waiting state
    state = { ...state, isWaiting: false, failureCount: 0, isOffline: false };
    emit();
}

// ── Public API ──
export const AIChatStore = {
    // useSyncExternalStore
    subscribe(listener: Listener): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
    getSnapshot(): AIChatState {
        return state;
    },

    // ── Send message ──
    async sendMessage(content: string) {
        if (state.isWaiting) return;
        const trimmed = content.trim();
        if (!trimmed) return;

        // Expire pending confirmation on new message (will be finalized after ack)
        const hadPendingConfirmation = state.pendingConfirmationId;

        const msgId = uuidv4();
        const userMsg: UserMessage = {
            id: msgId,
            type: 'user',
            content: trimmed,
            status: 'sending',
            serverSequence: nextSeq(),
            createdAt: Date.now(),
        };
        upsertEntity(userMsg);

        // Add waiting indicator
        const waitingId = `wait_${msgId}`;
        const waiting: WaitingIndicator = {
            id: waitingId,
            type: 'waiting',
            linkedTurnId: msgId,
            serverSequence: nextSeq(),
            createdAt: Date.now(),
        };
        upsertEntity(waiting);
        updateState({ isWaiting: true });

        try {
            const resp = await AIChatService.sendMessage(trimmed, state.sessionId);

            // Mark user message as sent
            const sentMsg: UserMessage = { ...userMsg, status: 'sent' };
            upsertEntity(sentMsg);

            // Now expire the pending confirmation (server-acknowledged)
            if (hadPendingConfirmation) {
                AIChatStore.expirePendingConfirmation();
            }

            processApiResponse(resp, msgId);
        } catch (err: any) {
            // Remove waiting indicator
            removeEntity(waitingId);

            if (err instanceof AIChatServiceError && err.code === 'SESSION_EXPIRED') {
                AIChatStore.handleSessionExpiry();
                // Retry with new session
                const failedMsg: UserMessage = { ...userMsg, status: 'failed', error: 'Session expired. Tap retry.' };
                upsertEntity(failedMsg);
                updateState({ isWaiting: false });
                return;
            }

            const failedMsg: UserMessage = { ...userMsg, status: 'failed', error: err.message || 'Send failed' };
            upsertEntity(failedMsg);
            const newFailCount = state.failureCount + 1;
            updateState({
                isWaiting: false,
                failureCount: newFailCount,
                isOffline: newFailCount >= OFFLINE_THRESHOLD,
            });
        }
    },

    // ── Retry failed message ──
    async retryMessage(entityId: string) {
        const entity = state.entities.find((e) => e.id === entityId);
        if (!entity || entity.type !== 'user' || (entity as UserMessage).status !== 'failed') return;

        // Remove old failed message
        removeEntity(entityId);

        // Re-send
        await AIChatStore.sendMessage((entity as UserMessage).content);
    },

    // ── Confirm action ──
    async confirmAction(confirmationId: string, decision: 'approve' | 'reject') {
        const entity = state.entities.find((e) => e.id === confirmationId);
        if (!entity || entity.type !== 'confirmation') return;
        const card = entity as ConfirmationCard;
        if (card.status !== 'pending') return;

        // Mark as confirming
        upsertEntity({ ...card, status: 'confirming', error: undefined });

        try {
            const resp = await AIChatService.approveAction(
                state.sessionId!,
                card.approvalToken,
                decision
            );

            // Update card status
            const newStatus = decision === 'approve' ? 'confirmed_yes' as const : 'confirmed_no' as const;
            upsertEntity({
                ...card,
                status: newStatus,
                resultSummary: resp.assistantMessage || undefined,
            });
            updateState({ pendingConfirmationId: null });

            // Process the rest of the response (assistant follow-up)
            processApiResponse(resp);
        } catch (err: any) {
            if (err instanceof AIChatServiceError && err.code === 'SESSION_EXPIRED') {
                AIChatStore.handleSessionExpiry();
                return;
            }
            // Keep pending, show inline error
            upsertEntity({ ...card, status: 'pending', error: err.message || 'Confirm failed. Tap to retry.' });
        }
    },

    // ── Refresh on open ──
    async refresh() {
        if (!state.sessionId) return;

        // Rate-limit unless pending state
        const now = Date.now();
        const hasPending = state.isWaiting || !!state.pendingConfirmationId;
        if (!hasPending && now - state.lastRefreshAt < REFRESH_COOLDOWN_MS) return;

        try {
            const info = await AIChatService.getSession(state.sessionId);
            updateState({
                lastRefreshAt: Date.now(),
                failureCount: 0,
                isOffline: false,
            });

            // If session has pending approval but we don't have a confirmation card, the state is stale
            // For now, just validate the session is alive
            if (info.state === 'PENDING_APPROVAL' && !state.pendingConfirmationId) {
                // Session has a pending approval we don't know about — could refresh chat
            }
        } catch (err: any) {
            if (err instanceof AIChatServiceError && err.code === 'SESSION_EXPIRED') {
                AIChatStore.handleSessionExpiry();
                return;
            }
            if (err instanceof AIChatServiceError && (err.code === 'NOT_FOUND' || err.code === 'SESSION_EXPIRED')) {
                AIChatStore.handleSessionExpiry();
                return;
            }
            const newFailCount = state.failureCount + 1;
            updateState({
                lastRefreshAt: Date.now(),
                failureCount: newFailCount,
                isOffline: newFailCount >= OFFLINE_THRESHOLD,
            });
        }
    },

    // ── Session expiry ──
    handleSessionExpiry() {
        const updated = state.entities.map((e) => {
            if (e.type === 'waiting') return null; // remove waiting
            if (e.type === 'confirmation' && (e as ConfirmationCard).status === 'pending') {
                return { ...e, status: 'expired' as const } as ConfirmationCard;
            }
            if (e.type === 'user' && (e as UserMessage).status === 'sending') {
                return { ...e, status: 'failed' as const, error: 'Session expired' } as UserMessage;
            }
            return e;
        }).filter(Boolean) as ChatEntity[];

        // Add system divider
        const divider: SystemMessage = {
            id: `sys_${uuidv4()}`,
            type: 'system',
            content: 'Session expired — continuing in a new session.',
            serverSequence: nextSeq(),
            createdAt: Date.now(),
        };
        updated.push(divider);

        updateState({
            entities: updated,
            sessionId: null,
            isWaiting: false,
            pendingConfirmationId: null,
        });
    },

    // ── Expire pending confirmation ──
    expirePendingConfirmation() {
        if (!state.pendingConfirmationId) return;
        const entity = state.entities.find((e) => e.id === state.pendingConfirmationId);
        if (entity && entity.type === 'confirmation' && (entity as ConfirmationCard).status === 'pending') {
            upsertEntity({ ...(entity as ConfirmationCard), status: 'expired' });
        }
        updateState({ pendingConfirmationId: null });
    },

    // ── Clear history ──
    async clearHistory() {
        if (state.sessionId) {
            try {
                await AIChatService.clearHistory(state.sessionId);
            } catch (err: any) {
                console.warn('Failed to clear remote history:', err.message);
            }
        }
        AIChatStore.clearAll();
    },

    // ── Clear all (for dev/testing) ──
    clearAll() {
        state = defaultState();
        sequenceCounter = 1;
        localStorage.removeItem(STORAGE_KEY);
        emit();
    },
};
