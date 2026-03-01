
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

async function checkMarchDetails() {
    const SQL = await initSqlJs();
    const dbData = readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db');
    const db = new SQL.Database(dbData);

    console.log('--- March 2026 Transactions ---');
    const res = db.exec("SELECT id, date, amount, category_id, note, source FROM transactions WHERE month = '2026-03' AND deleted_at IS NULL");

    console.log(JSON.stringify(res[0]?.values || [], null, 2));
}

checkMarchDetails().catch(console.error);
