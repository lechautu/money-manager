
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function checkMarch() {
    const SQL = await initSqlJs();
    const dbPath = path.join(process.cwd(), 'data', 'mm2.db');
    const db = new SQL.Database(fs.readFileSync(dbPath));

    const res = db.exec("SELECT id, date, amount, source, source_ref_id, note FROM transactions WHERE month = '2026-03' AND deleted_at IS NULL");
    if (res.length > 0) {
        res[0].values.forEach(v => console.log(v));
    }
    db.close();
}
checkMarch().catch(console.error);
