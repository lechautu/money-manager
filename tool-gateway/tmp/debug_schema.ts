
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

async function check() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db'));
    const res = db.exec("SELECT sql FROM sqlite_master WHERE name = 'recurring_instances'");
    console.log(res[0]?.values[0][0]);
}
check();
