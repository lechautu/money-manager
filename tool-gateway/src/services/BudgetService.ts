import { all, get, run } from '../db/client.js';
import { v4 as uuidv4 } from 'uuid';

export const BudgetService = {
    getBudgetsForMonth(month: string) {
        return all(`
            SELECT 
                b.*,
                c.name as category_name,
                sc.name as sub_category_name,
                (
                    SELECT COALESCE(SUM(ABS(amount)), 0)
                    FROM transactions t
                    WHERE t.month = b.month 
                      AND t.category_id = b.category_id
                      AND (
                          (b.sub_category_id IS NOT NULL AND t.sub_category_id = b.sub_category_id)
                          OR 
                          (b.sub_category_id IS NULL AND (
                              t.sub_category_id IS NULL 
                              OR t.sub_category_id NOT IN (
                                  SELECT sub_category_id 
                                  FROM budgets b2 
                                  WHERE b2.month = b.month 
                                    AND b2.category_id = b.category_id 
                                    AND b2.sub_category_id IS NOT NULL
                              )
                          ))
                      )
                      AND t.amount < 0 
                      AND t.source != 'transfer' 
                      AND t.deleted_at IS NULL 
                      AND t.status != 'ignored'
                ) as spent
            FROM budgets b
            LEFT JOIN categories c ON b.category_id = c.id
            LEFT JOIN sub_categories sc ON b.sub_category_id = sc.id
            WHERE b.month = ?
        `, [month]);
    },

    setBudget(month: string, categoryId: string, subCategoryId: string | null, amount: number) {
        const existing = get(
            'SELECT id FROM budgets WHERE month = ? AND category_id = ? AND sub_category_id IS ?',
            [month, categoryId, subCategoryId]
        );

        if (existing) {
            run('UPDATE budgets SET amount = ? WHERE id = ?', [amount, existing.id]);
            return existing;
        } else {
            const id = uuidv4();
            run(
                'INSERT INTO budgets (id, month, category_id, sub_category_id, amount) VALUES (?, ?, ?, ?, ?)',
                [id, month, categoryId, subCategoryId, amount]
            );
            return { id };
        }
    },

    deleteBudget(id: string) {
        run('DELETE FROM budgets WHERE id = ?', [id]);
    },

    clearMonthBudgets(month: string) {
        run('DELETE FROM budgets WHERE month = ?', [month]);
    },

    cloneMonthBudget(sourceMonth: string, targetMonth: string) {
        const budgets = all('SELECT * FROM budgets WHERE month = ?', [sourceMonth]);
        for (const b of budgets as any[]) {
            const exists = get(
                'SELECT id FROM budgets WHERE month = ? AND category_id = ? AND sub_category_id IS ?',
                [targetMonth, b.category_id, b.sub_category_id]
            );
            if (!exists) {
                run(
                    'INSERT INTO budgets (id, month, category_id, sub_category_id, amount) VALUES (?, ?, ?, ?, ?)',
                    [uuidv4(), targetMonth, b.category_id, b.sub_category_id, b.amount]
                );
            }
        }
    },

    generateFromAutomation(month: string) {
        // Generate budgets from recurring rules for the target month
        const rules = all("SELECT * FROM recurring_rules WHERE type = 'expense' AND is_active = 1");
        let count = 0;
        for (const rule of rules as any[]) {
            if (!rule.category_id) continue;
            const exists = get(
                'SELECT id FROM budgets WHERE month = ? AND category_id = ? AND sub_category_id IS ?',
                [month, rule.category_id, rule.sub_category_id || null]
            );
            if (!exists) {
                run(
                    'INSERT INTO budgets (id, month, category_id, sub_category_id, amount) VALUES (?, ?, ?, ?, ?)',
                    [uuidv4(), month, rule.category_id, rule.sub_category_id || null, Math.abs(rule.amount)]
                );
                count++;
            }
        }
        return { generated: count };
    },
};
