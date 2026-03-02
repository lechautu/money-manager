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

        // 1. Starting Balance (Effective Balance: Posted + Pending)
        const accounts = all('SELECT initial_balance FROM accounts');
        // Total system balance = Initial Balances + SUM(external income/expense)
        // Transfers are movements between accounts and should not affect system total.
        const transactionsTotal = get<any>(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE to_account_id IS NULL AND deleted_at IS NULL AND status != 'ignored'"
        );
        let startBalanceNow = accounts.reduce((sum: number, a: any) => sum + (a.initial_balance || 0), 0) + (transactionsTotal?.total || 0);

        // 2. All Monthly Actuals (Transactions already in DB)
        const allActuals = all(`
            SELECT month,
                COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expense
            FROM transactions 
            WHERE deleted_at IS NULL AND status != 'ignored' AND source != 'transfer'
            GROUP BY month
        `) as any[];

        const actualsMap: Record<string, { income: number; expense: number }> = {};
        allActuals.forEach(row => {
            actualsMap[row.month] = {
                income: row.income || 0,
                expense: row.expense || 0
            };
        });

        // 3. Variable Spending Baseline (Average of manual/non-automated spending)
        const avgManualIncome = 0;
        const avgManualExpense = 0;

        // 4. Data Components
        const recurringRules = all('SELECT * FROM recurring_rules WHERE is_active = 1');
        const unpaidInstallments = all('SELECT * FROM installment_payments WHERE status != "paid" AND expense_transaction_id IS NULL AND linked_transaction_id IS NULL AND generated_transaction_id IS NULL');

        // Fetch all current/future/recent transactions to avoid double counting across all displayed months
        const startHistoryStr = getNMonthsAgo(3);
        const existingTxs = all('SELECT source, source_ref_id, date, category_id, sub_category_id, amount FROM transactions WHERE date >= ? AND deleted_at IS NULL AND status != "ignored"', [startHistoryStr + '-01']);

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

                    // Check if a transaction already exists for this rule and date
                    // 1. Direct link (source_ref_id)
                    // 2. Or any transaction in the same month with same category and amount (handles day shifts and unlinked plans)
                    const txExists = existingTxs.some((tx: any) => {
                        // Direct link match
                        if (tx.source_ref_id === rule.id && (rule.frequency === 'monthly' ? tx.date.startsWith(monthStr) : tx.date === date)) return true;

                        // Fuzzy match (Monthly plans only to avoid false matches on daily/weekly rules)
                        if (rule.frequency === 'monthly' || rule.frequency === 'quarterly' || rule.frequency === 'yearly') {
                            return tx.date.startsWith(monthStr) && tx.category_id === rule.category_id && Math.abs(tx.amount) === Math.abs(rule.amount);
                        }

                        // Exact date match for daily/weekly
                        return tx.date === date && tx.category_id === rule.category_id && Math.abs(tx.amount) === Math.abs(rule.amount);
                    });

                    if (!txExists) {
                        // Past dates in current month that HAVE NO transaction are skipped (missed opportunities)
                        // This prevents projecting "ghost" expenses for days that already passed without action
                        if (monthStr === currentMonthStr && date <= todayStr) continue;

                        // Add to projection
                        if (rule.type === 'income') projIncome += Math.abs(rule.amount);
                        else if (rule.type === 'expense') projExpense += Math.abs(rule.amount);

                        ruleInstanceCounts[rule.id]++;
                    }
                }
            }

            // --- C. Installments ---
            const monthlyInst = unpaidInstallments
                .filter((p: any) => {
                    if (p.due_month !== monthStr) return false;

                    // Smart check: Skip if a manual transaction exists with same category and amount for this installment (due month matches)
                    // Note: installments are already filtered by expense_transaction_id IS NULL in the earlier query
                    const plan = all('SELECT payment_category_id FROM installment_plans WHERE id = ?', [p.plan_id])[0];
                    const exists = existingTxs.some((tx: any) =>
                        tx.date.startsWith(monthStr) &&
                        tx.category_id === plan?.payment_category_id &&
                        Math.abs(tx.amount) === Math.abs(p.amount)
                    );
                    return !exists;
                })
                .reduce((sum: number, p: any) => sum + Math.abs(p.amount), 0);
            projExpense += monthlyInst;

            // Update balance: only add what is projected and hasn't happened yet
            runningBalance += (projIncome - projExpense);

            // Row display: Actuals (for this month) + Projected (future items for this month)
            const actuals = actualsMap[monthStr] || { income: 0, expense: 0 };
            const displayIncome = actuals.income + projIncome;
            const displayExpense = actuals.expense + projExpense;

            points.push({
                month: monthStr,
                income: Math.round(displayIncome),
                expense: Math.round(displayExpense),
                projectedBalance: Math.round(runningBalance)
            });
        }

        return points;
    },

    getForecastDetails(targetMonthStr: string) {
        const todayStr = new Date().toISOString().substring(0, 10);
        const currentMonthStr = todayStr.substring(0, 7);
        const isFuture = targetMonthStr > currentMonthStr;
        const isPast = targetMonthStr < currentMonthStr;

        // 1. Fetch All Relevant Data (with category names)
        const recurringRules = all(`
            SELECT r.*, c.name as category_name, sc.name as sub_category_name
            FROM recurring_rules r
            LEFT JOIN categories c ON r.category_id = c.id
            LEFT JOIN sub_categories sc ON r.sub_category_id = sc.id
            WHERE r.is_active = 1
        `);

        const installments = all(`
            SELECT p.*, pl.name as plan_name, pl.tenor_months,
                   c.name as category_name, sc.name as sub_category_name,
                   (SELECT COUNT(*) FROM installment_payments p2 WHERE p2.plan_id = p.plan_id AND p2.due_date <= p.due_date) as period_num
            FROM installment_payments p
            JOIN installment_plans pl ON p.plan_id = pl.id
            LEFT JOIN categories c ON pl.payment_category_id = c.id
            LEFT JOIN sub_categories sc ON pl.payment_sub_category_id = sc.id
            WHERE p.due_month = ?
        `, [targetMonthStr]);

        const transactions = all(`
            SELECT t.*, c.name as category_name, sc.name as sub_category_name
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
            WHERE t.month = ? AND t.deleted_at IS NULL AND t.status != 'ignored' AND t.source != 'transfer'
        `, [targetMonthStr]);

        // 2. Prepare Breakdown
        const incomeLineItems: any[] = [];
        const expenseLineItems: any[] = [];

        // --- Track handled source IDs to avoid double counting ---
        const handledRefs = new Set();

        // --- A. Process Recurring Rules ---
        for (const rule of recurringRules as any[]) {
            if (rule.type === 'transfer') continue; // Exclude internal transfers

            const dates = getRecurringDatesInMonth(rule, targetMonthStr);
            for (const date of dates) {
                // Find matching transaction
                const match = transactions.find((tx: any) =>
                    (tx.source === 'recurring' && tx.source_ref_id === rule.id && (rule.frequency === 'monthly' ? true : tx.date === date)) ||
                    (tx.category_id === rule.category_id && Math.abs(tx.amount) === Math.abs(rule.amount) && (rule.frequency === 'monthly' ? true : tx.date === date))
                );

                // Determine category name
                let categoryFull = rule.category_name || 'Uncategorized';
                if (rule.sub_category_name) {
                    categoryFull = `${rule.category_name} - ${rule.sub_category_name}`;
                }

                const item = {
                    id: match?.id || `${rule.id}-${date}`,
                    name: rule.name || 'Recurring',
                    date: match?.date || date,
                    amount: Math.abs(rule.amount),
                    categoryName: categoryFull,
                    status: match ? 'posted' : (date <= todayStr && !isFuture ? 'missed' : 'projected'),
                    type: 'recurring',
                    txId: match?.id
                };

                if (match) handledRefs.add(match.id);

                if (rule.type === 'income') incomeLineItems.push(item);
                else expenseLineItems.push(item);
            }
        }

        // --- B. Process Installments ---
        for (const p of installments as any[]) {
            const match = transactions.find((tx: any) =>
                (tx.source === 'installment' && tx.source_ref_id === p.id) ||
                (tx.id === p.linked_transaction_id || tx.id === p.generated_transaction_id)
            );

            // Determine category name
            let categoryFull = p.category_name || 'Uncategorized';
            if (p.sub_category_name) {
                categoryFull = `${p.category_name} - ${p.sub_category_name}`;
            }

            const item = {
                id: match?.id || p.id,
                name: p.plan_name || 'Installment',
                date: p.due_date,
                amount: Math.abs(p.amount),
                categoryName: categoryFull,
                status: (p.status === 'paid' || match) ? 'posted' : (p.due_date <= todayStr && !isFuture ? 'overdue' : 'projected'),
                type: 'installment',
                txId: match?.id,
                meta: { current: p.period_num, total: p.tenor_months }
            };

            if (match) handledRefs.add(match.id);
            expenseLineItems.push(item);
        }

        // --- C. Remaining Transactions (Manual / Others) ---
        const manualTxs = (transactions as any[]).filter(tx => !handledRefs.has(tx.id));
        for (const tx of manualTxs) {
            // Determine category name
            let categoryFull = tx.category_name || 'Uncategorized';
            if (tx.sub_category_name) {
                categoryFull = `${tx.category_name} - ${tx.sub_category_name}`;
            }

            const item = {
                id: tx.id,
                name: tx.note || 'Transaction',
                date: tx.date,
                amount: Math.abs(tx.amount),
                categoryName: categoryFull,
                status: tx.status,
                type: 'manual',
                txId: tx.id
            };
            if (tx.amount > 0) incomeLineItems.push(item);
            else expenseLineItems.push(item);
        }

        // 3. Calculate Balances
        // For simplicity, closing balance = point from getForecast or similar logic
        // But for details page, we can just fetch the projected balance at end of this month
        const forecastPoints = this.getForecast(24); // Get a long enough forecast
        const monthPoint = forecastPoints.find(p => p.month === targetMonthStr);

        return {
            month: targetMonthStr,
            openingBalance: (monthPoint?.projectedBalance || 0) - (monthPoint?.income || 0) + (monthPoint?.expense || 0),
            closingBalance: monthPoint?.projectedBalance || 0,
            income: {
                total: incomeLineItems.reduce((s, i) => s + i.amount, 0),
                items: incomeLineItems.sort((a, b) => a.date.localeCompare(b.date))
            },
            expense: {
                total: expenseLineItems.reduce((s, i) => s + i.amount, 0),
                items: expenseLineItems.sort((a, b) => a.date.localeCompare(b.date))
            }
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
