
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

async function check() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db'));

    console.log('--- Recurring Rules ---');
    const rules = db.exec("SELECT id, name, amount FROM recurring_rules");
    console.log(JSON.stringify(rules[0]?.values || [], null, 2));
}
check();
