import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory for Tier 2 endpoints.
 * Approval is now handled via AI chat confirmation — this guard always passes through.
 * The audit log middleware still records all tier 2 actions.
 */
export function approvalGuard(_toolName: string) {
    return (_req: Request, _res: Response, next: NextFunction): void => {
        // AI chat confirmation replaces token-based approval.
        // No blocking here — AI must ask user before calling the tool.
        next();
    };
}
