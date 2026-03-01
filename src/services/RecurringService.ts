import { addDays, addWeeks, addMonths, addYears, parseISO, format, isAfter } from 'date-fns';
import { ToolExecutionService } from './ToolExecutionService';

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringRule {
    id: string;
    name: string;
    type: 'income' | 'expense' | 'transfer';
    frequency: RecurringFrequency;
    account_id: string;
    to_account_id?: string | null;
    amount: number;
    category_id?: string | null;
    sub_category_id?: string | null;
    start_date: string; // YYYY-MM-DD
    end_date?: string | null; // YYYY-MM-DD
    max_instances?: number | null;
    auto_add: number; // 0 or 1
    default_status: 'pending' | 'posted';
    is_active: number; // 0 or 1
    created_at: string;
    updated_at: string;
}

export const RecurringService = {
    async getAll(): Promise<RecurringRule[]> {
        const res = await ToolExecutionService.executeTool('get_recurring_rules', {});
        return res.data;
    },

    async getById(id: string): Promise<RecurringRule | null> {
        const all = await this.getAll();
        return all.find(r => r.id === id) || null;
    },

    async create(rule: Omit<RecurringRule, 'id' | 'created_at' | 'updated_at'>): Promise<RecurringRule> {
        const res = await ToolExecutionService.executeTool('create_recurring_rule', rule);
        return res.data;
    },

    async update(id: string, rule: Partial<Omit<RecurringRule, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
        await ToolExecutionService.executeTool('update_recurring_rule', { id, ...rule });
    },

    async delete(id: string): Promise<void> {
        await ToolExecutionService.executeTool('delete_recurring_rule', { id });
    },

    async generateInstances() {
        await ToolExecutionService.executeTool('generate_recurring_instances', {});
    },

    async getAllInstances(): Promise<any[]> {
        const res = await ToolExecutionService.executeTool('get_recurring_instances', {});
        return res.data;
    },

    async manualTrigger(ruleId: string, date: string): Promise<void> {
        await ToolExecutionService.executeTool('trigger_recurring_instance', { ruleId, date });
    },

    getNextOccurrence(rule: RecurringRule, instances: any[]): string | null {
        let current = parseISO(rule.start_date);
        const endDateLimit = rule.end_date ? parseISO(rule.end_date) : null;
        const totalGenerated = instances.length;
        const generatedDates = instances.map(i => i.date);

        if (rule.max_instances && totalGenerated >= rule.max_instances) return null;

        // Safety limit to avoid infinite loops
        for (let i = 0; i < 500; i++) {
            const dateStr = format(current, 'yyyy-MM-dd');
            if (!generatedDates.includes(dateStr)) {
                if (endDateLimit && isAfter(current, endDateLimit)) return null;
                return dateStr;
            }
            current = this.getNextDate(current, rule.frequency);
        }
        return null;
    },

    getNextDate(date: Date, frequency: RecurringFrequency): Date {
        switch (frequency) {
            case 'daily': return addDays(date, 1);
            case 'weekly': return addWeeks(date, 1);
            case 'biweekly': return addWeeks(date, 2);
            case 'monthly': return addMonths(date, 1);
            case 'quarterly': return addMonths(date, 3);
            case 'yearly': return addYears(date, 1);
            default: return addMonths(date, 1);
        }
    },

    async getPendingCount(): Promise<number> {
        const res = await ToolExecutionService.executeTool('get_pending_recurring_count', {});
        return res.data.count;
    },

    async linkTransaction(ruleId: string, transactionId: string, date?: string): Promise<void> {
        await ToolExecutionService.executeTool('link_recurring_transaction', { ruleId, transactionId, date });
    }
};
