import { run } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

export interface InstallmentPlan {
    id: string;
    name: string;
    credit_account_id: string;
    total_amount: number;
    tenor_months: number;
    start_date: string;
    notify_before_days: number;
    payment_source_account_id?: string;
    payment_category_id: string;
    payment_sub_category_id?: string;
    created_at: string;
    updated_at: string;
}

export interface InstallmentPayment {
    id: string;
    plan_id: string;
    due_date: string;
    due_month: string;
    amount: number;
    status: 'upcoming' | 'due' | 'overdue' | 'paid';
    paid_at?: string;
    linked_transaction_id?: string;
    generated_transaction_id?: string;
}

export const InstallmentService = {
    async getAll(): Promise<InstallmentPlan[]> {
        return await run('SELECT * FROM installment_plans ORDER BY created_at DESC');
    },

    async getById(id: string): Promise<InstallmentPlan | null> {
        const rows = await run('SELECT * FROM installment_plans WHERE id = ?', [id]);
        return rows.length > 0 ? rows[0] : null;
    },

    async getPaymentsByPlan(planId: string): Promise<InstallmentPayment[]> {
        return await run('SELECT * FROM installment_payments WHERE plan_id = ? ORDER BY due_date ASC', [planId]);
    },

    async create(plan: Omit<InstallmentPlan, 'id' | 'created_at' | 'updated_at'>): Promise<InstallmentPlan> {
        const id = uuidv4();
        const now = new Date().toISOString();
        const newPlan: InstallmentPlan = { ...plan, id, created_at: now, updated_at: now };

        // 1. Insert Plan
        await run(
            `INSERT INTO installment_plans 
            (id, name, credit_account_id, total_amount, tenor_months, start_date, notify_before_days, payment_source_account_id, payment_category_id, payment_sub_category_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newPlan.id, newPlan.name, newPlan.credit_account_id, newPlan.total_amount,
                newPlan.tenor_months, newPlan.start_date, newPlan.notify_before_days,
                newPlan.payment_source_account_id || null, newPlan.payment_category_id,
                newPlan.payment_sub_category_id || null,
                newPlan.created_at, newPlan.updated_at
            ]
        );

        // 2. Generate Schedule
        const monthlyAmount = Math.floor((newPlan.total_amount / newPlan.tenor_months) * 100) / 100;
        let remaining = newPlan.total_amount;

        const startDate = new Date(newPlan.start_date);

        for (let i = 0; i < newPlan.tenor_months; i++) {
            const isLast = i === newPlan.tenor_months - 1;
            const amount = isLast ? Number(remaining.toFixed(2)) : monthlyAmount;
            remaining -= amount;

            // Calculate Due Date: Start Date + i months
            const dueDate = new Date(startDate);
            dueDate.setMonth(startDate.getMonth() + i);
            const dueDateStr = dueDate.toISOString().slice(0, 10);
            const dueMonth = dueDateStr.slice(0, 7);

            const paymentId = uuidv4();
            await run(
                `INSERT INTO installment_payments (id, plan_id, due_date, due_month, amount, status)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [paymentId, newPlan.id, dueDateStr, dueMonth, amount, 'upcoming']
            );
        }

        return newPlan;
    },

    async delete(id: string): Promise<void> {
        // Cascade delete handles payments
        await run('DELETE FROM installment_plans WHERE id = ?', [id]);
    },

    async checkOverdue(): Promise<void> {
        const today = new Date().toISOString().slice(0, 10);
        await run(
            "UPDATE installment_payments SET status = 'overdue' WHERE status = 'upcoming' AND due_date < ?",
            [today]
        );

        await run(
            "UPDATE installment_payments SET status = 'due' WHERE status = 'upcoming' AND due_date = ?",
            [today]
        );

        // Auto-create expense transactions for due/overdue payments that haven't been generated yet
        const paymentsToGenerate = await run(`
            SELECT p.*, plan.name as plan_name, plan.credit_account_id, plan.payment_category_id, plan.payment_sub_category_id, plan.tenor_months 
            FROM installment_payments p
            JOIN installment_plans plan ON p.plan_id = plan.id
            WHERE (p.status = 'due' OR p.status = 'overdue' OR p.due_date <= ?) 
            AND p.generated_transaction_id IS NULL
        `, [today]);

        for (const p of paymentsToGenerate) {
            // We need to calculate which installment number this is
            // A simple way is to count payments for this plan with due_date <= p.due_date
            const countRes = await run('SELECT count(*) as c FROM installment_payments WHERE plan_id = ? AND due_date <= ?', [p.plan_id, p.due_date]);
            const number = countRes[0].c;

            const note = `Installment ${number}/${p.tenor_months} - ${p.plan_name}`;

            // Create Expense Transaction
            const txId = uuidv4();
            const now = new Date().toISOString();

            await run(
                `INSERT INTO transactions 
                (id, account_id, date, month, amount, category_id, sub_category_id, status, note, source, source_ref_id, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    txId, p.credit_account_id, p.due_date, p.due_month, -p.amount,
                    p.payment_category_id, p.payment_sub_category_id || null, 'posted', note,
                    'installment', p.id, now, now
                ]
            );

            // Update payment with generated_transaction_id
            await run('UPDATE installment_payments SET generated_transaction_id = ? WHERE id = ?', [txId, p.id]);
        }
    },

    async markPaid(paymentId: string, transactionId: string): Promise<void> {
        const now = new Date().toISOString();
        await run(
            "UPDATE installment_payments SET status = 'paid', paid_at = ?, linked_transaction_id = ? WHERE id = ?",
            [now, transactionId, paymentId]
        );
    }
};
