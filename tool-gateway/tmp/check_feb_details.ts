
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

async function checkFebDetails() {
    const SQL = await initSqlJs();
    const dbData = readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db');
    const db = new SQL.Database(dbData);

    console.log('--- Feb 2026 Transactions ---');
    const res = db.exec("SELECT id, date, amount, category_id, note, source FROM transactions WHERE month = '2026-02' AND deleted_at IS NULL");

    console.log(JSON.stringify(res[0]?.values || [], null, 2));
}

checkFebDetails().catch(console.error);
