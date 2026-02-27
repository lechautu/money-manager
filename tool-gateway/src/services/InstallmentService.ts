import { all, get, run, transaction } from '../db/client.js';
import { v4 as uuidv4 } from 'uuid';

export const InstallmentService = {
    getAll() {
        return all('SELECT * FROM installment_plans ORDER BY created_at DESC');
    },

    getSchedule(planId: string) {
        return all('SELECT * FROM installment_payments WHERE plan_id = ? ORDER BY due_date', [planId]);
    },

    create(data: Record<string, any>) {
        return transaction(() => {
            const id = uuidv4();
            const now = new Date().toISOString();
            run(
                `INSERT INTO installment_plans (id, name, credit_account_id, payment_source_account_id, total_amount, tenor_months, start_date, payment_category_id, payment_sub_category_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, data.name || null, data.credit_account_id, data.payment_source_account_id || null, data.total_amount, data.tenor_months, data.start_date, data.payment_category_id || null, data.payment_sub_category_id || null, now, now]
            );

            // Generate payment schedule
            const monthlyAmount = Math.round((data.total_amount / data.tenor_months) * 100) / 100;
            const startDate = new Date(data.start_date + 'T00:00:00Z');

            for (let i = 0; i < data.tenor_months; i++) {
                const dueDate = new Date(startDate);
                dueDate.setUTCMonth(dueDate.getUTCMonth() + i);
                const paymentId = uuidv4();
                const isLast = i === data.tenor_months - 1;
                const amt = isLast ? data.total_amount - monthlyAmount * (data.tenor_months - 1) : monthlyAmount;
                const dueDateStr = dueDate.toISOString().substring(0, 10);
                const dueMonth = dueDateStr.substring(0, 7);

                run(
                    `INSERT INTO installment_payments (id, plan_id, due_date, due_month, amount, status)
                     VALUES (?, ?, ?, ?, ?, 'upcoming')`,
                    [paymentId, id, dueDateStr, dueMonth, Math.round(amt * 100) / 100]
                );
            }

            return get('SELECT * FROM installment_plans WHERE id = ?', [id]);
        });
    },

    checkOverdue() {
        const today = new Date().toISOString().substring(0, 10);
        run("UPDATE installment_payments SET status = 'due' WHERE status = 'upcoming' AND due_date = ?", [today]);
        run("UPDATE installment_payments SET status = 'overdue' WHERE status IN ('upcoming', 'due') AND due_date < ?", [today]);
        return { checked: true };
    },

    payInstallment(paymentId: string, fromAccountId: string, toAccountId: string) {
        return transaction(() => {
            const payment = get<any>('SELECT * FROM installment_payments WHERE id = ?', [paymentId]);
            if (!payment) throw new Error('Payment not found');

            const plan = get<any>('SELECT * FROM installment_plans WHERE id = ?', [payment.plan_id]);
            if (!plan) throw new Error('Plan not found');

            // Create transfer transaction
            const txId = uuidv4();
            const now = new Date().toISOString();
            const date = new Date().toISOString().substring(0, 10);
            const month = date.substring(0, 7);

            run(
                `INSERT INTO transactions (id, account_id, to_account_id, date, month, amount, category_id, sub_category_id, status, source, source_ref_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'posted', 'installment', ?, ?, ?)`,
                [txId, fromAccountId, toAccountId, date, month, -Math.abs(payment.amount), plan.payment_category_id, plan.payment_sub_category_id, paymentId, now, now]
            );

            // Update payment status
            run("UPDATE installment_payments SET status = 'paid', linked_transaction_id = ?, paid_at = ? WHERE id = ?",
                [txId, now, paymentId]);

            return get('SELECT * FROM installment_payments WHERE id = ?', [paymentId]);
        });
    },

    delete(id: string) {
        transaction(() => {
            run('DELETE FROM installment_payments WHERE plan_id = ?', [id]);
            run('DELETE FROM installment_plans WHERE id = ?', [id]);
        });
    },
};
