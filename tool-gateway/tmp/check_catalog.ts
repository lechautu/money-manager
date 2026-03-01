
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function checkCatalog() {
    const SQL = await initSqlJs();
    const dbPath = path.join(process.cwd(), 'data', 'mm2.db');
    const db = new SQL.Database(fs.readFileSync(dbPath));

    console.log('--- categories table_info ---');
    db.exec('PRAGMA table_info(categories)')[0].values.forEach(v => console.log(v));

    console.log('\n--- sub_categories table_info ---');
    db.exec('PRAGMA table_info(sub_categories)')[0].values.forEach(v => console.log(v));

    db.close();
}
checkCatalog().catch(console.error);
