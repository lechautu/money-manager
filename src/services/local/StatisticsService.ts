import { run } from '../../db/client';

export const LocalStatisticsService = {
    async getDashboardSummary(month: string) {
        const incomeRows = await run(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE month = ? AND amount > 0 AND source != 'transfer' AND deleted_at IS NULL AND status != 'ignored'",
            [month]
        );
        const expenseRows = await run(
            "SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transactions WHERE month = ? AND amount < 0 AND source != 'transfer' AND deleted_at IS NULL AND status != 'ignored'",
            [month]
        );

        const income = incomeRows[0]?.total || 0;
        const expense = expenseRows[0]?.total || 0;

        return {
            income,
            expense,
            net: income - expense,
            month
        };
    },

    async getMonthlySummary(month: string) {
        return await this.getDashboardSummary(month);
    },

    // Renaming to match executeTool call
    async getExpenseByCategory(month: string) {
        // Non-split expenses by category
        const nonSplit = await run(
            `SELECT COALESCE(c.name, 'Uncategorized') as category_name, COALESCE(SUM(ABS(t.amount)), 0) as total
             FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
             WHERE t.month = ? AND t.amount < 0 AND t.is_split = 0 AND t.source != 'transfer' AND t.deleted_at IS NULL AND t.status != 'ignored'
             GROUP BY t.category_id ORDER BY total DESC`, [month]
        );
        // Split expenses
        const splits = await run(
            `SELECT COALESCE(c.name, 'Uncategorized') as category_name, COALESCE(SUM(ABS(ts.amount)), 0) as total
             FROM transaction_splits ts JOIN transactions t ON ts.transaction_id = t.id LEFT JOIN categories c ON ts.category_id = c.id
             WHERE t.month = ? AND t.is_split = 1 AND t.source != 'transfer' AND t.deleted_at IS NULL AND t.status != 'ignored'
             GROUP BY ts.category_id ORDER BY total DESC`, [month]
        );

        const categoryMap: Record<string, number> = {};
        [...nonSplit, ...splits].forEach((item: any) => {
            categoryMap[item.category_name] = (categoryMap[item.category_name] || 0) + item.total;
        });

        return Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
    },

    async getCashflowTrend(startDate: string, endDate: string) {
        // Handle months format (YYYY-MM to YYYY-MM)
        const startMonth = startDate.includes('-') && startDate.length === 7 ? startDate : startDate.substring(0, 7);
        const endMonth = endDate.includes('-') && endDate.length === 7 ? endDate : endDate.substring(0, 7);

        return await run(
            `SELECT month,
                    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
                    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expense
             FROM transactions WHERE month >= ? AND month <= ? AND source != 'transfer' AND deleted_at IS NULL AND status != 'ignored'
             GROUP BY month ORDER BY month`, [startMonth, endMonth]
        );
    },

    async getDailySpending(month: string) {
        return await run(
            `SELECT date, COALESCE(SUM(ABS(amount)), 0) as total
             FROM transactions WHERE month = ? AND amount < 0 AND source != 'transfer' AND deleted_at IS NULL AND status != 'ignored'
             GROUP BY date ORDER BY date`, [month]
        );
    },

    // Matching 4-arg signature from ToolExecutionService
    async getCategoryMovers(currentStart: string, _currentEnd: string, compareStart: string, _compareEnd: string) {
        // Simplified: use just start month if that matches current gateway version
        const curMonth = currentStart.substring(0, 7);
        const prevMonth = compareStart.substring(0, 7);

        const current = await run(
            `SELECT category_id, COALESCE(SUM(ABS(amount)), 0) as total FROM transactions WHERE month = ? AND amount < 0 AND source != 'transfer' AND deleted_at IS NULL AND status != 'ignored' GROUP BY category_id`, [curMonth]
        );
        const previous = await run(
            `SELECT category_id, COALESCE(SUM(ABS(amount)), 0) as total FROM transactions WHERE month = ? AND amount < 0 AND source != 'transfer' AND deleted_at IS NULL AND status != 'ignored' GROUP BY category_id`, [prevMonth]
        );
        return { current, previous };
    },

    async getPendingSummary() {
        const rows = await run(
            `SELECT COALESCE(SUM(ABS(amount)), 0) as total_amount, COUNT(*) as count
             FROM transactions WHERE status = 'pending' AND deleted_at IS NULL`
        );
        return rows[0] || { total_amount: 0, count: 0 };
    },

    async getUpcomingPayments(_days: number = 30) {
        return await run(
            `SELECT 
                ip.due_date as date, 
                ip.amount, 
                pl.name as name, 
                c.name as category_name,
                ip.status
             FROM installment_payments ip
             JOIN installment_plans pl ON ip.plan_id = pl.id
             LEFT JOIN categories c ON pl.payment_category_id = c.id
             WHERE ip.status IN ('upcoming', 'due', 'overdue')
             ORDER BY ip.due_date LIMIT 50`
        );
    },

    async getForecast(months: number = 3) {
        // Simple forecast based on recent averages
        const recent = await run(
            `SELECT month,
                    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
                    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expense
             FROM transactions WHERE source != 'transfer' AND deleted_at IS NULL AND status != 'ignored'
             GROUP BY month ORDER BY month DESC LIMIT ?`, [months]
        );
        const avgIncome = recent.reduce((s: number, r: any) => s + r.income, 0) / (recent.length || 1);
        const avgExpense = recent.reduce((s: number, r: any) => s + r.expense, 0) / (recent.length || 1);
        return { avgIncome, avgExpense, months: recent.length, projection: avgIncome - avgExpense };
    }
};
