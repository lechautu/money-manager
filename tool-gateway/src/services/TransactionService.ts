import { all, get, run, transaction } from '../db/client.js';
import { v4 as uuidv4 } from 'uuid';

export const TransactionService = {
    getAll(filter: Record<string, any> = {}) {
        const conditions: string[] = ['deleted_at IS NULL'];
        const params: any[] = [];

        if (filter.month) { conditions.push('month = ?'); params.push(filter.month); }
        if (filter.startDate) { conditions.push('date >= ?'); params.push(filter.startDate); }
        if (filter.endDate) { conditions.push('date <= ?'); params.push(filter.endDate); }
        if (filter.accountId) { conditions.push('(account_id = ? OR to_account_id = ?)'); params.push(filter.accountId, filter.accountId); }
        if (filter.categoryId) { conditions.push('category_id = ?'); params.push(filter.categoryId); }
        if (filter.subCategoryId) { conditions.push('sub_category_id = ?'); params.push(filter.subCategoryId); }
        if (filter.status) { conditions.push('status = ?'); params.push(filter.status); }
        if (filter.source) { conditions.push('source = ?'); params.push(filter.source); }
        if (filter.search) { conditions.push('note LIKE ?'); params.push(`%${filter.search}%`); }

        const sortBy = filter.sortBy || 'date';
        const sortOrder = filter.sortOrder || 'desc';
        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        return all(`SELECT * FROM transactions ${where} ORDER BY ${sortBy} ${sortOrder}`, params);
    },

    getById(id: string) {
        return get('SELECT * FROM transactions WHERE id = ?', [id]);
    },

    create(data: Record<string, any>) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const month = data.date?.substring(0, 7) || now.substring(0, 7);

        run(
            `INSERT INTO transactions (id, account_id, to_account_id, date, month, amount, category_id, sub_category_id, status, source, source_ref_id, is_split, note, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, data.account_id, data.to_account_id || null, data.date, month, data.amount, data.category_id || null, data.sub_category_id || null, data.status || 'posted', data.source || 'manual', data.source_ref_id || null, data.is_split || 0, data.note || null, now, now]
        );

        // Handle splits
        if (data.is_split && data.splitLines?.length > 0) {
            for (const split of data.splitLines) {
                run(
                    'INSERT INTO transaction_splits (id, transaction_id, category_id, sub_category_id, amount, note) VALUES (?, ?, ?, ?, ?, ?)',
                    [uuidv4(), id, split.category_id || null, split.sub_category_id || null, split.amount, split.note || null]
                );
            }
        }

        return get('SELECT * FROM transactions WHERE id = ?', [id]);
    },

    update(id: string, data: Record<string, any>) {
        const now = new Date().toISOString();
        const fields: string[] = [];
        const args: any[] = [];

        const allowed = ['account_id', 'to_account_id', 'date', 'amount', 'category_id', 'sub_category_id', 'status', 'source', 'note'];
        for (const key of allowed) {
            if (data[key] !== undefined) {
                fields.push(`${key} = ?`);
                args.push(data[key]);
            }
        }

        if (data.date) { fields.push('month = ?'); args.push(data.date.substring(0, 7)); }

        if (fields.length === 0) return;

        fields.push('updated_at = ?');
        args.push(now);
        args.push(id);
        run(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, args);
    },

    transfer(fromAccountId: string, toAccountId: string, amount: number, date: string, categoryId?: string, subCategoryId?: string, note?: string) {
        return transaction(() => {
            const id = uuidv4();
            const now = new Date().toISOString();
            const month = date.substring(0, 7);
            const negAmount = -Math.abs(amount);

            run(
                `INSERT INTO transactions (id, account_id, to_account_id, date, month, amount, category_id, sub_category_id, status, source, note, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'posted', 'transfer', ?, ?, ?)`,
                [id, fromAccountId, toAccountId, date, month, negAmount, categoryId || null, subCategoryId || null, note || null, now, now]
            );

            return get('SELECT * FROM transactions WHERE id = ?', [id]);
        });
    },

    delete(id: string) {
        run('UPDATE transactions SET deleted_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    },

    restore(id: string) {
        run('UPDATE transactions SET deleted_at = NULL WHERE id = ?', [id]);
    },

    bulkDelete(ids: string[]) {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        run(`UPDATE transactions SET deleted_at = ? WHERE id IN (${placeholders})`, [new Date().toISOString(), ...ids]);
    },

    bulkRestore(ids: string[]) {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        run(`UPDATE transactions SET deleted_at = NULL WHERE id IN (${placeholders})`, [...ids]);
    },

    getBalances() {
        const rows = all(`
            SELECT account_id, to_account_id, amount, status
            FROM transactions WHERE deleted_at IS NULL
        `);

        const balances: Record<string, { posted: number; effective: number }> = {};
        const accounts = all('SELECT id, initial_balance FROM accounts');

        for (const acc of accounts) {
            balances[acc.id] = { posted: acc.initial_balance || 0, effective: acc.initial_balance || 0 };
        }

        for (const row of rows) {
            if (!balances[row.account_id]) balances[row.account_id] = { posted: 0, effective: 0 };

            if (row.status === 'posted') {
                balances[row.account_id].posted += row.amount;
                balances[row.account_id].effective += row.amount;
            } else if (row.status === 'pending') {
                balances[row.account_id].effective += row.amount;
            }

            if (row.to_account_id) {
                if (!balances[row.to_account_id]) balances[row.to_account_id] = { posted: 0, effective: 0 };
                const incoming = Math.abs(row.amount);
                if (row.status === 'posted') {
                    balances[row.to_account_id].posted += incoming;
                    balances[row.to_account_id].effective += incoming;
                } else if (row.status === 'pending') {
                    balances[row.to_account_id].effective += incoming;
                }
            }
        }

        return balances;
    },
};
