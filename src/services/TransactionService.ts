import { run } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

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
    created_at: string;
    updated_at: string;
}

export type TransactionFilter = {
    month?: string;
    accountId?: string;
    categoryId?: string;
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
        let sql = 'SELECT t.*, c.name as category_name, sc.name as sub_category_name, a.name as account_name, a.currency, ta.name as to_account_name FROM transactions t ' +
            'LEFT JOIN categories c ON t.category_id = c.id ' +
            'LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id ' +
            'LEFT JOIN accounts a ON t.account_id = a.id ' +
            'LEFT JOIN accounts ta ON t.to_account_id = ta.id ' +
            'WHERE 1=1';
        const args: any[] = [];

        if (filter.month) {
            sql += ' AND t.month = ?';
            args.push(filter.month);
        }
        if (filter.accountId) {
            // For transfers, we want to show the transaction if it is EITHER the source OR the destination
            sql += ' AND (t.account_id = ? OR t.to_account_id = ?)';
            args.push(filter.accountId, filter.accountId);
        }
        if (filter.categoryId) {
            sql += ' AND t.category_id = ?';
            args.push(filter.categoryId);
        }
        if (filter.status) {
            sql += ' AND t.status = ?';
            args.push(filter.status);
        }
        if (filter.source) {
            sql += ' AND t.source = ?';
            args.push(filter.source);
        }
        if (filter.excludeSource && filter.excludeSource.length > 0) {
            sql += ` AND t.source NOT IN (${filter.excludeSource.map(() => '?').join(',')})`;
            args.push(...filter.excludeSource);
        }
        if (filter.excludeLinkedToInstallments) {
            sql += ' AND t.id NOT IN (SELECT linked_transaction_id FROM installment_payments WHERE linked_transaction_id IS NOT NULL)';
        }
        if (filter.search) {
            sql += ' AND t.note LIKE ?';
            args.push(`%${filter.search}%`);
        }

        const sortCol = filter.sortBy || 'date';
        const sortOrd = filter.sortOrder || 'desc';
        // Validate sortCol to prevent injection
        const validCols = ['date', 'amount'];
        const validOrds = ['asc', 'desc'];

        const finalCol = validCols.includes(sortCol) ? `t.${sortCol}` : 't.date';
        const finalOrd = validOrds.includes(sortOrd) ? sortOrd : 'desc';

        sql += ` ORDER BY ${finalCol} ${finalOrd}, t.created_at DESC`;
        return await run(sql, args);
    },

    async getById(id: string): Promise<Transaction | null> {
        const rows = await run('SELECT * FROM transactions WHERE id = ?', [id]);
        return rows.length > 0 ? rows[0] : null;
    },

    async create(tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<Transaction> {
        const id = uuidv4();
        const now = new Date().toISOString();
        const newTx: Transaction = { ...tx, id, created_at: now, updated_at: now };

        await run(
            `INSERT INTO transactions 
            (id, account_id, date, month, amount, category_id, sub_category_id, status, note, source, source_ref_id, created_at, updated_at, to_account_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newTx.id, newTx.account_id, newTx.date, newTx.month, newTx.amount,
                newTx.category_id, newTx.sub_category_id, newTx.status, newTx.note,
                newTx.source, newTx.source_ref_id, newTx.created_at, newTx.updated_at,
                newTx.to_account_id || null
            ]
        );
        return newTx;
    },

    async update(id: string, tx: Partial<Omit<Transaction, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
        const now = new Date().toISOString();
        const fields: string[] = [];
        const args: any[] = [];

        const keys = Object.keys(tx) as (keyof typeof tx)[];
        for (const key of keys) {
            if ((key as string) === 'created_at' || (key as string) === 'updated_at' || (key as string) === 'id') continue;
            fields.push(`${key} = ?`);
            args.push(tx[key]);
        }

        if (fields.length === 0) return;

        fields.push('updated_at = ?');
        args.push(now);
        args.push(id);

        await run(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, args);
    },

    async transfer(fromAccountId: string, toAccountId: string, amount: number, date: string, categoryId: string, subCategoryId: string | undefined, note?: string): Promise<Transaction> {
        const now = new Date().toISOString();
        const month = date.slice(0, 7);
        const id = uuidv4();

        const newTx: Transaction = {
            id,
            account_id: fromAccountId,
            to_account_id: toAccountId,
            date,
            month,
            amount: -amount,
            category_id: categoryId,
            sub_category_id: subCategoryId || null,
            status: 'posted',
            note: note || 'Transfer',
            source: 'transfer',
            source_ref_id: null,
            created_at: now,
            updated_at: now
        };

        // Create Single Transfer Transaction (Expense side, linking to destination)
        await run(
            `INSERT INTO transactions 
            (id, account_id, to_account_id, date, month, amount, category_id, sub_category_id, status, note, source, source_ref_id, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newTx.id, newTx.account_id, newTx.to_account_id, newTx.date, newTx.month, newTx.amount,
                newTx.category_id, newTx.sub_category_id, newTx.status, newTx.note,
                newTx.source, newTx.source_ref_id, newTx.created_at, newTx.updated_at
            ]
        );
        return newTx;
    },

    async delete(id: string): Promise<void> {
        await run('BEGIN TRANSACTION');
        try {
            // 1. Unlink from installment payments
            // Check if there is a linked payment
            const linkedPayments = await run('SELECT * FROM installment_payments WHERE linked_transaction_id = ?', [id]);
            if (linkedPayments.length > 0) {
                // Reset payment status
                // We could calculate if it is overdue or upcoming, but for simplicity let's set to 'upcoming'
                // and let the checkOverdue logic handle it on next load, or we check date now.
                for (const p of linkedPayments) {
                    const today = new Date().toISOString().slice(0, 10);
                    let newStatus = 'upcoming';
                    if (p.due_date < today) newStatus = 'overdue';
                    else if (p.due_date === today) newStatus = 'due';

                    await run(
                        'UPDATE installment_payments SET status = ?, paid_at = NULL, linked_transaction_id = NULL WHERE id = ?',
                        [newStatus, p.id]
                    );
                }
            }

            // 2. Remove recurrence instance record if exists
            await run('DELETE FROM recurring_instances WHERE generated_transaction_id = ?', [id]);

            // 3. Delete the transaction
            await run('DELETE FROM transactions WHERE id = ?', [id]);

            await run('COMMIT');
        } catch (error) {
            await run('ROLLBACK');
            throw error;
        }
    },

    async getBalances(): Promise<Record<string, { posted: number, effective: number }>> {
        // 1. Standard balances (Account Owner, includes Transfer Out)
        const sqlMain = `
            SELECT 
                t.account_id,
                SUM(CASE WHEN t.status = 'posted' THEN t.amount ELSE 0 END) as posted,
                SUM(CASE WHEN t.status IN ('posted', 'pending') THEN t.amount ELSE 0 END) as effective
            FROM transactions t
            GROUP BY t.account_id
        `;
        const rowsMain = await run(sqlMain);

        // 2. Incoming Transfers (Account Destination)
        const sqlIncoming = `
            SELECT 
                t.to_account_id as account_id,
                SUM(CASE WHEN t.status = 'posted' THEN ABS(t.amount) ELSE 0 END) as posted,
                SUM(CASE WHEN t.status IN ('posted', 'pending') THEN ABS(t.amount) ELSE 0 END) as effective
            FROM transactions t
            WHERE t.to_account_id IS NOT NULL
            GROUP BY t.to_account_id
        `;
        const rowsIncoming = await run(sqlIncoming);

        const result: Record<string, { posted: number, effective: number }> = {};

        // Merge results
        for (const row of rowsMain) {
            result[row.account_id] = { posted: row.posted, effective: row.effective };
        }

        for (const row of rowsIncoming) {
            if (!result[row.account_id]) {
                result[row.account_id] = { posted: 0, effective: 0 };
            }
            result[row.account_id].posted += row.posted;
            result[row.account_id].effective += row.effective;
        }

        return result;
    }
};
