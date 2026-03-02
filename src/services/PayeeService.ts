import { ToolExecutionService } from './ToolExecutionService';

export interface Payee {
    id: string;
    name: string;
    normalized_name: string;
    is_archived: number;
    created_at: string;
    updated_at: string;
}

export const PayeeService = {
    async getAll(includeArchived = false): Promise<Payee[]> {
        const res = await ToolExecutionService.executeTool('get_payees', { includeArchived });
        return res.data;
    },

    async create(name: string): Promise<Payee> {
        const res = await ToolExecutionService.executeTool('create_payee', { name });
        return res.data;
    },

    async update(id: string, name: string): Promise<Payee> {
        const res = await ToolExecutionService.executeTool('update_payee', { id, name });
        return res.data;
    },

    async archive(id: string, isArchived: boolean): Promise<Payee> {
        const res = await ToolExecutionService.executeTool('archive_payee', { id, isArchived });
        return res.data;
    },
};
