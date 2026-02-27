import { run } from '../../db/client';
import { v4 as uuidv4 } from 'uuid';

export const LocalTransactionService = {
    async getBalances(): Promise<Record<string, { posted: number, effective: number }>> {
        const rows = await run(`
            SELECT a.id, a.initial_balance,
            COALESCE(SUM(CASE WHEN t.status != 'ignored' THEN t.amount ELSE 0 END), 0) as posted,
            COALESCE(SUM(t.amount), 0) as effective
            FROM accounts a
            LEFT JOIN transactions t ON a.id = t.account_id AND t.deleted_at IS NULL
            GROUP BY a.id, a.initial_balance
        `);

        const result: Record<string, { posted: number, effective: number }> = {};
        rows.forEach((row: any) => {
            result[row.id] = {
                posted: (row.posted || 0) + (row.initial_balance || 0),
                effective: (row.effective || 0) + (row.initial_balance || 0)
            };
        });
        return result;
    },

    async getAll(parameters: any): Promise<any[]> {
        let sql = "SELECT * FROM transactions WHERE deleted_at IS NULL";
        const args: any[] = [];
        if (parameters.accountId) {
            sql += " AND account_id = ?";
            args.push(parameters.accountId);
        }
        if (parameters.month) {
            sql += " AND month = ?";
            args.push(parameters.month);
        }
        if (parameters.status) {
            sql += " AND status = ?";
            args.push(parameters.status);
        }

        const limit = parameters.limit || 100;
        const sortBy = parameters.sortBy || 'date';
        const sortOrder = parameters.sortOrder || 'desc';

        sql += ` ORDER BY ${sortBy} ${sortOrder} LIMIT ?`;
        args.push(limit);

        return await run(sql, args);
    },

    async create(tx: any) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const month = tx.date.substring(0, 7);
        await run(
            `INSERT INTO transactions (id, account_id, to_account_id, date, month, amount, category_id, sub_category_id, status, source, note, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, tx.account_id, tx.to_account_id || null, tx.date, month, tx.amount, tx.category_id || null, tx.sub_category_id || null, tx.status || 'posted', tx.source || 'manual', tx.note || null, now, now]
        );
        return { id, ...tx };
    },

    async update(id: string, tx: any) {
        const now = new Date().toISOString();
        const fields: string[] = [];
        const args: any[] = [];
        for (const [key, value] of Object.entries(tx)) {
            fields.push(`${key} = ?`);
            args.push(value);
        }
        if (fields.length === 0) return;
        args.push(now, id);
        await run(`UPDATE transactions SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`, args);
    },

    async delete(id: string) {
        const now = new Date().toISOString();
        await run('UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
    },

    async bulkDelete(ids: string[]) {
        const now = new Date().toISOString();
        for (const id of ids) {
            await run('UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
        }
    },

    async transfer(_from: string, _to: string, _amount: number, _date: string, _cat?: string, _sub?: string, _note?: string) {
        // stub
    },

    async restore(_id: string) {
        // stub
    },

    async bulkRestore(_ids: string[]) {
        // stub
    }
};
