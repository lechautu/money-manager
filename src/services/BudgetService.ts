import { run } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

export interface Budget {
    id: string;
    month: string; // YYYY-MM
    category_id: string;
    sub_category_id?: string | null;
    amount: number;
    category_name: string;
    sub_category_name?: string | null;
    spent?: number; // Calculated field
}

export const BudgetService = {
    async getBudgetsForMonth(month: string): Promise<Budget[]> {
        const sql = `
            WITH CategorySpending AS (
                -- Direct
                SELECT category_id, sub_category_id, SUM(ABS(amount)) as spent
                FROM transactions
                WHERE month = ? AND status = 'posted' AND amount < 0 AND is_split = 0 AND deleted_at IS NULL
                GROUP BY category_id, sub_category_id
                UNION ALL
                -- Splits
                SELECT s.category_id, s.sub_category_id, SUM(ABS(s.amount)) as spent
                FROM transaction_splits s
                JOIN transactions t ON s.transaction_id = t.id
                WHERE t.month = ? AND t.status = 'posted' AND t.is_split = 1 AND t.deleted_at IS NULL
                GROUP BY s.category_id, s.sub_category_id
            ),
            AggregatedSpending AS (
                SELECT category_id, sub_category_id, SUM(spent) as total_spent
                FROM CategorySpending
                GROUP BY category_id, sub_category_id
            )
            SELECT 
                b.id,
                b.month,
                b.category_id,
                c.name as category_name,
                b.sub_category_id,
                sc.name as sub_category_name,
                b.amount,
                COALESCE(asp.total_spent, 0) as spent
            FROM budgets b
            JOIN categories c ON b.category_id = c.id
            LEFT JOIN sub_categories sc ON b.sub_category_id = sc.id
            LEFT JOIN AggregatedSpending asp ON asp.category_id = b.category_id 
                AND (
                    (b.sub_category_id IS NULL AND asp.sub_category_id IS NULL)
                    OR 
                    (b.sub_category_id = asp.sub_category_id)
                )
            WHERE b.month = ?
            ORDER BY c.sort_order, c.name, sc.sort_order, sc.name
        `;

        return await run(sql, [month, month, month]);
    },

    async setBudget(month: string, categoryId: string, subCategoryId: string | null, amount: number, id?: string): Promise<void> {
        // Handle precision
        const roundedAmount = Math.round(amount * 100) / 100;

        if (id && !id.startsWith('tmp-')) {
            await run('UPDATE budgets SET category_id = ?, sub_category_id = ?, amount = ? WHERE id = ?',
                [categoryId, subCategoryId, roundedAmount, id]);
            return;
        }

        const query = subCategoryId
            ? 'SELECT id FROM budgets WHERE month = ? AND category_id = ? AND sub_category_id = ?'
            : 'SELECT id FROM budgets WHERE month = ? AND category_id = ? AND sub_category_id IS NULL';

        const args = subCategoryId ? [month, categoryId, subCategoryId] : [month, categoryId];
        const existing = await run(query, args);

        if (existing.length > 0) {
            await run('UPDATE budgets SET amount = ? WHERE id = ?', [roundedAmount, existing[0].id]);
        } else {
            const newId = uuidv4();
            await run('INSERT INTO budgets (id, month, category_id, sub_category_id, amount) VALUES (?, ?, ?, ?, ?)',
                [newId, month, categoryId, subCategoryId, roundedAmount]);
        }
    },

    async deleteBudget(id: string): Promise<void> {
        await run('DELETE FROM budgets WHERE id = ?', [id]);
    },

    async getMonthSummary(month: string) {
        const budgets = await this.getBudgetsForMonth(month);
        const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
        const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);
        return { totalBudget, totalSpent };
    }
};


