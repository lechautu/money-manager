import { run } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import { TransactionService } from './TransactionService';

export interface RecurringRule {
    id: string;
    name: string;
    account_id: string;
    amount: number;
    category_id: string;
    sub_category_id?: string;
    start_month: string; // YYYY-MM
    end_month?: string; // YYYY-MM
    day_of_month: number; // 1-28
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
        const id = uuidv4();
        const now = new Date().toISOString();
        const newRule: RecurringRule = { ...rule, id, created_at: now, updated_at: now };

        await run(
            `INSERT INTO recurring_rules 
            (id, name, account_id, amount, category_id, sub_category_id, start_month, end_month, day_of_month, default_status, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newRule.id, newRule.name, newRule.account_id, newRule.amount,
                newRule.category_id, newRule.sub_category_id || null,
                newRule.start_month, newRule.end_month || null,
                newRule.day_of_month, newRule.default_status, newRule.is_active,
                newRule.created_at, newRule.updated_at
            ]
        );

        // Immediate Trigger: Try to generate for current month and next 3 months
        await this.generateInstances();

        return newRule;
    },

    async update(id: string, rule: Partial<Omit<RecurringRule, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
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

        // Retrigger generation as parameters might have changed
        await this.generateInstances();
    },

    async delete(id: string): Promise<void> {
        await run('DELETE FROM recurring_rules WHERE id = ?', [id]);
    },

    async generateInstances() {
        // Horizon: Current Month + 3 Future Months
        const now = new Date();
        const months: string[] = [];

        for (let i = 0; i <= 3; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const m = d.toISOString().slice(0, 7); // YYYY-MM
            months.push(m);
        }

        // Fetch active rules
        const rules = await run('SELECT * FROM recurring_rules WHERE is_active = 1');

        for (const rule of rules) {
            for (const month of months) {
                // Check start/end constraints
                if (month < rule.start_month) continue;
                if (rule.end_month && month > rule.end_month) continue;

                // Check if already generated
                const existing = await run(
                    'SELECT 1 FROM recurring_instances WHERE rule_id = ? AND month = ?',
                    [rule.id, month]
                );

                if (existing.length === 0) {
                    // Generate Transaction
                    // Date = YYYY-MM-{day_of_month}
                    const day = rule.day_of_month.toString().padStart(2, '0');
                    const date = `${month}-${day}`;

                    // Create Transaction via TransactionService
                    const tx = await TransactionService.create({
                        account_id: rule.account_id,
                        date: date,
                        month: month,
                        amount: rule.amount,
                        category_id: rule.category_id,
                        sub_category_id: rule.sub_category_id,
                        status: rule.default_status as 'pending' | 'posted', // cast safely
                        note: `Recurring: ${rule.name}`,
                        source: 'recurring',
                        source_ref_id: rule.id
                    });

                    // Record Instance
                    const instanceId = uuidv4();
                    const createdAt = new Date().toISOString();
                    await run(
                        `INSERT INTO recurring_instances (id, rule_id, month, generated_transaction_id, created_at)
                        VALUES (?, ?, ?, ?, ?)`,
                        [instanceId, rule.id, month, tx.id, createdAt]
                    );

                    console.log(`Generated recurring transaction for rule ${rule.name} for ${month}`);
                }
            }
        }
    }
};
