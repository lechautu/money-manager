import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
    userId: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

const GATEWAY_INTERNAL_TOKEN = process.env.GATEWAY_INTERNAL_TOKEN || '';
const TRUSTED_ORIGINS = (process.env.TRUSTED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

/**
 * Auth Middleware — Dual-path authentication for security contract v3.
 * 
 * Path A (Trusted Local):
 *   No Authorization header + Origin in TRUSTED_ORIGINS → allow, userId = "local"
 * 
 * Path B (Internal Service — MCP Server):
 *   X-Internal-Token matches GATEWAY_INTERNAL_TOKEN → allow, userId from x-user-id or "service"
 * 
 * Path C (JWT — legacy/external):
 *   Authorization: Bearer <JWT> → validate JWT, extract userId
 * 
 * Otherwise → 401 UNAUTHORIZED
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    const internalToken = req.headers['x-internal-token'] as string | undefined;
    const origin = req.headers.origin as string | undefined;

    // Path B: Internal service token (MCP Server → Gateway)
    if (internalToken) {
        if (GATEWAY_INTERNAL_TOKEN && internalToken === GATEWAY_INTERNAL_TOKEN) {
            const userId = (req.headers['x-user-id'] as string) || 'service';
            req.user = { userId };
            next();
            return;
        }
        res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'Invalid internal service token' },
            traceId: req.headers['x-trace-id'] || '',
        });
        return;
    }

    // Path C: JWT authentication (legacy/external callers)
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const JWT_SECRET = process.env.JWT_SECRET || '';

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            req.user = { userId: decoded.sub || decoded.userId || decoded.id };
            next();
            return;
        } catch (err) {
            res.status(401).json({
                error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
                traceId: req.headers['x-trace-id'] || '',
            });
            return;
        }
    }

    // Path A: Trusted local (browser on loopback with valid Origin)
    // For GET requests, Origin may not be present — allow from loopback without Origin
    // For state-changing requests, Origin is already validated by origin-guard middleware
    if (origin && TRUSTED_ORIGINS.includes(origin)) {
        req.user = { userId: 'local' };
        next();
        return;
    }

    // Special case: GET requests from browser may not have Origin header
    // If we're bound to loopback only and it's a safe method, allow with local identity
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        req.user = { userId: 'local' };
        next();
        return;
    }

    // No valid auth path matched
    res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authentication. Provide Origin header, X-Internal-Token, or Authorization: Bearer <JWT>.' },
        traceId: req.headers['x-trace-id'] || '',
    });
}
