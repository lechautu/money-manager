import { ToolExecutionService } from './ToolExecutionService';

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
    auto_add: number; // 0 or 1
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
    linked_transaction_id?: string;
    generated_transaction_id?: string;
    expense_transaction_id?: string;
    paid_at?: string;
}

export const InstallmentService = {
    async getAll(): Promise<InstallmentPlan[]> {
        const res = await ToolExecutionService.executeTool('get_installment_plans', {});
        return res.data;
    },

    async getById(id: string): Promise<InstallmentPlan | null> {
        const all = await this.getAll();
        return all.find(i => i.id === id) || null;
    },

    async getPaymentsByPlan(planId: string): Promise<InstallmentPayment[]> {
        const res = await ToolExecutionService.executeTool('get_installment_schedule', { planId });
        return res.data;
    },

    async create(plan: Omit<InstallmentPlan, 'id' | 'created_at' | 'updated_at'>): Promise<InstallmentPlan> {
        const res = await ToolExecutionService.executeTool('create_installment_plan', plan);
        return res.data;
    },

    async update(id: string, plan: Partial<Omit<InstallmentPlan, 'id' | 'created_at' | 'updated_at'>>): Promise<InstallmentPlan> {
        const res = await ToolExecutionService.executeTool('update_installment_plan', { id, ...plan });
        return res.data;
    },

    async delete(id: string): Promise<void> {
        await ToolExecutionService.executeTool('delete_installment_plan', { id });
    },

    async checkOverdue(): Promise<void> {
        await ToolExecutionService.executeTool('check_overdue_installments', {});
    },

    async markPaid(paymentId: string, transactionId: string): Promise<void> {
        await ToolExecutionService.executeTool('pay_installment', { paymentId, transactionId });
    },

    async getPendingCount(): Promise<number> {
        const res = await ToolExecutionService.executeTool('get_pending_installment_count', {});
        return res.data.count;
    },

    async linkTransaction(paymentId: string, transactionId: string, type: 'expense' | 'payment'): Promise<void> {
        await ToolExecutionService.executeTool('link_installment_transaction', { paymentId, transactionId, type });
    }
};
