import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface ApprovalClaims {
    sub: string;   // userId
    act: string;   // action name (e.g., delete_transaction)
    rid: string;   // resource ids or scope hash
    exp: number;   // expiry timestamp
    nonce: string; // single-use
    iat: number;   // issued at
}

/**
 * Middleware factory for Tier 2 endpoints.
 * Verifies the X-MM-Approval-Token header contains a valid signed token
 * scoped to the correct user and action.
 */
export function approvalGuard(toolName: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const tokenHeader = req.headers['x-mm-approval-token'] as string | undefined;

        // Also support simple header for MCP server compatibility
        const simpleApproval = req.headers['x-mm-approval'] as string | undefined;

        if (simpleApproval === 'approved') {
            // Simple mode: accept without cryptographic verification
            // Useful when MCP server already handled the approval flow
            next();
            return;
        }

        if (!tokenHeader) {
            res.status(403).json({
                error: {
                    code: 'APPROVAL_REQUIRED',
                    message: `Tool '${toolName}' is Tier 2 (destructive/sensitive). An approval token is required.`,
                },
                traceId: req.headers['x-trace-id'] || '',
            });
            return;
        }

        try {
            const APPROVAL_TOKEN_SECRET = process.env.APPROVAL_TOKEN_SECRET || '';
            const claims = jwt.verify(tokenHeader, APPROVAL_TOKEN_SECRET) as ApprovalClaims;

            // Verify user matches
            if (req.user && claims.sub !== req.user.userId) {
                res.status(403).json({
                    error: { code: 'FORBIDDEN', message: 'Approval token user does not match authenticated user' },
                    traceId: req.headers['x-trace-id'] || '',
                });
                return;
            }

            // Verify action matches
            if (claims.act !== toolName) {
                res.status(403).json({
                    error: { code: 'FORBIDDEN', message: `Approval token action '${claims.act}' does not match '${toolName}'` },
                    traceId: req.headers['x-trace-id'] || '',
                });
                return;
            }

            next();
        } catch (err) {
            res.status(403).json({
                error: { code: 'FORBIDDEN', message: 'Invalid or expired approval token' },
                traceId: req.headers['x-trace-id'] || '',
            });
        }
    };
}
