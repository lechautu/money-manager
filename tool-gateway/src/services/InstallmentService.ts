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
                `INSERT INTO installment_plans (id, name, credit_account_id, payment_source_account_id, total_amount, tenor_months, start_date, payment_category_id, payment_sub_category_id, auto_add, default_status, payee_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, data.name || null, data.credit_account_id, data.payment_source_account_id || null, data.total_amount, data.tenor_months, data.start_date, data.payment_category_id || null, data.payment_sub_category_id || null, (data.auto_add ?? 1) ? 1 : 0, data.default_status || 'pending', data.payee_id || null, now, now]
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

            const result = get('SELECT * FROM installment_plans WHERE id = ?', [id]);

            // If auto_add is enabled, run a check immediately in case the first payment is today
            if (data.auto_add) {
                setTimeout(() => this.checkOverdue(), 100);
            }

            return result;
        });
    },

    checkOverdue() {
        const today = new Date().toISOString().substring(0, 10);
        console.log(`[CHECK] Checking overdue installments for today: ${today}`);

        run("UPDATE installment_payments SET status = 'due' WHERE status = 'upcoming' AND due_date = ?", [today]);
        run("UPDATE installment_payments SET status = 'overdue' WHERE status IN ('upcoming', 'due') AND due_date < ?", [today]);

        // Auto-add expense transaction if enabled
        const autoAdds = all<any>(`
            SELECT p.id as payment_id, p.amount, p.due_date, p.due_month, plan.credit_account_id, plan.payment_category_id, plan.payment_sub_category_id, plan.name as plan_name, plan.payee_id, plan.default_status, p.expense_transaction_id
            FROM installment_payments p
            JOIN installment_plans plan ON p.plan_id = plan.id
            WHERE p.status IN ('due', 'overdue')
              AND plan.auto_add = 1
              AND (p.expense_transaction_id IS NULL OR p.expense_transaction_id IN (SELECT id FROM transactions WHERE deleted_at IS NOT NULL))
        `);

        console.log(`[CHECK] Found ${autoAdds.length} installments to auto-add as expenses`);

        for (const aa of autoAdds) {
            try {
                const now = new Date().toISOString();
                const month = aa.due_date.substring(0, 7);

                // Smart Check: Avoid auto-adding if a transaction already exists on that day with same amount/category
                const matchedTx = get<any>(
                    "SELECT id FROM transactions WHERE date = ? AND category_id = ? AND amount = ? AND deleted_at IS NULL",
                    [aa.due_date, aa.payment_category_id || null, -Math.abs(aa.amount)]
                );

                if (matchedTx) {
                    console.log(`[CHECK] Transaction already exists for installment ${aa.payment_id}. Linking instead of adding new.`);
                    run("UPDATE transactions SET source = 'installment', source_ref_id = ?, note = COALESCE(note, ?) WHERE id = ?",
                        [aa.payment_id, `Installment: ${aa.plan_name || aa.payment_id}`, matchedTx.id]);
                    run("UPDATE installment_payments SET expense_transaction_id = ? WHERE id = ?", [matchedTx.id, aa.payment_id]);
                } else {
                    const txId = uuidv4();
                    console.log(`[ACTION] Auto-adding EXPENSE for installment ${aa.payment_id} (Plan: ${aa.plan_name}) to ${aa.credit_account_id}`);
                    run(
                        `INSERT INTO transactions (id, account_id, to_account_id, date, month, amount, category_id, sub_category_id, status, source, source_ref_id, note, payee_id, created_at, updated_at)
                         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'installment', ?, ?, ?, ?, ?)`,
                        [txId, aa.credit_account_id, aa.due_date, month, -Math.abs(aa.amount), aa.payment_category_id, aa.payment_sub_category_id || null, aa.default_status || 'posted', aa.payment_id, `Installment: ${aa.plan_name || aa.payment_id}`, aa.payee_id || null, now, now]
                    );
                    run("UPDATE installment_payments SET expense_transaction_id = ? WHERE id = ?", [txId, aa.payment_id]);
                }
            } catch (e) {
                console.error(`Failed to auto-add installment expense ${aa.payment_id}`, e);
            }
        }

        return { checked: true, autoAdded: autoAdds.length };
    },

    payInstallment(paymentId: string, fromAccountId: string, toAccountId: string) {
        return transaction(() => {
            const payment = get<any>('SELECT * FROM installment_payments WHERE id = ?', [paymentId]);
            if (!payment) throw new Error('Payment not found');

            const plan = get<any>('SELECT * FROM installment_plans WHERE id = ?', [payment.plan_id]);
            if (!plan) throw new Error('Plan not found');

            const now = new Date().toISOString();
            const date = now.substring(0, 10);
            const month = date.substring(0, 7);

            // 1. If the expense hasn't been recorded yet (common if auto_add is off), record it now
            if (!payment.expense_transaction_id) {
                const expenseTxId = uuidv4();
                console.log(`[ACTION] Manual pay trigger: Adding missing EXPENSE for installment ${paymentId} to ${plan.credit_account_id}`);
                run(
                    `INSERT INTO transactions (id, account_id, to_account_id, date, month, amount, category_id, sub_category_id, status, source, source_ref_id, note, payee_id, created_at, updated_at)
                     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'installment', ?, ?, ?, ?, ?)`,
                    [expenseTxId, plan.credit_account_id, payment.due_date, payment.due_month, -Math.abs(payment.amount), plan.payment_category_id, plan.payment_sub_category_id || null, plan.default_status || 'posted', paymentId, `Installment: ${plan.name || plan.id}`, plan.payee_id || null, now, now]
                );
                run("UPDATE installment_payments SET expense_transaction_id = ? WHERE id = ?", [expenseTxId, paymentId]);
            }

            // 2. Create transfer transaction (The actual payment)
            const txId = uuidv4();
            run(
                `INSERT INTO transactions (id, account_id, to_account_id, date, month, amount, category_id, sub_category_id, status, source, source_ref_id, note, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'posted', 'installment', ?, ?, ?, ?)`,
                [txId, fromAccountId, toAccountId, date, month, -Math.abs(payment.amount), plan.payment_category_id, plan.payment_sub_category_id, paymentId, `Payment for ${plan.name || plan.id}`, now, now]
            );

            // 3. Update payment status
            run("UPDATE installment_payments SET status = 'paid', generated_transaction_id = ?, paid_at = ? WHERE id = ?",
                [txId, now, paymentId]);

            return get('SELECT * FROM installment_payments WHERE id = ?', [paymentId]);
        });
    },

    markPaid(paymentId: string, transactionId: string) {
        const now = new Date().toISOString();
        run("UPDATE installment_payments SET status = 'paid', generated_transaction_id = ?, paid_at = ? WHERE id = ?",
            [transactionId, now, paymentId]);
        return get('SELECT * FROM installment_payments WHERE id = ?', [paymentId]);
    },

    update(id: string, data: Record<string, any>) {
        const now = new Date().toISOString();
        const fields: string[] = [];
        const args: any[] = [];

        const allowed = ['name', 'auto_add', 'default_status', 'payment_source_account_id', 'payment_category_id', 'payment_sub_category_id', 'notify_before_days', 'payee_id'];
        for (const key of allowed) {
            if (data[key] !== undefined) {
                fields.push(`${key} = ?`);
                args.push(data[key]);
            }
        }
        if (fields.length === 0) return;

        fields.push('updated_at = ?');
        args.push(now);
        args.push(id);

        run(`UPDATE installment_plans SET ${fields.join(', ')} WHERE id = ?`, args);

        // If auto_add was turned on, run check
        if (data.auto_add === 1 || data.auto_add === true) {
            setTimeout(() => this.checkOverdue(), 100);
        }

        return get('SELECT * FROM installment_plans WHERE id = ?', [id]);
    },

    delete(id: string) {
        transaction(() => {
            // Unlink transactions
            run(`
                UPDATE transactions 
                SET source = 'manual', source_ref_id = NULL 
                WHERE source = 'installment' AND source_ref_id IN (
                    SELECT id FROM installment_payments WHERE plan_id = ?
                )
            `, [id]);

            run('DELETE FROM installment_payments WHERE plan_id = ?', [id]);
            run('DELETE FROM installment_plans WHERE id = ?', [id]);
        });
    },

    getPendingCount() {
        const result = get<any>("SELECT COUNT(*) as count FROM installment_payments WHERE status IN ('due', 'overdue')");
        return result?.count || 0;
    },

    linkTransaction(paymentId: string, transactionId: string, type: 'expense' | 'payment') {
        return transaction(() => {
            const payment = get<any>('SELECT * FROM installment_payments WHERE id = ?', [paymentId]);
            if (!payment) throw new Error('Payment not found');

            const plan = get<any>('SELECT * FROM installment_plans WHERE id = ?', [payment.plan_id]);
            if (!plan) throw new Error('Plan not found');

            const now = new Date().toISOString();

            if (type === 'expense') {
                run("UPDATE transactions SET source = 'installment', source_ref_id = ?, note = COALESCE(note, ?) WHERE id = ?",
                    [paymentId, `Installment: ${plan.name || paymentId}`, transactionId]);
                run("UPDATE installment_payments SET expense_transaction_id = ? WHERE id = ?", [transactionId, paymentId]);
            } else {
                run("UPDATE transactions SET source = 'installment', source_ref_id = ?, note = COALESCE(note, ?) WHERE id = ?",
                    [paymentId, `Payment for ${plan.name || paymentId}`, transactionId]);
                run("UPDATE installment_payments SET status = 'paid', generated_transaction_id = ?, paid_at = ? WHERE id = ?",
                    [transactionId, now, paymentId]);
            }

            return { success: true };
        });
    }
};
