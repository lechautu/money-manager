import { run } from '../../db/client';
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

export const LocalAccountService = {
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
            [id, account.name, account.type, account.currency, account.initial_balance, account.note || null, now, now]
        );
        return newAccount;
    },

    async update(id: string, account: Partial<Omit<Account, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
        const now = new Date().toISOString();
        const fields: string[] = [];
        const args: any[] = [];
        for (const [key, value] of Object.entries(account)) {
            fields.push(`${key} = ?`);
            args.push(value);
        }
        if (fields.length === 0) return;
        args.push(now, id);
        await run(`UPDATE accounts SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`, args);
    },

    async delete(id: string): Promise<void> {
        await run('DELETE FROM accounts WHERE id = ?', [id]);
    }
};
