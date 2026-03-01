
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function dumpForecastData() {
    const SQL = await initSqlJs();
    const dbPath = path.join(process.cwd(), 'data', 'mm2.db');
    const db = new SQL.Database(fs.readFileSync(dbPath));

    const targetMonthStr = '2026-03';

    const recurringRules = db.exec(`
        SELECT r.name, r.type, c.name as category_name, sc.name as sub_category_name
        FROM recurring_rules r
        LEFT JOIN categories c ON r.category_id = c.id
        LEFT JOIN sub_categories sc ON r.sub_category_id = sc.id
        WHERE r.is_active = 1
    `)[0];
    console.log('--- Recurring Rules ---');
    if (recurringRules) recurringRules.values.forEach(v => console.log(v));

    const installments = db.exec(`
        SELECT pl.name, c.name, sc.name
        FROM installment_payments p
        JOIN installment_plans pl ON p.plan_id = pl.id
        LEFT JOIN categories c ON pl.payment_category_id = c.id
        LEFT JOIN sub_categories sc ON pl.payment_sub_category_id = sc.id
        WHERE p.due_month = '${targetMonthStr}'
    `)[0];
    console.log('\n--- Installments ---');
    if (installments) installments.values.forEach(v => console.log(v));

    const transactions = db.exec(`
        SELECT t.note, t.amount, t.source, c.name, sc.name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
        WHERE t.month = '${targetMonthStr}' AND t.deleted_at IS NULL AND t.status != 'ignored'
    `)[0];
    console.log('\n--- Transactions ---');
    if (transactions) transactions.values.forEach(v => console.log(v));

    db.close();
}
dumpForecastData().catch(console.error);
