import { getDB, run } from './client';

export async function getLocalDataSnapshot(): Promise<any> {
    const tables = [
        'meta', 'settings', 'accounts', 'categories', 'sub_categories',
        'transactions', 'transaction_splits', 'installment_plans', 'installment_payments',
        'recurring_rules', 'recurring_instances', 'budgets',
        'audit_logs'
    ];

    const data: any = { tables: {} };
    await getDB();
    for (const table of tables) {
        try {
            const rows = await run(`SELECT * FROM ${table}`);
            data.tables[table] = rows;
        } catch (e) {
            console.warn(`Export table ${table} failed`, e);
        }
    }
    return data;
}
