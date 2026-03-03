import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { log } from './logger.js';
import type { PendingApproval } from './sessionStore.js';

const TTL = parseInt(process.env.APPROVAL_TOKEN_TTL_MS || '300000', 10);

export function hashArgs(toolName: string, args: Record<string, any>): string {
    return createHash('sha256').update(JSON.stringify({ tool: toolName, args })).digest('hex').slice(0, 16);
}

export function createApprovalToken(toolName: string, toolArgs: Record<string, any>, preview: any): PendingApproval {
    const now = Date.now();
    const token: PendingApproval = {
        approvalToken: `appr_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
        toolName, toolArgs, argsHash: hashArgs(toolName, toolArgs), preview,
        createdAt: now, expiresAt: now + TTL, used: false,
    };
    log('info', `Approval token created for ${toolName}`, { tool_name: toolName });
    return token;
}

export function validateApprovalToken(pending: PendingApproval | null, token: string): { valid: boolean; error?: string } {
    if (!pending) return { valid: false, error: 'No pending approval' };
    if (pending.approvalToken !== token) return { valid: false, error: 'Invalid approval token' };
    if (pending.used) return { valid: false, error: 'Token already used' };
    if (Date.now() > pending.expiresAt) return { valid: false, error: 'Token expired' };
    return { valid: true };
}
