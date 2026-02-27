import { all, get, run, transaction } from '../db/client.js';
import { v4 as uuidv4 } from 'uuid';

export const RecurringService = {
    getAll() {
        return all('SELECT * FROM recurring_rules ORDER BY created_at DESC');
    },

    getById(id: string) {
        return get('SELECT * FROM recurring_rules WHERE id = ?', [id]);
    },

    create(data: Record<string, any>) {
        const id = uuidv4();
        const now = new Date().toISOString();
        run(
            `INSERT INTO recurring_rules (id, name, frequency, type, amount, start_date, end_date, max_instances, auto_add, default_status, is_active, account_id, to_account_id, category_id, sub_category_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, data.name || null, data.frequency, data.type, data.amount, data.start_date, data.end_date || null, data.max_instances || null, data.auto_add ?? 1, data.default_status || 'posted', 1, data.account_id, data.to_account_id || null, data.category_id || null, data.sub_category_id || null, now, now]
        );
        return get('SELECT * FROM recurring_rules WHERE id = ?', [id]);
    },

    update(id: string, data: Record<string, any>) {
        const now = new Date().toISOString();
        const fields: string[] = [];
        const args: any[] = [];

        const allowed = ['name', 'frequency', 'type', 'amount', 'start_date', 'end_date', 'max_instances', 'auto_add', 'default_status', 'is_active', 'account_id', 'to_account_id', 'category_id', 'sub_category_id'];
        for (const key of allowed) {
            if (data[key] !== undefined) { fields.push(`${key} = ?`); args.push(data[key]); }
        }
        if (fields.length === 0) return;

        fields.push('updated_at = ?');
        args.push(now);
        args.push(id);
        run(`UPDATE recurring_rules SET ${fields.join(', ')} WHERE id = ?`, args);
    },

    delete(id: string) {
        transaction(() => {
            run('DELETE FROM recurring_instances WHERE rule_id = ?', [id]);
            run('DELETE FROM recurring_rules WHERE id = ?', [id]);
        });
    },

    getInstances(ruleId?: string) {
        if (!ruleId) {
            return all('SELECT * FROM recurring_instances ORDER BY date');
        }
        return all('SELECT * FROM recurring_instances WHERE rule_id = ? ORDER BY date', [ruleId]);
    },

    generateInstances(ruleId?: string) {
        if (!ruleId) {
            const rules = all<any>('SELECT id FROM recurring_rules WHERE is_active = 1');
            let total = 0;
            for (const r of rules) {
                total += this.generateInstances(r.id).generated;
            }
            return { generated: total };
        }

        const rule = get<any>('SELECT * FROM recurring_rules WHERE id = ?', [ruleId]);
        if (!rule) throw new Error('Rule not found');

        const today = new Date().toISOString().substring(0, 10);
        const existingDates = new Set(
            all<any>('SELECT date FROM recurring_instances WHERE rule_id = ?', [ruleId]).map((r: any) => r.date)
        );

        let generated = 0;
        let currentDate = rule.start_date;
        const endDate = rule.end_date || today;

        while (currentDate <= endDate && currentDate <= today) {
            if (!existingDates.has(currentDate)) {
                const instanceId = uuidv4();
                let txId: string | null = null;

                if (rule.auto_add) {
                    txId = uuidv4();
                    const now = new Date().toISOString();
                    const month = currentDate.substring(0, 7);
                    const amount = rule.type === 'expense' ? -Math.abs(rule.amount) : Math.abs(rule.amount);

                    run(
                        `INSERT INTO transactions (id, account_id, to_account_id, date, month, amount, category_id, sub_category_id, status, source, source_ref_id, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'recurring', ?, ?, ?)`,
                        [txId, rule.account_id, rule.to_account_id || null, currentDate, month, amount, rule.category_id || null, rule.sub_category_id || null, rule.default_status || 'posted', ruleId, now, now]
                    );
                }

                run('INSERT INTO recurring_instances (id, rule_id, date, generated_transaction_id, created_at) VALUES (?, ?, ?, ?, ?)',
                    [instanceId, ruleId, currentDate, txId, new Date().toISOString()]);
                generated++;
            }

            // Advance date based on frequency
            currentDate = advanceDate(currentDate, rule.frequency);

            if (rule.max_instances && (existingDates.size + generated) >= rule.max_instances) break;
        }
        return { generated };
    },

    triggerInstance(ruleId: string, date: string) {
        const rule = get<any>('SELECT * FROM recurring_rules WHERE id = ?', [ruleId]);
        if (!rule) throw new Error('Rule not found');

        const txId = uuidv4();
        const now = new Date().toISOString();
        const month = date.substring(0, 7);
        const amount = rule.type === 'expense' ? -Math.abs(rule.amount) : Math.abs(rule.amount);

        run(
            `INSERT INTO transactions (id, account_id, to_account_id, date, month, amount, category_id, sub_category_id, status, source, source_ref_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'recurring', ?, ?, ?)`,
            [txId, rule.account_id, rule.to_account_id || null, date, month, amount, rule.category_id || null, rule.sub_category_id || null, rule.default_status || 'posted', ruleId, now, now]
        );

        const instanceId = uuidv4();
        run('INSERT OR REPLACE INTO recurring_instances (id, rule_id, date, generated_transaction_id, created_at) VALUES (?, ?, ?, ?, ?)',
            [instanceId, ruleId, date, txId, now]);

        return get('SELECT * FROM transactions WHERE id = ?', [txId]);
    },
};

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
