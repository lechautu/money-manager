import { ToolExecutionService } from './ToolExecutionService';

export interface Account {
    id: string;
    name: string;
    type: 'bank' | 'credit' | 'debit';
    currency: string;
    initial_balance: number;
    note?: string;
    created_at: string;
    updated_at: string;
}

export const AccountService = {
    async getAll(): Promise<Account[]> {
        const res = await ToolExecutionService.executeTool('get_accounts', {});
        return res.data;
    },

    async getById(id: string): Promise<Account | null> {
        const res = await this.getAll();
        return res.find(a => a.id === id) || null;
    },

    async create(account: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Promise<Account> {
        const res = await ToolExecutionService.executeTool('create_account', account);
        return res.data;
    },

    async update(id: string, account: Partial<Omit<Account, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
        await ToolExecutionService.executeTool('update_account', { id, ...account });
    },

    async delete(id: string): Promise<void> {
        await ToolExecutionService.executeTool('delete_account', { id });
    }
};
