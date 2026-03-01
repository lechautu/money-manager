
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function checkIPSchema() {
    const SQL = await initSqlJs();
    const dbPath = path.join(process.cwd(), 'data', 'mm2.db');
    const db = new SQL.Database(fs.readFileSync(dbPath));

    db.exec('PRAGMA table_info(installment_payments)')[0].values.forEach(v => console.log(v));
    db.close();
}
checkIPSchema().catch(console.error);
