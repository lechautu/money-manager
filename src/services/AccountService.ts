import { run } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

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
        return await run('SELECT * FROM accounts ORDER BY name');
    },

    async getById(id: string): Promise<Account | null> {
        const rows = await run('SELECT * FROM accounts WHERE id = ?', [id]);
        return rows.length > 0 ? rows[0] : null;
    },

    async create(account: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Promise<Account> {
        const id = uuidv4();
        const now = new Date().toISOString();
        const newAccount: Account = { ...account, id, created_at: now, updated_at: now };
        await run(
            'INSERT INTO accounts (id, name, type, currency, initial_balance, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [newAccount.id, newAccount.name, newAccount.type, newAccount.currency, newAccount.initial_balance, newAccount.note, newAccount.created_at, newAccount.updated_at]
        );
        return newAccount;
    },

    async update(id: string, account: Partial<Omit<Account, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
        const now = new Date().toISOString();
        const fields: string[] = [];
        const args: any[] = [];

        if (account.name !== undefined) { fields.push('name = ?'); args.push(account.name); }
        if (account.type !== undefined) { fields.push('type = ?'); args.push(account.type); }
        if (account.currency !== undefined) { fields.push('currency = ?'); args.push(account.currency); }
        if (account.initial_balance !== undefined) { fields.push('initial_balance = ?'); args.push(account.initial_balance); }
        if (account.note !== undefined) { fields.push('note = ?'); args.push(account.note); }

        if (fields.length === 0) return;

        fields.push('updated_at = ?');
        args.push(now);
        args.push(id);

        await run(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, args);
    },

    async delete(id: string): Promise<void> {
        // 1. Check Recurring Rules
        const recurring = await run(
            'SELECT id FROM recurring_rules WHERE account_id = ? OR to_account_id = ? LIMIT 1',
            [id, id]
        );
        if (recurring.length > 0) {
            throw new Error('Cannot delete account: It is used in Recurring Rules.');
        }

        // 2. Check Installment Plans
        const installments = await run(
            'SELECT id FROM installment_plans WHERE credit_account_id = ? OR payment_source_account_id = ? LIMIT 1',
            [id, id]
        );
        if (installments.length > 0) {
            throw new Error('Cannot delete account: It is used in Installment Plans.');
        }

        // 3. Check Transactions (Active only)
        const txs = await run(
            'SELECT id FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND deleted_at IS NULL LIMIT 1',
            [id, id]
        );
        if (txs.length > 0) {
            throw new Error('Cannot delete account: It has active active transactions. Please delete them first.');
        }

        // Clean up soft-deleted transactions to allows FK constraint to pass
        await run('DELETE FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND deleted_at IS NOT NULL', [id, id]);

        await run('DELETE FROM accounts WHERE id = ?', [id]);
    }
};
