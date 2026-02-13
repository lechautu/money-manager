import { run } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

export interface Budget {
    id: string;
    month: string; // YYYY-MM
    category_id: string;
    amount: number;
    category_name?: string;
    spent?: number; // Calculated field
}

export const BudgetService = {
    async getBudgetsForMonth(month: string): Promise<Budget[]> {
        // Init: ensure all categories have a budget row ? Or just return existing?
        // Let's return existing and join with categories.
        // Also need to calculate "spent" for that month/category.

        const sql = `
            SELECT 
                b.*,
                c.name as category_name,
                (
                    SELECT SUM(ABS(t.amount)) 
                    FROM transactions t 
                    WHERE t.month = ? 
                    AND t.category_id = b.category_id 
                    AND t.amount < 0
                    AND t.status = 'posted'
                ) as spent
            FROM budgets b
            JOIN categories c ON b.category_id = c.id
            WHERE b.month = ?
        `;

        return await run(sql, [month, month]);
    },

    async setBudget(month: string, categoryId: string, amount: number): Promise<void> {
        // Upsert logic
        // Check if exists
        const existing = await run('SELECT id FROM budgets WHERE month = ? AND category_id = ?', [month, categoryId]);

        if (existing.length > 0) {
            await run('UPDATE budgets SET amount = ? WHERE id = ?', [amount, existing[0].id]);
        } else {
            const id = uuidv4();
            await run('INSERT INTO budgets (id, month, category_id, amount) VALUES (?, ?, ?, ?)', [id, month, categoryId, amount]);
        }
    },

    // Helper to get total budget vs total spent for month
    async getMonthSummary(month: string) {
        const budgets = await this.getBudgetsForMonth(month);
        const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
        const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);
        return { totalBudget, totalSpent };
    }
};
