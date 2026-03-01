import type { Request, Response, NextFunction } from 'express';

const TRUSTED_ORIGINS = (process.env.TRUSTED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Origin Guard Middleware — CSRF baseline for localhost security contract.
 * 
 * For state-changing requests (POST/PUT/PATCH/DELETE):
 *   - Requests with X-Internal-Token skip this check (service-to-service)
 *   - Origin header MUST be present
 *   - Origin header MUST be in TRUSTED_ORIGINS allowlist
 * 
 * Read-only requests (GET/HEAD/OPTIONS) pass through.
 */
export function originGuard(req: Request, res: Response, next: NextFunction): void {
    // Skip origin check for non-state-changing methods
    if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
        next();
        return;
    }

    // Skip origin check for internal service calls (MCP Server → Gateway)
    const internalToken = req.headers['x-internal-token'] as string | undefined;
    if (internalToken) {
        // Internal token validation happens in auth middleware
        next();
        return;
    }

    const origin = req.headers.origin as string | undefined;

    if (!origin) {
        res.status(403).json({
            error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Missing Origin header on state-changing request' },
            traceId: req.headers['x-trace-id'] || '',
        });
        return;
    }

    if (!TRUSTED_ORIGINS.includes(origin)) {
        res.status(403).json({
            error: { code: 'ORIGIN_NOT_ALLOWED', message: `Origin '${origin}' is not in the trusted origins list` },
            traceId: req.headers['x-trace-id'] || '',
        });
        return;
    }

    next();
}

export { TRUSTED_ORIGINS };
