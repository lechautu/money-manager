import { v4 as uuidv4 } from 'uuid';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const SENSITIVE = new Set(['amount', 'total_amount', 'note', 'password', 'fileContent', 'LLM_API_KEY']);

function redact(obj: Record<string, any>): Record<string, any> {
    const r: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) r[k] = SENSITIVE.has(k) ? '[REDACTED]' : v;
    return r;
}

export function log(level: string, message: string, extra: Record<string, any> = {}) {
    const levels = ['debug', 'info', 'warn', 'error'];
    if (levels.indexOf(level) < levels.indexOf(LOG_LEVEL)) return;
    const entry: any = { timestamp: new Date().toISOString(), level, service: 'ai-gateway', request_id: extra.request_id || uuidv4(), message, ...extra };
    if (entry.args) entry.args = redact(entry.args);
    console.log(JSON.stringify(entry));
}
