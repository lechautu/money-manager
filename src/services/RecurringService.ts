import { run } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import { TransactionService } from './TransactionService';

import { addDays, addWeeks, addMonths, addYears, parseISO, format, isBefore, isAfter } from 'date-fns';

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
        return await run('SELECT * FROM recurring_rules ORDER BY created_at DESC');
    },

    async getById(id: string): Promise<RecurringRule | null> {
        const rows = await run('SELECT * FROM recurring_rules WHERE id = ?', [id]);
        return rows.length > 0 ? rows[0] : null;
    },

    async create(rule: Omit<RecurringRule, 'id' | 'created_at' | 'updated_at'>): Promise<RecurringRule> {
        // Validation
        if (rule.end_date && rule.end_date < rule.start_date) {
            throw new Error('End date cannot be before start date');
        }
        if (rule.max_instances !== null && rule.max_instances !== undefined && rule.max_instances <= 0) {
            throw new Error('Max instances must be greater than 0');
        }

        const id = uuidv4();
        const now = new Date().toISOString();
        const newRule: RecurringRule = { ...rule, id, created_at: now, updated_at: now };

        await run(
            `INSERT INTO recurring_rules 
            (id, name, type, frequency, account_id, to_account_id, amount, category_id, sub_category_id, start_date, end_date, max_instances, auto_add, default_status, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newRule.id, newRule.name, newRule.type, newRule.frequency, newRule.account_id, newRule.to_account_id || null,
                newRule.amount, newRule.category_id || null, newRule.sub_category_id || null,
                newRule.start_date, newRule.end_date || null, newRule.max_instances || null,
                newRule.auto_add, newRule.default_status, newRule.is_active,
                newRule.created_at, newRule.updated_at
            ]
        );

        // Immediate Trigger
        await this.generateInstances();

        return newRule;
    },

    async update(id: string, rule: Partial<Omit<RecurringRule, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
        // Fetch current to validate
        const currentRule = await this.getById(id);
        if (!currentRule) throw new Error('Rule not found');

        const newStartDate = rule.start_date ?? currentRule.start_date;
        const newEndDate = rule.end_date === undefined ? currentRule.end_date : rule.end_date;
        const newMaxInstances = rule.max_instances === undefined ? currentRule.max_instances : rule.max_instances;

        if (newEndDate && newEndDate < newStartDate) {
            throw new Error('End date cannot be before start date');
        }
        if (newMaxInstances !== null && newMaxInstances !== undefined && newMaxInstances <= 0) {
            throw new Error('Max instances must be greater than 0');
        }

        const now = new Date().toISOString();
        const fields: string[] = [];
        const args: any[] = [];

        const keys = Object.keys(rule) as (keyof typeof rule)[];
        for (const key of keys) {
            if ((key as string) === 'created_at' || (key as string) === 'updated_at' || (key as string) === 'id') continue;
            fields.push(`${key} = ?`);
            args.push(rule[key]);
        }

        if (fields.length === 0) return;

        fields.push('updated_at = ?');
        args.push(now);
        args.push(id);

        await run(`UPDATE recurring_rules SET ${fields.join(', ')} WHERE id = ?`, args);
        await this.generateInstances();
    },

    async delete(id: string): Promise<void> {
        await run('DELETE FROM recurring_rules WHERE id = ?', [id]);
    },

    async generateInstances() {
        // Horizon: Only up to today. Do not generate future transactions automatically.
        const horizonEnd = new Date();

        const rules = await run('SELECT * FROM recurring_rules WHERE is_active = 1');

        for (const rule of rules) {
            let current = parseISO(rule.start_date);
            const endDateLimit = rule.end_date ? parseISO(rule.end_date) : null;

            // Count total instances generated so far to respect max_instances
            const instanceCountResult = await run(
                'SELECT COUNT(*) as count FROM recurring_instances WHERE rule_id = ?',
                [rule.id]
            );
            let instanceCount = instanceCountResult[0].count;

            while (isBefore(current, horizonEnd)) {
                // TERMINATION: Max Instances
                if (rule.max_instances && instanceCount >= rule.max_instances) break;

                // TERMINATION: End Date
                if (endDateLimit && isAfter(current, endDateLimit)) break;

                const dateStr = format(current, 'yyyy-MM-dd');
                const monthStr = dateStr.slice(0, 7);

                // Check if already generated for this specific date
                const existing = await run(
                    'SELECT 1 FROM recurring_instances WHERE rule_id = ? AND date = ?',
                    [rule.id, dateStr]
                );

                if (existing.length === 0) {
                    // Double check count before creating
                    if (rule.max_instances && instanceCount >= rule.max_instances) break;

                    // If Auto-Add is OFF, we don't generate the transaction automatically
                    // The UI will handle showing the warning/manual add button
                    if (rule.auto_add === 0) {
                        // We skip generating for now, but the loop continues to check future dates
                        // Actually, we should probably stop here or just continue to next date
                        // But if we don't record an instance, we'll keep hitting this.
                        // For Manual rules, we only want to "warn", not "auto-populate" the instances table
                        // unless the user clicks "Add".
                        // So for now, we just don't do anything for auto_add=0 rules in this background service.
                        current = this.getNextDate(current, rule.frequency);
                        continue;
                    }

                    const tx = await TransactionService.create({
                        account_id: rule.account_id,
                        to_account_id: rule.type === 'transfer' ? rule.to_account_id : undefined,
                        date: dateStr,
                        month: monthStr,
                        amount: rule.amount,
                        category_id: rule.category_id || undefined,
                        sub_category_id: rule.sub_category_id || undefined,
                        status: rule.default_status as 'pending' | 'posted',
                        note: `Recurring: ${rule.name}`,
                        source: rule.type === 'transfer' ? 'transfer' : 'recurring',
                        source_ref_id: rule.id,
                        is_split: 0
                    });

                    const instanceId = uuidv4();
                    await run(
                        `INSERT INTO recurring_instances (id, rule_id, date, generated_transaction_id, created_at)
                        VALUES (?, ?, ?, ?, ?)`,
                        [instanceId, rule.id, dateStr, tx.id, new Date().toISOString()]
                    );

                    instanceCount++;
                    console.log(`Generated instance ${instanceCount} for ${rule.name} on ${dateStr}`);
                }

                // Increment
                current = this.getNextDate(current, rule.frequency);
            }
        }
    },

    async getAllInstances(): Promise<any[]> {
        return await run('SELECT * FROM recurring_instances');
    },

    async manualTrigger(ruleId: string, date: string): Promise<void> {
        const rule = await this.getById(ruleId);
        if (!rule) throw new Error('Rule not found');

        const dateStr = date;
        const monthStr = date.slice(0, 7);

        // Check if already generated
        const existing = await run(
            'SELECT 1 FROM recurring_instances WHERE rule_id = ? AND date = ?',
            [rule.id, dateStr]
        );
        if (existing.length > 0) throw new Error('Instance already exists for this date');

        const tx = await TransactionService.create({
            account_id: rule.account_id as string,
            to_account_id: rule.type === 'transfer' ? (rule.to_account_id as string) : undefined,
            date: dateStr,
            month: monthStr,
            amount: rule.amount,
            category_id: (rule.category_id as any),
            sub_category_id: (rule.sub_category_id as any),
            status: rule.default_status as 'pending' | 'posted',
            note: `Recurring (Manual): ${rule.name}`,
            source: rule.type === 'transfer' ? 'transfer' : 'recurring',
            source_ref_id: rule.id,
            is_split: 0
        });

        const instanceId = uuidv4();
        await run(
            `INSERT INTO recurring_instances (id, rule_id, date, generated_transaction_id, created_at)
            VALUES (?, ?, ?, ?, ?)`,
            [instanceId, rule.id, dateStr, tx.id, new Date().toISOString()]
        );
    },

    getNextOccurrence(rule: RecurringRule, generatedDates: string[]): string | null {
        let current = parseISO(rule.start_date);
        const endDateLimit = rule.end_date ? parseISO(rule.end_date) : null;
        const totalGenerated = generatedDates.length;

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
    }
};
