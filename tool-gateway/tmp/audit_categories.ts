
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function auditCategories() {
    const SQL = await initSqlJs();
    const dbPath = path.join(process.cwd(), 'data', 'mm2.db');
    const db = new SQL.Database(fs.readFileSync(dbPath));

    console.log('--- Recurring Rules with NULL Category ---');
    const rr = db.exec("SELECT id, name, type, category_id FROM recurring_rules WHERE category_id IS NULL");
    if (rr.length > 0) rr[0].values.forEach(v => console.log(v));

    console.log('\n--- Installment Plans with NULL Category ---');
    const ip = db.exec("SELECT id, name, payment_category_id FROM installment_plans WHERE payment_category_id IS NULL");
    if (ip.length > 0) ip[0].values.forEach(v => console.log(v));

    console.log('\n--- Transactions (Income/Expense) with NULL Category in March ---');
    const tx = db.exec("SELECT id, note, amount, source FROM transactions WHERE month = '2026-03' AND category_id IS NULL AND source != 'transfer' AND deleted_at IS NULL");
    if (tx.length > 0) tx[0].values.forEach(v => console.log(v));

    db.close();
}
auditCategories().catch(console.error);
