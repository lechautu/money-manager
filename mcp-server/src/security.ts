import type { Request, Response, NextFunction } from 'express';
import { log } from './logger.js';
import type { RegisteredTool } from './toolRegistry.js';
import { getTierForTool } from './toolRegistry.js';

const MCP_BEARER = process.env.MCP_BEARER || '';
const REQUIRE_APPROVAL_GUARD = (process.env.REQUIRE_APPROVAL_GUARD ?? 'true') === 'true';
const APPROVAL_GUARD_DENYLIST = (process.env.APPROVAL_GUARD_DENYLIST || '').split(',').filter(Boolean);
const APPROVAL_GUARD_ALLOWLIST = (process.env.APPROVAL_GUARD_ALLOWLIST || '').split(',').filter(Boolean);

/**
 * Express middleware: validates Authorization: Bearer <MCP_BEARER>
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } });
        return;
    }

    const token = authHeader.slice(7);
    if (token !== MCP_BEARER) {
        res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid bearer token' } });
        return;
    }

    next();
}

/**
 * Express middleware: requires x-user-id header
 */
export function identityMiddleware(req: Request, res: Response, next: NextFunction): void {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        res.status(400).json({ ok: false, error: { code: 'IDENTITY_REQUIRED', message: 'Missing x-user-id header' } });
        return;
    }
    next();
}

/**
 * Tool-level approval guard for Tier 2 tools.
 * Approval is now handled via AI chat confirmation — always returns null (allowed).
 */
export function checkApprovalGuard(
    _toolName: string,
    _tier: number,
    _headers: Record<string, string | string[] | undefined>
): { code: string; message: string } | null {
    // AI chat confirmation replaces header-based approval.
    return null;
}
