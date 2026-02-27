import { ToolExecutionService } from './ToolExecutionService';

export interface AuditLog {
    id: string;
    action: string;
    entity_type: string;
    entity_id?: string;
    details?: string;
    created_at: string;
}

export const AuditService = {
    async log(_action: string, _entityType: string, _entityId?: string, _details?: any) {
        // Logging is usually side-effect of other tools in Gateway.
        // If we want manual logs, we need a tool.
    },

    async getLogs(limit: number = 50, offset: number = 0) {
        const res = await ToolExecutionService.executeTool('get_audit_logs', { limit, offset });
        return res.data;
    }
};
