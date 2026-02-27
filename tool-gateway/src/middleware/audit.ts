import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { run } from '../db/client.js';

/**
 * Audit logging middleware factory.
 * Records every tool execution for Tier 1/2 operations.
 */
export function auditLog(toolName: string, tier: number, resourceType: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const originalJson = res.json.bind(res);
        const traceId = (req.headers['x-trace-id'] as string) || uuidv4();

        res.json = function (body: any) {
            // Log after response is prepared
            try {
                const resourceIds = req.body?.id || req.body?.ids || req.params?.id || '';
                run(
                    `INSERT INTO audit_logs (id, trace_id, actor_user_id, caller_type, tool_name, tier, resource_type, resource_ids, result, error_code, created_at, action, entity_type, entity_id, details)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        uuidv4(),
                        traceId,
                        req.user?.userId || 'unknown',
                        (req.headers['x-caller-type'] as string) || 'mcp',
                        toolName,
                        tier,
                        resourceType,
                        typeof resourceIds === 'object' ? JSON.stringify(resourceIds) : String(resourceIds),
                        body?.error ? 'fail' : 'success',
                        body?.error?.code || null,
                        new Date().toISOString(),
                        toolName, // action
                        resourceType, // entity_type
                        typeof resourceIds === 'object' ? JSON.stringify(resourceIds) : String(resourceIds), // entity_id
                        JSON.stringify(req.body || {}), // details
                    ]
                );
            } catch (err) {
                console.error('Audit log error:', err);
            }
            return originalJson(body);
        };

        next();
    };
}
