import { run } from '../db/client';

export const StatisticsService = {
    async getDashboardSummary(month: string) {
        // Total Balance (All time, all accounts)
        // Converted to base currency? MVP1: Show totals per currency or just one dominant one?
        // Requirement: "Total balance shown per currency"
        // For Dashboard Summary (Income/Expense), it usually applies to the selected month.

        // 1. Get Income/Expense for the month
        const monthlyStats = await run(`
            SELECT 
                SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expense
            FROM transactions 
            WHERE month = ? AND status = 'posted'
        `, [month]);

        const income = monthlyStats[0]?.income || 0;
        const expense = monthlyStats[0]?.expense || 0; // Negative value

        // 2. Get Total Net Worth (All accounts, all time)
        // Grouped by currency
        const balances = await run(`
            SELECT 
                a.currency,
                SUM(CASE WHEN t.status = 'posted' THEN t.amount ELSE 0 END) as balance
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            GROUP BY a.currency
        `);

        return {
            income,
            expense,
            balances, // [{currency: 'VND', balance: 100000}, ...]
        };
    },

    async getRecentTransactions(limit: number = 5) {
        return await run(`
            SELECT t.*, c.name as category_name, a.name as account_name, a.currency
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN accounts a ON t.account_id = a.id
            ORDER BY t.date DESC, t.created_at DESC
            LIMIT ?
        `, [limit]);
    },

    async getExpenseByCategory(month: string) {
        return await run(`
            SELECT 
                c.name,
                SUM(ABS(t.amount)) as value
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.month = ? AND t.amount < 0 AND t.status = 'posted'
            GROUP BY c.name
            ORDER BY value DESC
        `, [month]);
    },

    async getDailySpending(month: string) {
        // Returns daily spending for the month to visualize trends
        return await run(`
            SELECT 
                t.date,
                SUM(ABS(t.amount)) as value
            FROM transactions t
            WHERE t.month = ? AND t.amount < 0 AND t.status = 'posted'
            GROUP BY t.date
            ORDER BY t.date ASC
        `, [month]);
    }
};
