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

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
            traceId: req.headers['x-trace-id'] || '',
        });
        return;
    }

    const token = authHeader.slice(7);
    const JWT_SECRET = process.env.JWT_SECRET || '';

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = { userId: decoded.sub || decoded.userId || decoded.id };
        next();
    } catch (err) {
        res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
            traceId: req.headers['x-trace-id'] || '',
        });
    }
}
