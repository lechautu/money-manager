import { all, get } from '../db/client.js';

export const StatisticsService = {
    getDashboardSummary(month: string) {
        const income = get<any>(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE month = ? AND amount > 0 AND source != 'transfer' AND deleted_at IS NULL AND status != 'ignored'",
            [month]
        );
        const expense = get<any>(
            "SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transactions WHERE month = ? AND amount < 0 AND source != 'transfer' AND deleted_at IS NULL AND status != 'ignored'",
            [month]
        );
        return { income: income?.total || 0, expense: expense?.total || 0, net: (income?.total || 0) - (expense?.total || 0), month };
    },

    getMonthlySummary(month: string) {
        const budgets = all('SELECT amount FROM budgets WHERE month = ?', [month]);
        const actualsRows = all(
            `SELECT COALESCE(SUM(ABS(amount)), 0) as total
             FROM transactions WHERE month = ? AND amount < 0 AND source != 'transfer' AND deleted_at IS NULL AND status != 'ignored'`, [month]
        );

        const totalBudget = (budgets as any[]).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
        const totalSpent = (actualsRows[0] as any)?.total || 0;

        return { totalBudget, totalSpent };
    },

    getSpendingAnalytics(month: string) {
        // Non-split expenses by category and sub_category
        const nonSplit = all(
            `SELECT 
                c.name as parent_name, 
                sc.name as sub_name, 
                COALESCE(SUM(ABS(t.amount)), 0) as value
             FROM transactions t 
             LEFT JOIN categories c ON t.category_id = c.id
             LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
             WHERE t.month = ? AND t.amount < 0 AND t.is_split = 0 AND t.source != 'transfer' AND t.deleted_at IS NULL AND t.status != 'ignored'
             GROUP BY t.category_id, t.sub_category_id ORDER BY value DESC`, [month]
        );
        // Split expenses
        const splits = all(
            `SELECT 
                c.name as parent_name, 
                sc.name as sub_name, 
                COALESCE(SUM(ABS(ts.amount)), 0) as value
             FROM transaction_splits ts 
             JOIN transactions t ON ts.transaction_id = t.id 
             LEFT JOIN categories c ON ts.category_id = c.id
             LEFT JOIN sub_categories sc ON ts.sub_category_id = sc.id
             WHERE t.month = ? AND t.is_split = 1 AND t.source != 'transfer' AND t.deleted_at IS NULL AND t.status != 'ignored'
             GROUP BY ts.category_id, ts.sub_category_id ORDER BY value DESC`, [month]
        );

        const categoryMap: Record<string, number> = {};
        [...nonSplit, ...splits].forEach((item: any) => {
            let name = 'Uncategorized';
            if (item.parent_name) {
                name = item.sub_name ? `${item.parent_name} - ${item.sub_name}` : item.parent_name;
            }
            categoryMap[name] = (categoryMap[name] || 0) + (item.value || 0);
        });

        return Object.entries(categoryMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    },

    getCashflowTrend(startDate: string, endDate: string) {
        return all(
            `SELECT date,
                    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
                    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expense,
                    COALESCE(SUM(CASE WHEN source != 'transfer' THEN amount ELSE 0 END), 0) as net
             FROM transactions 
             WHERE date >= ? AND date <= ? AND deleted_at IS NULL AND status != 'ignored'
             GROUP BY date ORDER BY date`, [startDate, endDate]
        );
    },

    getDailySpending(month: string) {
        return all(
            `SELECT date, COALESCE(SUM(ABS(amount)), 0) as total
             FROM transactions WHERE month = ? AND amount < 0 AND source != 'transfer' AND deleted_at IS NULL AND status != 'ignored'
             GROUP BY date ORDER BY date`, [month]
        );
    },

    getCategoryMovers(currentMonth: string, previousMonth: string) {
        const current = all(
            `SELECT category_id, COALESCE(SUM(ABS(amount)), 0) as total FROM transactions WHERE month = ? AND amount < 0 AND source != 'transfer' AND deleted_at IS NULL AND status != 'ignored' GROUP BY category_id`, [currentMonth]
        );
        const previous = all(
            `SELECT category_id, COALESCE(SUM(ABS(amount)), 0) as total FROM transactions WHERE month = ? AND amount < 0 AND source != 'transfer' AND deleted_at IS NULL AND status != 'ignored' GROUP BY category_id`, [previousMonth]
        );
        return { current, previous };
    },

    getPendingSummary() {
        const row = get<any>(
            `SELECT COALESCE(SUM(ABS(amount)), 0) as total_amount, COUNT(*) as count
             FROM transactions WHERE status = 'pending' AND deleted_at IS NULL`
        );
        return row || { total_amount: 0, count: 0 };
    },

    getUpcomingPayments() {
        return all(
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

    getForecast(months: number = 12) {
        const todayStr = new Date().toISOString().substring(0, 10);
        const currentMonthStr = todayStr.substring(0, 7);

        // 1. Starting Balance (Actual NOW)
        const accounts = all('SELECT initial_balance FROM accounts');
        const transactionsPosted = get<any>(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE deleted_at IS NULL AND status = 'posted'"
        );
        let startBalanceNow = accounts.reduce((sum: number, a: any) => sum + (a.initial_balance || 0), 0) + (transactionsPosted?.total || 0);

        // 2. Current Month Actuals (Transactions already in DB for this month)
        const currentMonthActuals = get<any>(
            `SELECT 
                COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expense
             FROM transactions 
             WHERE month = ? AND deleted_at IS NULL AND status != 'ignored' AND source != 'transfer'`,
            [currentMonthStr]
        );

        // 3. Variable Spending Baseline (Average of manual/non-automated spending)
        const manualHistory = all(
            `SELECT 
                COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_expense,
                COUNT(DISTINCT month) as month_count
             FROM transactions 
             WHERE source NOT IN ('recurring', 'installment', 'transfer') 
             AND deleted_at IS NULL AND status != 'ignored'
             AND month >= ? AND month < ?`, [getNMonthsAgo(6), currentMonthStr]
        );
        const activeMonths = Math.max(1, manualHistory[0]?.month_count || 1);
        const avgManualIncome = (manualHistory[0]?.total_income || 0) / activeMonths;
        const avgManualExpense = (manualHistory[0]?.total_expense || 0) / activeMonths;

        // 4. Data Components
        const recurringRules = all('SELECT * FROM recurring_rules WHERE is_active = 1');
        const unpaidInstallments = all('SELECT * FROM installment_payments WHERE status != "paid"');

        // Fetch all current/future transactions linked to recurring to avoid double counting
        const existingRecurringTxs = all('SELECT source_ref_id, date FROM transactions WHERE source = "recurring" AND date >= ?', [currentMonthStr + '-01']);

        // Track rule instance counts for max_instances limit
        const ruleInstanceCounts: Record<string, number> = {};
        for (const rule of recurringRules as any[]) {
            const countRow = get<any>('SELECT COUNT(*) as count FROM recurring_instances WHERE rule_id = ?', [rule.id]);
            ruleInstanceCounts[rule.id] = countRow?.count || 0;
        }

        // 5. Projection Points
        const points = [];
        let runningBalance = startBalanceNow;
        const now = new Date();

        for (let i = 0; i < months; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const monthStr = d.toISOString().substring(0, 7);

            let projIncome = 0;
            let projExpense = 0;

            // --- A. Manual Variable Spending ---
            if (monthStr === currentMonthStr) {
                const day = now.getDate();
                const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const ratio = Math.max(0, (totalDays - day) / totalDays);
                projIncome += avgManualIncome * ratio;
                projExpense += avgManualExpense * ratio;
            } else {
                projIncome += avgManualIncome;
                projExpense += avgManualExpense;
            }

            // --- B. Recurring Rules ---
            for (const rule of recurringRules as any[]) {
                const dates = getRecurringDatesInMonth(rule, monthStr);
                for (const date of dates) {
                    // Check max_instances (if rule has a limit)
                    if (rule.max_instances && ruleInstanceCounts[rule.id] >= rule.max_instances) continue;

                    // Skip if a transaction for this specific rule and date already exists (means it's already in Actuals/Balance)
                    const txExists = existingRecurringTxs.some((tx: any) => tx.source_ref_id === rule.id && tx.date === date);
                    if (txExists) {
                        // Already accounted for, but we still increment instance count if we are simulating history
                        // but here we only increment if we ARE adding it to projection
                    } else {
                        // Past dates in current month that HAVE NO transaction are skipped (missed opportunities)
                        if (monthStr === currentMonthStr && date < todayStr) continue;

                        // Add to projection
                        if (rule.type === 'income') projIncome += Math.abs(rule.amount);
                        else if (rule.type === 'expense') projExpense += Math.abs(rule.amount);

                        ruleInstanceCounts[rule.id]++;
                    }
                }
            }

            // --- C. Installments ---
            const monthlyInst = unpaidInstallments
                .filter((p: any) => p.due_month === monthStr)
                .reduce((sum: number, p: any) => sum + Math.abs(p.amount), 0);
            projExpense += monthlyInst;

            // Update balance: only add what is projected and hasn't happened yet
            runningBalance += (projIncome - projExpense);

            // Row display: Actual (if current) + Projected
            const displayIncome = (monthStr === currentMonthStr ? currentMonthActuals.income : 0) + projIncome;
            const displayExpense = (monthStr === currentMonthStr ? currentMonthActuals.expense : 0) + projExpense;

            points.push({
                month: monthStr,
                income: Math.round(displayIncome),
                expense: Math.round(displayExpense),
                projectedBalance: Math.round(runningBalance)
            });
        }

        return points;
    },

    getForecastDetails(_targetMonthStr: string) {
        return {
            month: _targetMonthStr,
            openingBalance: 0,
            closingBalance: 0,
            income: { total: 0, items: [] },
            expense: { total: 0, items: [] }
        };
    },
};

/**
 * Returns an array of dates (YYYY-MM-DD) where the rule trigger in a given month.
 * respects start_date and end_date.
 */
function getRecurringDatesInMonth(rule: any, monthStr: string): string[] {
    const monthStart = monthStr + '-01';
    const lastDay = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]), 0).getDate();
    const monthEnd = monthStr + '-' + lastDay;

    if (rule.start_date > monthEnd) return [];
    if (rule.end_date && rule.end_date < monthStart) return [];

    let current = rule.start_date;

    // Jump logic for performance
    if (current < monthStart) {
        const startDate = new Date(current + 'T00:00:00Z');
        const targetDate = new Date(monthStart + 'T00:00:00Z');

        if (rule.frequency === 'daily') {
            const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
            startDate.setUTCDate(startDate.getUTCDate() + diffDays);
        } else if (rule.frequency === 'weekly') {
            const diffWeeks = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24 * 7));
            startDate.setUTCDate(startDate.getUTCDate() + diffWeeks * 7);
        } else if (rule.frequency === 'biweekly') {
            const diffWeeks = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24 * 14));
            startDate.setUTCDate(startDate.getUTCDate() + diffWeeks * 14);
        } else if (rule.frequency === 'monthly') {
            const diffMonths = (targetDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (targetDate.getUTCMonth() - startDate.getUTCMonth());
            startDate.setUTCMonth(startDate.getUTCMonth() + diffMonths);
        } else if (rule.frequency === 'quarterly') {
            const diffMonths = (targetDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (targetDate.getUTCMonth() - startDate.getUTCMonth());
            startDate.setUTCMonth(startDate.getUTCMonth() + Math.floor(diffMonths / 3) * 3);
        } else if (rule.frequency === 'yearly') {
            const diffYears = targetDate.getUTCFullYear() - startDate.getUTCFullYear();
            startDate.setUTCFullYear(startDate.getUTCFullYear() + diffYears);
        }

        current = startDate.toISOString().substring(0, 10);
        while (current < monthStart) current = advanceDate(current, rule.frequency);
    }

    const dates: string[] = [];
    const limit = rule.end_date && rule.end_date < monthEnd ? rule.end_date : monthEnd;

    let iter = 0;
    while (current <= limit && iter < 50) {
        if (current >= monthStart) {
            dates.push(current);
        }
        current = advanceDate(current, rule.frequency);
        iter++;
    }

    return dates;
}

function getNMonthsAgo(n: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    return d.toISOString().substring(0, 7);
}

function advanceDate(dateStr: string, frequency: string): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    switch (frequency) {
        case 'daily': d.setUTCDate(d.getUTCDate() + 1); break;
        case 'weekly': d.setUTCDate(d.getUTCDate() + 7); break;
        case 'biweekly': d.setUTCDate(d.getUTCDate() + 14); break;
        case 'monthly': d.setUTCMonth(d.getUTCMonth() + 1); break;
        case 'quarterly': d.setUTCMonth(d.getUTCMonth() + 3); break;
        case 'yearly': d.setUTCFullYear(d.getUTCFullYear() + 1); break;
    }
    return d.toISOString().substring(0, 10);
}
