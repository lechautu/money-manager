import { all, get, run, transaction } from '../db/client.js';
import { v4 as uuidv4 } from 'uuid';

export const TransactionService = {
    getAll(filter: Record<string, any> = {}) {
        const conditions: string[] = ['t.deleted_at IS NULL'];
        const params: any[] = [];

        if (filter.month) { conditions.push('t.month = ?'); params.push(filter.month); }
        if (filter.startDate) { conditions.push('t.date >= ?'); params.push(filter.startDate); }
        if (filter.endDate) { conditions.push('t.date <= ?'); params.push(filter.endDate); }
        if (filter.accountId) { conditions.push('(t.account_id = ? OR t.to_account_id = ?)'); params.push(filter.accountId, filter.accountId); }
        if (filter.categoryId) { conditions.push('t.category_id = ?'); params.push(filter.categoryId); }
        if (filter.subCategoryId) { conditions.push('t.sub_category_id = ?'); params.push(filter.subCategoryId); }
        if (filter.status) { conditions.push('t.status = ?'); params.push(filter.status); }
        if (filter.source) { conditions.push('t.source = ?'); params.push(filter.source); }
        if (filter.payeeId) { conditions.push('t.payee_id = ?'); params.push(filter.payeeId); }
        if (filter.search) { conditions.push('(t.note LIKE ? OR py.name LIKE ?)'); params.push(`%${filter.search}%`, `%${filter.search}%`); }

        const sortBy = filter.sortBy || 'date';
        const sortOrder = filter.sortOrder || 'desc';
        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        return all(`
            SELECT t.*, 
                   r.name as recurring_name,
                   ip.name as installment_plan_name,
                   p.due_month as installment_period,
                   py.name as payee_name
            FROM transactions t
            LEFT JOIN recurring_rules r ON t.source = 'recurring' AND t.source_ref_id = r.id
            LEFT JOIN installment_payments p ON t.source = 'installment' AND t.source_ref_id = p.id
            LEFT JOIN installment_plans ip ON p.plan_id = ip.id
            LEFT JOIN payees py ON t.payee_id = py.id
            ${where} 
            ORDER BY t.${sortBy} ${sortOrder}
        `, params);
    },

    getById(id: string) {
        return get('SELECT * FROM transactions WHERE id = ?', [id]);
    },

    create(data: Record<string, any>) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const month = data.date?.substring(0, 7) || now.substring(0, 7);

        // Enforce negative amount for transfers (money leaving the primary account)
        let amount = data.amount;
        if (data.to_account_id && amount > 0) {
            amount = -amount;
        }

        run(
            `INSERT INTO transactions (id, account_id, to_account_id, date, month, amount, category_id, sub_category_id, status, source, source_ref_id, is_split, note, payee_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, data.account_id, data.to_account_id || null, data.date, month, amount, data.category_id || null, data.sub_category_id || null, data.status || 'posted', data.source || 'manual', data.source_ref_id || null, data.is_split || 0, data.note || null, data.payee_id || null, now, now]
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

        // If it's a transfer (either now has to_account_id or previously had one and amount is being changed)
        // We ensure consistency. Note: For full consistency we'd check previous state, 
        // but checking the update payload is a good first step.
        let amount = data.amount;
        if (data.to_account_id !== undefined && amount !== undefined) {
            if (data.to_account_id && amount > 0) {
                amount = -amount;
            }
        }

        const allowed = ['account_id', 'to_account_id', 'date', 'amount', 'category_id', 'sub_category_id', 'status', 'source', 'note', 'payee_id'];
        for (const key of allowed) {
            if (key === 'amount' && amount !== undefined) {
                fields.push('amount = ?');
                args.push(amount);
                continue;
            }

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

    delete(id: string, options: { disableAutoAdd?: boolean } = {}) {
        const now = new Date().toISOString();
        const today = now.substring(0, 10);
        transaction(() => {
            const tx = get('SELECT source, source_ref_id FROM transactions WHERE id = ?', [id]);
            run('UPDATE transactions SET deleted_at = ? WHERE id = ?', [now, id]);

            if (options.disableAutoAdd && tx) {
                if (tx.source === 'recurring' && tx.source_ref_id) {
                    run('UPDATE recurring_rules SET auto_add = 0 WHERE id = ?', [tx.source_ref_id]);
                } else if (tx.source === 'installment' && tx.source_ref_id) {
                    run('UPDATE installment_plans SET auto_add = 0 WHERE id = (SELECT plan_id FROM installment_payments WHERE id = ?)', [tx.source_ref_id]);
                }
            }

            // Reset installment payment status if the transaction was a payment
            const paidPayments = all<any>('SELECT id, due_date FROM installment_payments WHERE generated_transaction_id = ? OR linked_transaction_id = ?', [id, id]);
            for (const p of paidPayments) {
                const status = p.due_date < today ? 'overdue' : (p.due_date === today ? 'due' : 'upcoming');
                run('UPDATE installment_payments SET status = ?, generated_transaction_id = NULL, linked_transaction_id = NULL, paid_at = NULL WHERE id = ?', [status, p.id]);
            }

            // Clear other references
            run('UPDATE installment_payments SET expense_transaction_id = NULL WHERE expense_transaction_id = ?', [id]);
            run('UPDATE recurring_instances SET generated_transaction_id = NULL WHERE generated_transaction_id = ?', [id]);
        });
    },

    restore(id: string) {
        run('UPDATE transactions SET deleted_at = NULL WHERE id = ?', [id]);
    },

    bulkDelete(ids: string[], options: { disableAutoAdd?: boolean } = {}) {
        if (ids.length === 0) return;
        const now = new Date().toISOString();
        const today = now.substring(0, 10);
        transaction(() => {
            const placeholders = ids.map(() => '?').join(',');

            if (options.disableAutoAdd) {
                const txs = all(`SELECT source, source_ref_id FROM transactions WHERE id IN (${placeholders})`, ids);
                for (const tx of txs) {
                    if (tx.source === 'recurring' && tx.source_ref_id) {
                        run('UPDATE recurring_rules SET auto_add = 0 WHERE id = ?', [tx.source_ref_id]);
                    } else if (tx.source === 'installment' && tx.source_ref_id) {
                        run('UPDATE installment_plans SET auto_add = 0 WHERE id = (SELECT plan_id FROM installment_payments WHERE id = ?)', [tx.source_ref_id]);
                    }
                }
            }

            run(`UPDATE transactions SET deleted_at = ? WHERE id IN (${placeholders})`, [now, ...ids]);

            // Reset installment payment status
            const paidPayments = all<any>(`SELECT id, due_date FROM installment_payments WHERE generated_transaction_id IN (${placeholders}) OR linked_transaction_id IN (${placeholders})`, [...ids, ...ids]);
            for (const p of paidPayments) {
                const status = p.due_date < today ? 'overdue' : (p.due_date === today ? 'due' : 'upcoming');
                run('UPDATE installment_payments SET status = ?, generated_transaction_id = NULL, linked_transaction_id = NULL, paid_at = NULL WHERE id = ?', [status, p.id]);
            }

            // Clear other references
            run(`UPDATE installment_payments SET expense_transaction_id = NULL WHERE expense_transaction_id IN (${placeholders})`, [...ids]);
            run(`UPDATE recurring_instances SET generated_transaction_id = NULL WHERE generated_transaction_id IN (${placeholders})`, [...ids]);
        });
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
                // The to_account_id always receives the opposite of the amount (Transfer Out -> -amount, Transfer In -> +amount)
                const incoming = -row.amount;
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
