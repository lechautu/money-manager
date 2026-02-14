
import { run } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLog {
    id: string;
    action: string;
    entity_type: string;
    entity_id?: string;
    details?: string;
    created_at: string;
}

export const AuditService = {
    async log(action: string, entityType: string, entityId?: string, details?: any) {
        const id = uuidv4();
        const createdAt = new Date().toISOString();
        const detailsStr = details ? JSON.stringify(details) : undefined;

        await run(`
            INSERT INTO audit_logs (id, action, entity_type, entity_id, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, action, entityType, entityId, detailsStr, createdAt]);
    },

    async getLogs(limit: number = 50, offset: number = 0) {
        return await run(`
            SELECT * FROM audit_logs
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);
    }
};
