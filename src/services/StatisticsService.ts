import { run } from '../db/client';
import { addDays, addWeeks, addMonths, addYears, parseISO, format, isBefore, isAfter } from 'date-fns';

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
            WHERE month = ? AND status = 'posted' AND source != 'transfer' AND deleted_at IS NULL
        `, [month]);

        const income = monthlyStats[0]?.income || 0;
        const expense = monthlyStats[0]?.expense || 0; // Negative value

        // 2. Get Total Net Worth (All accounts, all time)
        // Grouped by currency
        const balances = await run(`
            SELECT 
                currency,
                SUM(amount) as balance
            FROM (
                -- Transactions on main account
                SELECT a.currency, t.amount
                FROM transactions t
                JOIN accounts a ON t.account_id = a.id
                WHERE t.status = 'posted' AND t.deleted_at IS NULL
                
                UNION ALL
                
                -- Transactions on "to account" (transfers)
                SELECT a.currency, ABS(t.amount) as amount
                FROM transactions t
                JOIN accounts a ON t.to_account_id = a.id
                WHERE t.status = 'posted' AND t.to_account_id IS NOT NULL AND t.deleted_at IS NULL

                UNION ALL

                -- Initial Balances from accounts
                SELECT currency, initial_balance as amount
                FROM accounts
            ) legs
            GROUP BY currency
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
            WHERE t.deleted_at IS NULL
            ORDER BY t.date DESC, t.created_at DESC
            LIMIT ?
        `, [limit]);
    },

    async getExpenseByCategory(month: string) {
        const rows = await run(`
            SELECT 
                c.name as category_name,
                sc.name as sub_category_name,
                SUM(combined.amount) as value
            FROM (
                SELECT t.category_id, t.sub_category_id, ABS(t.amount) as amount
                FROM transactions t
                WHERE t.is_split = 0 AND t.month = ? AND t.amount < 0 AND t.status = 'posted' AND t.source != 'transfer' AND t.deleted_at IS NULL
                
                UNION ALL
                
                SELECT s.category_id, s.sub_category_id, ABS(s.amount)
                FROM transaction_splits s
                JOIN transactions t ON s.transaction_id = t.id
                WHERE t.is_split = 1 AND t.month = ? AND t.status = 'posted' AND t.source != 'transfer' AND t.deleted_at IS NULL
            ) combined
            JOIN categories c ON combined.category_id = c.id
            LEFT JOIN sub_categories sc ON combined.sub_category_id = sc.id
            GROUP BY c.id, combined.sub_category_id
            HAVING value > 0
            ORDER BY value DESC
        `, [month, month]);

        return rows.map((r: any) => ({
            ...r,
            name: r.sub_category_name ? `${r.category_name} > ${r.sub_category_name}` : r.category_name
        }));
    },

    async getDailySpending(month: string) {
        // Returns daily spending for the month to visualize trends
        return await run(`
            SELECT 
                t.date,
                SUM(ABS(t.amount)) as value
            FROM transactions t
            WHERE t.month = ? AND t.amount < 0 AND t.status = 'posted' AND t.source != 'transfer' AND t.deleted_at IS NULL
            GROUP BY t.date
            ORDER BY t.date ASC
        `, [month]);
    },
    async getMonthlyTrends(startMonth: string, endMonth: string, filters: { accountIds?: string[] } = {}) {
        let sql = `
            SELECT 
                t.month,
                SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as income,
                SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as expense
            FROM transactions t
            WHERE t.month >= ? AND t.month <= ? AND t.status = 'posted' AND t.source != 'transfer' AND t.deleted_at IS NULL
        `;
        const args: any[] = [startMonth, endMonth];

        if (filters.accountIds && filters.accountIds.length > 0) {
            sql += ` AND t.account_id IN (${filters.accountIds.map(() => '?').join(',')})`;
            args.push(...filters.accountIds);
        }

        sql += ` GROUP BY t.month ORDER BY t.month ASC`;

        const rows = await run(sql, args);
        return rows.map((r: any) => ({
            month: r.month,
            income: r.income || 0,
            expense: r.expense || 0,
            net: (r.income || 0) - (r.expense || 0)
        }));
    },

    async getCategoryMovers(
        currentStart: string, currentEnd: string,
        compareStart: string, compareEnd: string,
        filters: { accountIds?: string[], type?: 'income' | 'expense' } = {}
    ) {
        // Helper to fetch totals
        const getTotals = async (start: string, end: string) => {
            // Refined Queries with Account Filter
            const accFilter = (filters.accountIds && filters.accountIds.length > 0)
                ? `AND t.account_id IN (${filters.accountIds.map(() => '?').join(',')})`
                : '';

            const accArgs = (filters.accountIds && filters.accountIds.length > 0) ? filters.accountIds : [];

            // Split logic: 
            // - Non-split: checking t.amount < 0 (expense) or > 0 (income)
            // - Split: checking t.amount... split amounts are likely positive.
            // Requirement says "Split transactions counted via split lines".

            const operator = filters.type === 'income' ? '>' : '<';
            const splitSql = `
                SELECT sub.category_id, sub.sub_category_id, c.name as category_name, sc.name as sub_category_name, SUM(val) as total
                FROM (
                    SELECT t.category_id, t.sub_category_id, t.amount as val
                    FROM transactions t
                    WHERE t.is_split = 0 AND t.month >= ? AND t.month <= ?
                      AND t.amount ${operator} 0 
                      AND t.status = 'posted' AND t.source != 'transfer' AND t.deleted_at IS NULL
                      ${accFilter}

                    UNION ALL

                    SELECT s.category_id, s.sub_category_id, s.amount as val
                    FROM transaction_splits s
                    JOIN transactions t ON s.transaction_id = t.id
                    WHERE t.is_split = 1 AND t.month >= ? AND t.month <= ?
                      AND t.amount ${operator} 0 
                      AND t.status = 'posted' AND t.source != 'transfer' AND t.deleted_at IS NULL
                      ${accFilter}
                ) sub
                JOIN categories c ON sub.category_id = c.id
                LEFT JOIN sub_categories sc ON sub.sub_category_id = sc.id
                GROUP BY sub.category_id, sub.sub_category_id, c.name, sc.name
            `;

            const args = [start, end, ...accArgs, start, end, ...accArgs];
            const rows = await run(splitSql, args);
            return rows;
        };

        const currentTotals = await getTotals(currentStart, currentEnd);
        const compareTotals = await getTotals(compareStart, compareEnd);

        // Merge logic
        const map = new Map<string, any>();

        currentTotals.forEach((r: any) => {
            const key = `${r.category_id}:${r.sub_category_id || ''}`;
            map.set(key, {
                id: r.category_id,
                subCategoryId: r.sub_category_id,
                name: r.sub_category_name ? `${r.category_name} > ${r.sub_category_name}` : r.category_name,
                icon: '📂', color: '#9CA3AF',
                current: r.total, compare: 0
            });
        });

        compareTotals.forEach((r: any) => {
            const key = `${r.category_id}:${r.sub_category_id || ''}`;
            if (!map.has(key)) {
                map.set(key, {
                    id: r.category_id,
                    subCategoryId: r.sub_category_id,
                    name: r.sub_category_name ? `${r.category_name} > ${r.sub_category_name}` : r.category_name,
                    icon: '📂', color: '#9CA3AF',
                    current: 0, compare: r.total
                });
            } else {
                const item = map.get(key);
                item.compare = r.total;
            }
        });

        const results = Array.from(map.values()).map(item => {
            const delta = item.current - item.compare;
            const percent = item.compare !== 0 ? (delta / Math.abs(item.compare)) * 100 : null;
            return { ...item, delta, percent };
        });

        const increased = [...results].sort((a, b) => b.delta - a.delta).filter(i => i.delta > 0).slice(0, 5);
        const decreased = [...results].sort((a, b) => a.delta - b.delta).filter(i => i.delta < 0).slice(0, 5);

        return { increased, decreased };
    },

    async getCashflowTrend(startDate: string, endDate: string) {
        return await run(`
            SELECT 
                t.date,
                SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as income,
                SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as expense,
                SUM(t.amount) as net
            FROM transactions t
            WHERE t.date >= ? AND t.date <= ? 
              AND t.status = 'posted' 
              AND t.source != 'transfer' 
              AND t.deleted_at IS NULL
            GROUP BY t.date
            ORDER BY t.date ASC
        `, [startDate, endDate]);
    },

    async getPendingSummary() {
        const result = await run(`
            SELECT 
                COUNT(*) as count,
                SUM(ABS(amount)) as total_amount
            FROM transactions
            WHERE status = 'pending' AND deleted_at IS NULL
        `);
        return {
            count: result[0]?.count || 0,
            total_amount: result[0]?.total_amount || 0
        };
    },

    async getUpcomingPayments(days: number = 30) {
        const rules = await run('SELECT * FROM recurring_rules WHERE is_active = 1 AND type = \'expense\'');
        const today = new Date();
        const futureLimit = addDays(today, days);
        const upcoming: any[] = [];

        const getNextDate = (date: Date, frequency: string): Date => {
            switch (frequency) {
                case 'daily': return addDays(date, 1);
                case 'weekly': return addWeeks(date, 1);
                case 'biweekly': return addWeeks(date, 2);
                case 'monthly': return addMonths(date, 1);
                case 'quarterly': return addMonths(date, 3);
                case 'yearly': return addYears(date, 1);
                default: return addMonths(date, 1);
            }
        };

        for (const rule of rules) {
            let current = parseISO(rule.start_date);
            // Advance until >= today (start of day)
            const startOfToday = new Date(today.setHours(0, 0, 0, 0));

            // Safety break
            let iterations = 0;
            while (isBefore(current, startOfToday) && iterations < 1000) {
                current = getNextDate(current, rule.frequency);
                iterations++;
            }

            if (isAfter(current, futureLimit)) continue;
            if (rule.end_date && isAfter(current, parseISO(rule.end_date))) continue;

            upcoming.push({
                id: rule.id,
                name: rule.name,
                amount: rule.amount,
                date: format(current, 'yyyy-MM-dd'),
                category_id: rule.category_id
            });
        }

        return upcoming.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
    }
}
