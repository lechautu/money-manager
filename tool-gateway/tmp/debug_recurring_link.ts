
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

async function check() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db'));

    console.log('--- Transactions (source=recurring) for March ---');
    const txs = db.exec("SELECT date, amount, source_ref_id, note FROM transactions WHERE source = 'recurring' AND date LIKE '2026-03%'");
    console.log(JSON.stringify(txs[0]?.values || [], null, 2));

    console.log('--- Transactions (March) with potential double counts (amount ~ 1,200,000) ---');
    const potential = db.exec("SELECT id, date, amount, source, source_ref_id, note FROM transactions WHERE date LIKE '2026-03%' AND (ABS(amount) = 1200000 OR ABS(amount) = 30000)");
    console.log(JSON.stringify(potential[0]?.values || [], null, 2));
}
check();
