
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function checkSchema() {
    const SQL = await initSqlJs();
    const dbPath = path.join(process.cwd(), 'data', 'mm2.db');
    const db = new SQL.Database(fs.readFileSync(dbPath));

    console.log('--- DB Schema Check ---');
    const tables = ['recurring_rules', 'installment_plans', 'transactions'];
    for (const table of tables) {
        const info = db.exec(`PRAGMA table_info(${table})`)[0];
        console.log(`Table: ${table}`);
        info.values.forEach(v => console.log(` - ${v[1]} (${v[2]})`));
    }

    db.close();
}
checkSchema().catch(console.error);
