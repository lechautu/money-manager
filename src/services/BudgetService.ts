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
        // 1. Total Budget defined for the month
        const budgets = await run('SELECT SUM(amount) as totalBudget FROM budgets WHERE month = ?', [month]);
        const totalBudget = budgets[0]?.totalBudget || 0;

        // 2. Total Monthly Spending (regardless of whether a budget exists for the category)
        const spending = await run(`
            SELECT SUM(ABS(amount)) as totalSpent
            FROM transactions
            WHERE month = ? 
              AND status = 'posted' 
              AND amount < 0 
              AND (source != 'transfer' OR source IS NULL)
              AND deleted_at IS NULL
        `, [month]);
        const totalSpent = spending[0]?.totalSpent || 0;

        return { totalBudget, totalSpent };
    },

    async generateBudgetsFromAutomation(month: string): Promise<void> {
        const year = parseInt(month.split('-')[0]);
        const m = parseInt(month.split('-')[1]) - 1;
        const startOfMonthDate = new Date(year, m, 1);
        const endOfMonthDate = endOfMonth(startOfMonthDate);

        const automatedCosts: Record<string, { category_id: string, sub_category_id: string | null, amount: number }> = {};

        const addCost = (catId: string, subCatId: string | null, amount: number) => {
            const key = `${catId}-${subCatId || 'root'}`;
            if (!automatedCosts[key]) {
                automatedCosts[key] = { category_id: catId, sub_category_id: subCatId, amount: 0 };
            }
            automatedCosts[key].amount += Math.abs(amount);
        };

        // 1. Recurring Rules
        const rules = await run("SELECT * FROM recurring_rules WHERE is_active = 1 AND type = 'expense'");
        for (const rule of rules) {
            let current = parseISO(rule.start_date);
            const endDateLimit = rule.end_date ? parseISO(rule.end_date) : null;

            // Advance to start of month
            while (isBefore(current, startOfMonthDate)) {
                current = RecurringService.getNextDate(current, rule.frequency);
            }

            // Count occurrences in this month
            while (!isAfter(current, endOfMonthDate)) {
                if (endDateLimit && isAfter(current, endDateLimit)) break;

                // Final check: is this instance in our target month?
                if (format(current, 'yyyy-MM') === month) {
                    addCost(rule.category_id, rule.sub_category_id, rule.amount);
                }

                current = RecurringService.getNextDate(current, rule.frequency);
                // Safety break
                if (isAfter(current, addYears(endOfMonthDate, 1))) break;
            }
        }

        // 2. Installments
        const installments = await run(`
            SELECT p.amount, pl.payment_category_id, pl.payment_sub_category_id 
            FROM installment_payments p
            JOIN installment_plans pl ON p.plan_id = pl.id
            WHERE p.due_month = ?
        `, [month]);

        for (const inst of installments) {
            addCost(inst.payment_category_id, inst.payment_sub_category_id, inst.amount);
        }

        // 3. Upsert into budgets
        for (const group of Object.values(automatedCosts)) {
            await this.setBudget(month, group.category_id, group.sub_category_id, group.amount);
        }
    },

    async cloneMonthBudget(sourceMonth: string, targetMonth: string): Promise<void> {
        const sourceBudgets = await run('SELECT * FROM budgets WHERE month = ?', [sourceMonth]);
        if (sourceBudgets.length === 0) return;

        for (const b of sourceBudgets) {
            await this.setBudget(targetMonth, b.category_id, b.sub_category_id, b.amount);
        }
    },

    async clearMonthBudgets(month: string): Promise<void> {
        await run('DELETE FROM budgets WHERE month = ?', [month]);
    },

    async bulkDeleteBudgets(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        const placeholders = ids.map(() => '?').join(',');
        await run(`DELETE FROM budgets WHERE id IN (${placeholders})`, ids);
    }
};

import { endOfMonth, isAfter, isBefore, parseISO, format, addYears } from 'date-fns';
import { RecurringService } from './RecurringService';


