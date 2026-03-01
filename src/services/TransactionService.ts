import { ToolExecutionService } from './ToolExecutionService';

export interface Transaction {
    id: string;
    account_id: string;
    date: string;
    month: string;
    amount: number;
    category_id: string;
    sub_category_id?: string | null;
    to_account_id?: string | null;
    status: 'posted' | 'pending' | 'ignored';
    note?: string | null;
    source: 'manual' | 'recurring' | 'installment' | 'transfer';
    source_ref_id?: string | null;
    is_split: number; // 0 or 1
    splitLines?: TransactionSplit[];
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    // Joined fields
    category_name?: string;
    sub_category_name?: string;
    account_name?: string;
    to_account_name?: string;
    currency?: string;
    recurring_name?: string;
    installment_plan_name?: string;
    installment_period?: string;
}

export interface TransactionSplit {
    id: string;
    transaction_id: string;
    category_id: string;
    sub_category_id?: string | null;
    amount: number;
    note?: string | null;
}

export type TransactionFilter = {
    month?: string;
    startDate?: string;
    endDate?: string;
    accountId?: string;
    categoryId?: string;
    subCategoryId?: string;
    status?: string;
    search?: string;
    source?: string;
    excludeSource?: string[];
    excludeLinkedToInstallments?: boolean;
    sortBy?: 'date' | 'amount';
    sortOrder?: 'asc' | 'desc';
};

export const TransactionService = {
    async getAll(filter: TransactionFilter = {}): Promise<Transaction[]> {
        const res = await ToolExecutionService.executeTool('search_transactions', filter);
        return res.data;
    },

    async getById(id: string): Promise<Transaction | null> {
        const res = await this.getAll({});
        return res.find((t: any) => t.id === id) || null;
    },

    async create(tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<Transaction> {
        const res = await ToolExecutionService.executeTool('record_transaction', tx);
        return res.data;
    },

    async update(id: string, tx: Partial<Omit<Transaction, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
        await ToolExecutionService.executeTool('update_transaction', { id, ...tx });
    },

    async transfer(fromAccountId: string, toAccountId: string, amount: number, date: string, categoryId?: string, subCategoryId?: string, note?: string): Promise<Transaction> {
        const res = await ToolExecutionService.executeTool('transfer_funds', {
            fromAccountId, toAccountId, amount, date, categoryId, subCategoryId, note
        });
        return res.data;
    },

    async delete(id: string): Promise<void> {
        await ToolExecutionService.executeTool('delete_transaction', { id });
    },

    async restore(id: string): Promise<void> {
        await ToolExecutionService.executeTool('restore_transaction', { id });
    },

    async getBalances(): Promise<Record<string, { posted: number, effective: number }>> {
        const res = await ToolExecutionService.executeTool('get_account_balances', {});
        return res.data;
    },

    async bulkDelete(ids: string[]): Promise<void> {
        await ToolExecutionService.executeTool('bulk_delete_transactions', { ids });
    },

    async bulkRestore(ids: string[]): Promise<void> {
        await ToolExecutionService.executeTool('bulk_restore_transactions', { ids });
    },

    async bulkUpdate(ids: string[], updates: Partial<Pick<Transaction, 'account_id' | 'status'>>): Promise<void> {
        // gateway doesn't have a specific bulkUpdate tool yet, but we can do it via repeat calls or add one.
        // For now, let's assume we can add it later if needed or do sequential.
        for (const id of ids) {
            await this.update(id, updates);
        }
    }
};
