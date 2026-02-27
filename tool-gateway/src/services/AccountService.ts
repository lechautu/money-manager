import { all, get, run, transaction } from '../db/client.js';
import { v4 as uuidv4 } from 'uuid';

export const AccountService = {
    getAll() {
        return all('SELECT * FROM accounts ORDER BY name');
    },

    getById(id: string) {
        return get('SELECT * FROM accounts WHERE id = ?', [id]);
    },

    create(data: { name: string; type: string; currency: string; initial_balance?: number; note?: string }) {
        const id = uuidv4();
        const now = new Date().toISOString();
        run(
            'INSERT INTO accounts (id, name, type, currency, initial_balance, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, data.name, data.type, data.currency, data.initial_balance || 0, data.note || null, now, now]
        );
        return get('SELECT * FROM accounts WHERE id = ?', [id]);
    },

    update(id: string, data: Partial<{ name: string; type: string; currency: string; initial_balance: number; note: string }>) {
        const now = new Date().toISOString();
        const fields: string[] = [];
        const args: any[] = [];

        if (data.name !== undefined) { fields.push('name = ?'); args.push(data.name); }
        if (data.type !== undefined) { fields.push('type = ?'); args.push(data.type); }
        if (data.currency !== undefined) { fields.push('currency = ?'); args.push(data.currency); }
        if (data.initial_balance !== undefined) { fields.push('initial_balance = ?'); args.push(data.initial_balance); }
        if (data.note !== undefined) { fields.push('note = ?'); args.push(data.note); }

        if (fields.length === 0) return;

        fields.push('updated_at = ?');
        args.push(now);
        args.push(id);
        run(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, args);
    },

    delete(id: string) {
        const recurring = all('SELECT id FROM recurring_rules WHERE account_id = ? OR to_account_id = ? LIMIT 1', [id, id]);
        if (recurring.length > 0) throw new Error('Cannot delete account: It is used in Recurring Rules.');

        const installments = all('SELECT id FROM installment_plans WHERE credit_account_id = ? OR payment_source_account_id = ? LIMIT 1', [id, id]);
        if (installments.length > 0) throw new Error('Cannot delete account: It is used in Installment Plans.');

        const txs = all('SELECT id FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND deleted_at IS NULL LIMIT 1', [id, id]);
        if (txs.length > 0) throw new Error('Cannot delete account: It has active transactions.');

        transaction(() => {
            run('DELETE FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND deleted_at IS NOT NULL', [id, id]);
            run('DELETE FROM accounts WHERE id = ?', [id]);
        });
    },
};
