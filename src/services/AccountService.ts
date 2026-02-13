import { run } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

export interface Account {
    id: string;
    name: string;
    type: 'bank' | 'credit' | 'debit';
    currency: string;
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
            'INSERT INTO accounts (id, name, type, currency, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [newAccount.id, newAccount.name, newAccount.type, newAccount.currency, newAccount.note, newAccount.created_at, newAccount.updated_at]
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
        if (account.note !== undefined) { fields.push('note = ?'); args.push(account.note); }

        if (fields.length === 0) return;

        fields.push('updated_at = ?');
        args.push(now);
        args.push(id);

        await run(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, args);
    },

    async delete(id: string): Promise<void> {
        // Enforce Referential Integrity Check handled by SQLite FK, but we can check specifically if needed
        await run('DELETE FROM accounts WHERE id = ?', [id]);
    }
};
