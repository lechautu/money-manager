import { v4 as uuidv4 } from 'uuid';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { log } from './logger.js';

// --- Types ---
export type SessionState = 'IDLE' | 'TOOL_CALLING' | 'PENDING_OPTIONS' | 'PENDING_APPROVAL' | 'RESUMED' | 'DONE' | 'ERROR';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    toolCallId?: string;
    toolCalls?: Array<{ id: string; name: string; arguments: string }>;
}

export interface PendingApproval {
    approvalToken: string;
    toolName: string;
    toolArgs: Record<string, any>;
    argsHash: string;
    preview: any;
    createdAt: number;
    expiresAt: number;
    used: boolean;
}

export interface PendingOptions {
    optionToken: string;
    options: Array<{ id: string; label: string; data?: any }>;
    context: any;
    createdAt: number;
}

export interface Session {
    id: string;
    state: SessionState;
    messages: ChatMessage[];
    pendingApproval: PendingApproval | null;
    pendingOptions: PendingOptions | null;
    createdAt: number;
    updatedAt: number;
    expiresAt: number;
}

// --- Store ---
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS || '604800000', 10);
const STORE_PATH = process.env.SESSION_STORE_PATH || './data/sessions.json';
const sessions = new Map<string, Session>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function loadFromDisk() {
    try {
        if (existsSync(STORE_PATH)) {
            const arr: Session[] = JSON.parse(readFileSync(STORE_PATH, 'utf-8'));
            const now = Date.now();
            for (const s of arr) if (s.expiresAt > now) sessions.set(s.id, s);
            log('info', `Session store loaded: ${sessions.size} active sessions`);
        }
    } catch (err: any) { log('warn', `Failed to load sessions: ${err.message}`); }
}

function scheduleSave() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        try {
            const dir = dirname(STORE_PATH);
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            writeFileSync(STORE_PATH, JSON.stringify(Array.from(sessions.values()), null, 2), 'utf-8');
        } catch (err: any) { log('error', `Failed to save sessions: ${err.message}`); }
    }, 500);
}

export function initSessionStore() {
    loadFromDisk();
    setInterval(() => {
        const now = Date.now();
        let cleaned = 0;
        for (const [id, s] of sessions) { if (s.expiresAt <= now) { sessions.delete(id); cleaned++; } }
        if (cleaned > 0) { log('info', `Cleaned ${cleaned} expired sessions`); scheduleSave(); }
    }, 10 * 60 * 1000);
}

export function createSession(): Session {
    const now = Date.now();
    const s: Session = { id: uuidv4(), state: 'IDLE', messages: [], pendingApproval: null, pendingOptions: null, createdAt: now, updatedAt: now, expiresAt: now + SESSION_TTL_MS };
    sessions.set(s.id, s);
    scheduleSave();
    return s;
}

export function getSession(id: string): Session | undefined {
    const s = sessions.get(id);
    if (s && s.expiresAt <= Date.now()) { sessions.delete(id); scheduleSave(); return undefined; }
    return s;
}

export function updateSession(id: string, patch: Partial<Session>) {
    const s = sessions.get(id);
    if (!s) return;
    Object.assign(s, patch, { updatedAt: Date.now() });
    scheduleSave();
}

export function trimMessages(messages: ChatMessage[], max = 40): ChatMessage[] {
    if (messages.length <= max) return messages;
    const sys = messages[0]?.role === 'system' ? [messages[0]] : [];
    return [...sys, ...messages.slice(-(max - sys.length))];
}
