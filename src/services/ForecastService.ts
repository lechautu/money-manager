import { format, endOfMonth, isAfter, parseISO, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { run } from '../db/client';
import type { RecurringRule } from '../services/RecurringService';
import { RecurringService } from '../services/RecurringService';

export interface ForecastPoint {
    month: string;
    projectedBalance: number;
    income: number;
    expense: number;
}

export interface ForecastDetailItem {
    id: string;
    name: string;
    amount: number;
    date: string;
    type: 'recurring' | 'installment' | 'manual' | 'estimated';
    is_expense: boolean;
    categoryName?: string;
    status?: 'paid' | 'pending' | 'projected' | 'posted';
    meta?: any; // For holding extra info like installment progress (2/12)
}

export interface ForecastDetailResult {
    month: string;
    openingBalance: number;
    closingBalance: number;
    income: {
        total: number;
        items: ForecastDetailItem[];
    };
    expense: {
        total: number;
        items: ForecastDetailItem[];
    };
}

interface RuleState {
    rule: RecurringRule;
    nextDate: Date;
    totalCount: number;
    endDateLimit: Date | null;
}

export const ForecastService = {
    async getForecast(months: number = 12): Promise<ForecastPoint[]> {
        // 1. Get Current Total Net Worth (Effective: Posted + Pending)
        const balanceRows = await run(`
            SELECT SUM(amount) as total FROM (
                SELECT amount FROM transactions WHERE deleted_at IS NULL AND status IN ('posted', 'pending')
                UNION ALL
                SELECT ABS(amount) FROM transactions WHERE deleted_at IS NULL AND status IN ('posted', 'pending') AND to_account_id IS NOT NULL
                UNION ALL
                SELECT initial_balance FROM accounts
            )
        `);
        let runningBalance = balanceRows[0]?.total || 0;

        // 2. Prepare Automation Rules States
        const rules = await RecurringService.getAll();
        const activeRules = rules.filter(r => r.is_active);
        const ruleStates: RuleState[] = [];

        for (const rule of activeRules) {
            // Get current count from DB
            const countRows = await run('SELECT COUNT(*) as c FROM recurring_instances WHERE rule_id = ?', [rule.id]);
            const dbCount = countRows[0]?.c || 0;

            let current = parseISO(rule.start_date);
            const endDateLimit = rule.end_date ? parseISO(rule.end_date) : null;

            // We need to advance 'current' to the next potential occurrence date that is NOT in the database yet.
            let tempDate = current;
            let tempCount = 0;
            let iterLimit = 0;
            while (tempCount < dbCount && iterLimit < 5000) {
                tempDate = this._getNextDate(tempDate, rule.frequency);
                tempCount++;
                iterLimit++;
            }

            ruleStates.push({
                rule,
                nextDate: tempDate,
                totalCount: dbCount,
                endDateLimit
            });
        }

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const points: ForecastPoint[] = [];
        const now = new Date();

        for (let i = 0; i <= months; i++) {
            const targetMonthDate = addMonths(now, i);
            const monthStr = format(targetMonthDate, 'yyyy-MM');
            const monthEnd = endOfMonth(targetMonthDate);

            // A. Get Existing Transactions in DB for this month
            const dbStats = await run(`
                SELECT 
                    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
                    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expense
                FROM transactions 
                WHERE month = ? 
                  AND deleted_at IS NULL 
                  AND status IN ('posted', 'pending')
                  AND (source != 'transfer' OR source IS NULL)
            `, [monthStr]);

            let monthlyIncome = dbStats[0]?.income || 0;
            let monthlyExpense = dbStats[0]?.expense || 0;

            // B. Calculate Future Automation
            let futureAutomationIncome = 0;
            let futureAutomationExpense = 0;

            // 1. Recurring Rules Progression
            for (const state of ruleStates) {
                while (!isAfter(state.nextDate, monthEnd)) {
                    // Check Termination Conditions
                    if (state.rule.max_instances && state.totalCount >= state.rule.max_instances) break;
                    if (state.endDateLimit && isAfter(state.nextDate, state.endDateLimit)) break;

                    const dateStr = format(state.nextDate, 'yyyy-MM-dd');

                    // If it's in the target month AND after today (future projection)
                    if (dateStr.startsWith(monthStr) && dateStr > todayStr) {
                        if (state.rule.amount > 0) {
                            futureAutomationIncome += state.rule.amount;
                        } else {
                            futureAutomationExpense += Math.abs(state.rule.amount);
                        }
                        state.totalCount++;
                    }

                    // Advance to next occurrence for this rule
                    state.nextDate = this._getNextDate(state.nextDate, state.rule.frequency);

                    // Safety break for while loop
                    if (state.endDateLimit && isAfter(state.nextDate, state.endDateLimit)) break;
                    if (state.rule.max_instances && state.totalCount >= state.rule.max_instances) break;
                }
            }

            // 2. Installments
            const installments = await run(`
                SELECT SUM(amount) as total 
                FROM installment_payments 
                WHERE due_month = ? 
                  AND generated_transaction_id IS NULL 
                  AND linked_transaction_id IS NULL
                  AND due_date > ?
            `, [monthStr, todayStr]);

            const futureInstTotal = installments[0]?.total || 0;
            futureAutomationExpense += futureInstTotal;

            // Update Stats
            monthlyIncome += futureAutomationIncome;
            monthlyExpense += futureAutomationExpense;

            const netAutomation = futureAutomationIncome - futureAutomationExpense;
            runningBalance += netAutomation;

            points.push({
                month: monthStr,
                projectedBalance: runningBalance,
                income: monthlyIncome,
                expense: monthlyExpense
            });
        }

        return points;
    },

    async getForecastDetails(targetMonthStr: string): Promise<ForecastDetailResult> {
        // 1. Calculate Opening Balance (Projected balance at end of previous month)
        // We do this by running the forecast simulation up to the month BEFORE target
        // Current implementation of 'getForecast' runs from Month 0 (current) to N.

        // Calculate how many months from now is the target
        const now = new Date();

        // If target is in past, we just return actuals? 
        // But "Forecast" implies looking at it as a projection even if it's "this month".

        // Let's re-run the simulation logic but stop when we capture the target month.
        // Step 1: Initial Net Worth
        const balanceRows = await run(`
            SELECT SUM(amount) as total FROM (
                SELECT amount FROM transactions WHERE deleted_at IS NULL AND status IN ('posted', 'pending')
                UNION ALL
                SELECT ABS(amount) FROM transactions WHERE deleted_at IS NULL AND status IN ('posted', 'pending') AND to_account_id IS NOT NULL
                UNION ALL
                SELECT initial_balance FROM accounts
            )
        `);
        let runningBalance = balanceRows[0]?.total || 0;

        // Step 2: Prepare Automation
        const rules = await RecurringService.getAll();
        const activeRules = rules.filter(r => r.is_active);
        const ruleStates: RuleState[] = [];

        for (const rule of activeRules) {
            const countRows = await run('SELECT COUNT(*) as c FROM recurring_instances WHERE rule_id = ?', [rule.id]);
            const dbCount = countRows[0]?.c || 0;
            let current = parseISO(rule.start_date);
            const endDateLimit = rule.end_date ? parseISO(rule.end_date) : null;
            let tempDate = current;
            let tempCount = 0;
            let iterLimit = 0;
            // Advance to next non-generated occurrence
            while (tempCount < dbCount && iterLimit < 5000) {
                tempDate = this._getNextDate(tempDate, rule.frequency);
                tempCount++;
                iterLimit++;
            }
            ruleStates.push({ rule, nextDate: tempDate, totalCount: dbCount, endDateLimit });
        }

        const todayStr = format(new Date(), 'yyyy-MM-dd');

        // Determine number of months to simulate to reach target
        // We simulate from "now" until targetMonth. 
        // If targetMonth is "2026-05" and now is "2026-02", we loop 0 (Feb), 1 (Mar), 2 (Apr), 3 (May).
        // If target is BEFORE now, we just return empty/zeros or handle differently? 
        // Assuming target is future or current.

        // We loop until we hit the target month.
        // Optimization: We could just loop "months" index until the calculated date matches targetMonthStr

        let loopDate = now;
        let loopMonthStr = format(loopDate, 'yyyy-MM');

        // Safety: Limit 60 months
        let safety = 0;

        // Store opening balance of the target month
        let targetOpeningBalance = runningBalance;

        while (loopMonthStr <= targetMonthStr && safety < 60) {
            const isTarget = loopMonthStr === targetMonthStr;
            const monthEnd = endOfMonth(loopDate); // Use loopDate (start of month usually) for end check

            if (isTarget) {
                targetOpeningBalance = runningBalance;
            }

            // A. Existing Transactions
            // If it's the target month, we fetch details. If not, just sums.
            let monthlyIncome = 0;
            let monthlyExpense = 0;
            const currentMonthItems: ForecastDetailItem[] = [];

            if (isTarget) {
                const txs = await run(`
                    SELECT t.*, c.name as category_name 
                    FROM transactions t
                    LEFT JOIN categories c ON t.category_id = c.id
                    WHERE t.month = ? 
                      AND t.deleted_at IS NULL 
                      AND t.status IN ('posted', 'pending')
                      AND (t.source != 'transfer' OR t.source IS NULL)
                `, [loopMonthStr]);

                for (const tx of txs) {
                    const isExpense = tx.amount < 0;
                    const amountAttr = Math.abs(tx.amount);
                    if (isExpense) monthlyExpense += amountAttr;
                    else monthlyIncome += amountAttr;

                    currentMonthItems.push({
                        id: tx.id,
                        name: tx.note || 'Transaction',
                        amount: amountAttr,
                        date: tx.date,
                        type: 'manual',
                        is_expense: isExpense,
                        categoryName: tx.category_name || 'Uncategorized',
                        status: tx.status
                    });
                }
            } else {
                const dbStats = await run(`
                    SELECT 
                        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
                        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expense
                    FROM transactions 
                    WHERE month = ? 
                      AND deleted_at IS NULL 
                      AND status IN ('posted', 'pending')
                      AND (source != 'transfer' OR source IS NULL)
                `, [loopMonthStr]);
                monthlyIncome += dbStats[0]?.income || 0;
                monthlyExpense += dbStats[0]?.expense || 0;
            }

            // B. Future Automation
            let futureIncome = 0;
            let futureExpense = 0;

            // 1. Recurring Rules
            for (const state of ruleStates) {
                while (!isAfter(state.nextDate, monthEnd)) {
                    // Check Termination
                    if (state.rule.max_instances && state.totalCount >= state.rule.max_instances) break;
                    if (state.endDateLimit && isAfter(state.nextDate, state.endDateLimit)) break;

                    const dateStr = format(state.nextDate, 'yyyy-MM-dd');

                    // Condition: In this month AND (future OR not in DB yet)
                    // Simplified: if dateStr > todayStr and startsWith loopMonthStr
                    if (dateStr.startsWith(loopMonthStr) && dateStr > todayStr) {
                        const amt = Math.abs(state.rule.amount);
                        if (state.rule.amount > 0) {
                            futureIncome += amt;
                        } else {
                            futureExpense += amt;
                        }

                        if (isTarget) {
                            // Fetch category name
                            const cats = await run('SELECT name FROM categories WHERE id = ?', [state.rule.category_id]);
                            const catName = cats[0]?.name || 'Uncategorized';

                            currentMonthItems.push({
                                id: `recurring-${state.rule.id}-${dateStr}`,
                                name: state.rule.name,
                                amount: amt,
                                date: dateStr,
                                type: 'recurring',
                                is_expense: state.rule.amount < 0,
                                categoryName: catName,
                                status: 'projected'
                            });
                        }

                        state.totalCount++;
                    }

                    state.nextDate = this._getNextDate(state.nextDate, state.rule.frequency);
                    // Double check break
                    if (state.endDateLimit && isAfter(state.nextDate, state.endDateLimit)) break;
                    if (state.rule.max_instances && state.totalCount >= state.rule.max_instances) break;
                }
            }

            // 2. Installments
            if (isTarget) {
                const installmentsImpl = await run(`
                    SELECT 
                        ip.*, 
                        ip.amount as amount, 
                        ip.due_date, 
                        t.note as original_note,
                        p.tenor_months as total_installments,
                        (SELECT COUNT(*) FROM installment_payments ip2 WHERE ip2.plan_id = ip.plan_id AND ip2.due_date <= ip.due_date) as installment_number
                    FROM installment_payments ip
                    LEFT JOIN transactions t ON ip.linked_transaction_id = t.id
                    JOIN installment_plans p ON ip.plan_id = p.id
                    WHERE ip.due_month = ? 
                      AND ip.generated_transaction_id IS NULL 
                      AND ip.linked_transaction_id IS NULL
                      AND ip.due_date > ?
                 `, [loopMonthStr, todayStr]);

                for (const inst of installmentsImpl) {
                    const amt = Math.abs(inst.amount);
                    futureExpense += amt;

                    currentMonthItems.push({
                        id: `inst-${inst.id}`,
                        name: inst.original_note || 'Installment Payment',
                        amount: amt,
                        date: inst.due_date,
                        type: 'installment',
                        is_expense: true,
                        categoryName: 'Debt Repayment', // Default?
                        status: 'projected',
                        meta: {
                            current: inst.installment_number,
                            total: inst.total_installments
                        }
                    });
                }
            } else {
                const installments = await run(`
                    SELECT SUM(amount) as total 
                    FROM installment_payments 
                    WHERE due_month = ? 
                      AND generated_transaction_id IS NULL 
                      AND linked_transaction_id IS NULL
                      AND due_date > ?
                `, [loopMonthStr, todayStr]);
                futureExpense += (installments[0]?.total || 0);
            }

            // Update Loop Totals
            monthlyIncome += futureIncome;
            monthlyExpense += futureExpense;
            const netAutomation = futureIncome - futureExpense;
            runningBalance += netAutomation;

            if (isTarget) {
                return {
                    month: targetMonthStr,
                    openingBalance: targetOpeningBalance,
                    closingBalance: runningBalance,
                    income: {
                        total: monthlyIncome,
                        items: currentMonthItems.filter(i => !i.is_expense)
                    },
                    expense: {
                        total: monthlyExpense,
                        items: currentMonthItems.filter(i => i.is_expense)
                    }
                };
            }

            // Advance Loop
            loopDate = addMonths(loopDate, 1);
            loopMonthStr = format(loopDate, 'yyyy-MM');
            safety++;
        }

        // Fallback if target not reached (shouldn't happen if target is logical)
        return {
            month: targetMonthStr,
            openingBalance: 0,
            closingBalance: 0,
            income: { total: 0, items: [] },
            expense: { total: 0, items: [] }
        };
    },

    _getNextDate(date: Date, frequency: string): Date {
        switch (frequency) {
            case 'daily': return addDays(date, 1);
            case 'weekly': return addWeeks(date, 1);
            case 'biweekly': return addWeeks(date, 2);
            case 'monthly': return addMonths(date, 1);
            case 'quarterly': return addMonths(date, 3);
            case 'yearly': return addYears(date, 1);
            default: return addMonths(date, 1);
        }
    }
};
