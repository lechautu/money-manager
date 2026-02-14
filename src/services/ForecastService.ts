import { run } from '../db/client';
import { RecurringService } from '../services/RecurringService';
// import { InstallmentService } from '../services/InstallmentService';

export interface ForecastPoint {
    month: string;
    projectedBalance: number;
    income: number;
    expense: number;
}

export const ForecastService = {
    async getForecast(months: number = 12): Promise<ForecastPoint[]> {
        // 1. Get current balance (across all accounts? or selected?)
        // Requirement: "Forecast" usually implies global cashflow unless filtered.
        // Let's do Global for now.

        const balanceRows = await run('SELECT SUM(CASE WHEN status=\'posted\' THEN amount ELSE 0 END) as total FROM transactions');
        let currentBalance = balanceRows[0]?.total || 0;

        // 2. Get Active Recurring Rules
        const rules = await RecurringService.getAll();
        const activeRules = rules.filter(r => r.is_active);

        // 3. Get Active Installment Plans
        // Logic: For each future month, sum up:
        // - Recurring Income
        // - Recurring Expense
        // - Installment Payments (if any due)

        const points: ForecastPoint[] = [];
        const now = new Date();

        for (let i = 1; i <= months; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const monthStr = date.toISOString().slice(0, 7);

            let monthlyIncome = 0;
            let monthlyExpense = 0;

            // Process Rules
            for (const rule of activeRules) {
                // Check validity
                const ruleStartMonth = rule.start_date.slice(0, 7);
                const ruleEndMonth = rule.end_date ? rule.end_date.slice(0, 7) : null;

                if (monthStr < ruleStartMonth) continue;
                if (ruleEndMonth && monthStr > ruleEndMonth) continue;

                if (rule.amount >= 0) {
                    monthlyIncome += rule.amount;
                } else {
                    monthlyExpense += Math.abs(rule.amount);
                }
            }

            // Process Installments (Simplified: Assume InstallmentService could give us due payments)
            // Or query DB directly for future payments?
            // Installment payments are generated ahead of time in `installment_payments` table?
            // Let's check schema. `installment_payments` table has `due_month`. 
            // So we can query that table for future months!

            const installments = await run('SELECT SUM(amount) as total FROM installment_payments WHERE due_month = ?', [monthStr]);
            const instTotal = installments[0]?.total || 0;
            // Installments are expenses usually (positive amount in table? or negative? schema says REAL. usually absolute amount for payment)
            // Payments are typically expenses. 
            monthlyExpense += instTotal; // Assuming stored as positive amount due

            // Net Change
            const net = monthlyIncome - monthlyExpense;
            currentBalance += net;

            points.push({
                month: monthStr,
                projectedBalance: currentBalance,
                income: monthlyIncome,
                expense: monthlyExpense
            });
        }

        return points;
    }
};
