
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function checkCatalogIntegrity() {
    const SQL = await initSqlJs();
    const dbPath = path.join(process.cwd(), 'data', 'mm2.db');
    const db = new SQL.Database(fs.readFileSync(dbPath));

    console.log('--- Orphaned categories in recurring_rules ---');
    const rr = db.exec("SELECT id, category_id FROM recurring_rules WHERE category_id IS NOT NULL AND category_id NOT IN (SELECT id FROM categories)");
    if (rr.length > 0) rr[0].values.forEach(v => console.log(v));

    console.log('\n--- Orphaned categories in installment_plans ---');
    const ip = db.exec("SELECT id, payment_category_id FROM installment_plans WHERE payment_category_id IS NOT NULL AND payment_category_id NOT IN (SELECT id FROM categories)");
    if (ip.length > 0) ip[0].values.forEach(v => console.log(v));

    console.log('\n--- Orphaned categories in transactions ---');
    const tx = db.exec("SELECT id, category_id FROM transactions WHERE category_id IS NOT NULL AND category_id NOT IN (SELECT id FROM categories)");
    if (tx.length > 0) tx[0].values.forEach(v => console.log(v));

    db.close();
}
checkCatalogIntegrity().catch(console.error);
