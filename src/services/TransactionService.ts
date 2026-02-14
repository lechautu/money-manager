import { run } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from './AuditService';

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
        let sql = 'SELECT t.*, c.name as category_name, sc.name as sub_category_name, a.name as account_name, a.currency, ta.name as to_account_name FROM transactions t ' +
            'LEFT JOIN categories c ON t.category_id = c.id ' +
            'LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id ' +
            'LEFT JOIN accounts a ON t.account_id = a.id ' +
            'LEFT JOIN accounts ta ON t.to_account_id = ta.id ' +
            'WHERE t.deleted_at IS NULL';
        const args: any[] = [];

        if (filter.month) {
            sql += ' AND t.month = ?';
            args.push(filter.month);
        }
        if (filter.startDate) {
            sql += ' AND t.date >= ?';
            args.push(filter.startDate);
        }
        if (filter.endDate) {
            sql += ' AND t.date <= ?';
            args.push(filter.endDate);
        }
        if (filter.accountId) {
            sql += ' AND t.account_id = ?';
            args.push(filter.accountId);
        }
        if (filter.categoryId) {
            // For split transactions, check both main category and split categories
            sql += ` AND (t.category_id = ? OR (t.is_split = 1 AND t.id IN (SELECT transaction_id FROM transaction_splits WHERE category_id = ?)))`;
            args.push(filter.categoryId, filter.categoryId);
        }
        if (filter.subCategoryId) {
            sql += ` AND (t.sub_category_id = ? OR (t.is_split = 1 AND t.id IN (SELECT transaction_id FROM transaction_splits WHERE sub_category_id = ?)))`;
            args.push(filter.subCategoryId, filter.subCategoryId);
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

        const txs: Transaction[] = await run(sql, args);
        if (txs.length === 0) return [];

        const splitTxIds = txs.filter(t => t.is_split).map(t => t.id);
        if (splitTxIds.length > 0) {
            const splits = await run(`SELECT * FROM transaction_splits WHERE transaction_id IN (${splitTxIds.map(() => '?').join(',')})`, splitTxIds);
            const splitsMap: Record<string, TransactionSplit[]> = {};
            splits.forEach((s: TransactionSplit) => {
                if (!splitsMap[s.transaction_id]) splitsMap[s.transaction_id] = [];
                splitsMap[s.transaction_id].push(s);
            });
            txs.forEach(t => {
                if (t.is_split && splitsMap[t.id]) {
                    t.splitLines = splitsMap[t.id];
                }
            });
        }
        return txs;
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
            (id, account_id, date, month, amount, category_id, sub_category_id, status, note, source, source_ref_id, is_split, created_at, updated_at, to_account_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newTx.id, newTx.account_id, newTx.date, newTx.month, newTx.amount,
                newTx.category_id || null, newTx.sub_category_id || null, newTx.status, newTx.note,
                newTx.source, newTx.source_ref_id, newTx.is_split || 0, newTx.created_at, newTx.updated_at,
                newTx.to_account_id || null
            ]
        );

        if (newTx.is_split && newTx.splitLines && newTx.splitLines.length > 0) {
            for (const split of newTx.splitLines) {
                const splitId = uuidv4();
                await run(
                    `INSERT INTO transaction_splits (id, transaction_id, category_id, sub_category_id, amount, note) VALUES (?, ?, ?, ?, ?, ?)`,
                    [splitId, newTx.id, split.category_id, split.sub_category_id || null, split.amount, split.note || null]
                );
            }
        }

        await AuditService.log('transaction_create', 'transaction', newTx.id, { amount: newTx.amount, note: newTx.note });
        return newTx;
    },

    async update(id: string, tx: Partial<Omit<Transaction, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
        const now = new Date().toISOString();
        const fields: string[] = [];
        const args: any[] = [];

        const keys = Object.keys(tx) as (keyof typeof tx)[];
        for (const key of keys) {
            if (key === 'splitLines') continue;
            fields.push(`${key} = ?`);
            args.push(tx[key]);
        }

        if (fields.length > 0) {
            fields.push('updated_at = ?');
            args.push(now);
            args.push(id);
            await run(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, args);
        }

        // Handle Splits Update
        if (tx.is_split !== undefined || (tx.splitLines && tx.splitLines.length > 0)) {
            if (tx.splitLines) {
                await run('DELETE FROM transaction_splits WHERE transaction_id = ?', [id]);
                if (tx.is_split) {
                    for (const split of tx.splitLines) {
                        const splitId = uuidv4();
                        await run(
                            `INSERT INTO transaction_splits (id, transaction_id, category_id, sub_category_id, amount, note) VALUES (?, ?, ?, ?, ?, ?)`,
                            [splitId, id, split.category_id, split.sub_category_id || null, split.amount, split.note || null]
                        );
                    }
                }
            } else if (tx.is_split === 0) {
                await run('DELETE FROM transaction_splits WHERE transaction_id = ?', [id]);
            }
        }

        await AuditService.log('transaction_update', 'transaction', id, tx);
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
            is_split: 0,
            created_at: now,
            updated_at: now
        };

        await run(
            `INSERT INTO transactions 
            (id, account_id, to_account_id, date, month, amount, category_id, sub_category_id, status, note, source, source_ref_id, is_split, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newTx.id, newTx.account_id, newTx.to_account_id, newTx.date, newTx.month, newTx.amount,
                newTx.category_id, newTx.sub_category_id, newTx.status, newTx.note,
                newTx.source, newTx.source_ref_id, 0, newTx.created_at, newTx.updated_at
            ]
        );

        await AuditService.log('transaction_create', 'transaction', newTx.id, { type: 'transfer', amount: amount, from: fromAccountId, to: toAccountId });
        return newTx;
    },

    async delete(id: string): Promise<void> {
        const now = new Date().toISOString();
        const tx = await this.getById(id);
        if (!tx) return;

        await run('BEGIN TRANSACTION');
        try {
            // 1. Unlink from installment payments (if any)
            await run('UPDATE installment_payments SET status = ?, paid_at = NULL, linked_transaction_id = NULL WHERE linked_transaction_id = ?', ['upcoming', id]);

            // 2. Unlink from recurring instances (if generated from one) but keep record
            // No action needed for recurring_instances as we want to preserve history/link

            // 3. Soft Delete transaction
            await run('UPDATE transactions SET deleted_at = ? WHERE id = ?', [now, id]);

            await AuditService.log('transaction_delete', 'transaction', id, { amount: tx.amount, note: tx.note });
            await run('COMMIT');
        } catch (error) {
            await run('ROLLBACK');
            throw error;
        }
    },

    async restore(id: string): Promise<void> {
        await run('BEGIN TRANSACTION');
        try {
            // 1. Restore Transaction
            await run('UPDATE transactions SET deleted_at = NULL WHERE id = ?', [id]);

            // 2. Relink Installment (Best Effort)
            await run(`
                UPDATE installment_payments 
                SET status = 'paid', paid_at = (SELECT date FROM transactions WHERE id = ?), linked_transaction_id = ?
                WHERE generated_transaction_id = ?
            `, [id, id, id]);

            await AuditService.log('transaction_restore', 'transaction', id);
            await run('COMMIT');
        } catch (error) {
            await run('ROLLBACK');
            throw error;
        }
    },

    async getBalances(): Promise<Record<string, { posted: number, effective: number }>> {
        // 1. Standard balances (Account Owner, includes Transfer Out)
        const rowsMain = await run(`
            SELECT 
                t.account_id,
                SUM(CASE WHEN t.status = 'posted' THEN t.amount ELSE 0 END) as posted,
                SUM(CASE WHEN t.status IN ('posted', 'pending') THEN t.amount ELSE 0 END) as effective
            FROM transactions t
            WHERE t.deleted_at IS NULL
            GROUP BY t.account_id
        `);

        // 2. Incoming Transfers (Account Destination)
        const rowsIncoming = await run(`
            SELECT 
                t.to_account_id as account_id,
                SUM(CASE WHEN t.status = 'posted' THEN ABS(t.amount) ELSE 0 END) as posted,
                SUM(CASE WHEN t.status IN ('posted', 'pending') THEN ABS(t.amount) ELSE 0 END) as effective
            FROM transactions t
            WHERE t.to_account_id IS NOT NULL AND t.deleted_at IS NULL
            GROUP BY t.to_account_id
        `);

        const result: Record<string, { posted: number, effective: number }> = {};

        const processRow = (row: any, isIncome: boolean) => {
            if (!row.posted) row.posted = 0;
            if (!row.effective) row.effective = 0;
            if (!result[row.account_id]) result[row.account_id] = { posted: 0, effective: 0 };
            result[row.account_id].posted += isIncome ? row.posted : row.posted;
            result[row.account_id].effective += isIncome ? row.effective : row.effective;
        };

        rowsMain.forEach((r: any) => processRow(r, false));
        rowsIncoming.forEach((r: any) => processRow(r, true));

        // 3. Add Initial Balances
        const accounts = await run('SELECT id, initial_balance FROM accounts');
        accounts.forEach((acc: any) => {
            if (!result[acc.id]) result[acc.id] = { posted: 0, effective: 0 };
            result[acc.id].posted += acc.initial_balance;
            result[acc.id].effective += acc.initial_balance;
        });

        return result;
    },

    async bulkDelete(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        const now = new Date().toISOString();
        const placeholders = ids.map(() => '?').join(',');

        await run('BEGIN TRANSACTION');
        try {
            // Unlink installments
            await run(`UPDATE installment_payments SET status = 'upcoming', paid_at = NULL, linked_transaction_id = NULL WHERE linked_transaction_id IN (${placeholders})`, ids);

            // Soft Delete
            await run(`UPDATE transactions SET deleted_at = ? WHERE id IN (${placeholders})`, [now, ...ids]);

            await AuditService.log('transaction_bulk_delete', 'transaction', undefined, { count: ids.length, ids });
            await run('COMMIT');
        } catch (e) {
            await run('ROLLBACK');
            throw e;
        }
    },

    async bulkRestore(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');

        await run('BEGIN TRANSACTION');
        try {
            await run(`UPDATE transactions SET deleted_at = NULL WHERE id IN (${placeholders})`, ids);
            await AuditService.log('transaction_bulk_restore', 'transaction', undefined, { count: ids.length, ids });
            await run('COMMIT');
        } catch (e) {
            await run('ROLLBACK');
            throw e;
        }
    },

    async bulkUpdate(ids: string[], updates: Partial<Pick<Transaction, 'account_id' | 'status'>>): Promise<void> {
        const fields: string[] = [];
        const args: any[] = [];
        const now = new Date().toISOString();

        if (updates.account_id) {
            fields.push('account_id = ?');
            args.push(updates.account_id);
        }
        if (updates.status) {
            fields.push('status = ?');
            args.push(updates.status);
        }

        if (fields.length === 0) return;

        fields.push('updated_at = ?');
        args.push(now);

        const placeholders = ids.map(() => '?').join(',');
        args.push(...ids);

        await run(`UPDATE transactions SET ${fields.join(', ')} WHERE id IN (${placeholders})`, args);
    }
};
