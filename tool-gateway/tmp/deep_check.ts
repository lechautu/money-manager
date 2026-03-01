
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

async function check() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db'));

    console.log('--- Recurring Rules Detail ---');
    const rules = db.exec("SELECT id, name, amount, category_id, start_date, frequency FROM recurring_rules WHERE is_active = 1");
    console.log(JSON.stringify(rules[0]?.values || [], null, 2));

    console.log('--- March Transactions Detail ---');
    const txs = db.exec("SELECT id, date, amount, category_id, source, source_ref_id, note FROM transactions WHERE date LIKE '2026-03%' AND deleted_at IS NULL");
    console.log(JSON.stringify(txs[0]?.values || [], null, 2));
}
check();
