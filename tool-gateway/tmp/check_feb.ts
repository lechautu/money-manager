
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

async function checkFeb() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db'));

    console.log('--- February Manual Transactions ---');
    const txs = db.exec("SELECT id, date, amount, category_id, note FROM transactions WHERE month = '2026-02' AND source = 'manual' AND deleted_at IS NULL AND amount < 0");
    console.log(JSON.stringify(txs[0]?.values || [], null, 2));
}
checkFeb();
