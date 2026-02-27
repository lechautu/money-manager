import { v4 as uuidv4 } from 'uuid';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const SENSITIVE_KEYS = new Set([
    'amount', 'total_amount', 'initial_balance', 'note',
    'fileContent', 'password',
]);

function redactValue(key: string, value: any): any {
    if (SENSITIVE_KEYS.has(key)) {
        return '[REDACTED]';
    }
    return value;
}

function redactArgs(args: Record<string, any>): Record<string, any> {
    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
        redacted[key] = redactValue(key, value);
    }
    return redacted;
}

export interface LogEntry {
    timestamp: string;
    level: string;
    request_id: string;
    tool_name?: string;
    tier?: number;
    latency_ms?: number;
    status_code?: number;
    message: string;
    args?: Record<string, any>;
}

export function log(level: string, message: string, extra: Partial<LogEntry> = {}) {
    const levels = ['debug', 'info', 'warn', 'error'];
    if (levels.indexOf(level) < levels.indexOf(LOG_LEVEL)) return;

    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        request_id: extra.request_id || uuidv4(),
        message,
        ...extra,
    };

    // Redact args if present
    if (entry.args) {
        entry.args = redactArgs(entry.args);
    }

    console.log(JSON.stringify(entry));
}
