
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

async function check() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db'));

    console.log('--- Recurring Instances for Test Manual Rule ---');
    const res = db.exec(`
        SELECT ri.date, ri.generated_transaction_id, rr.name
        FROM recurring_instances ri
        JOIN recurring_rules rr ON ri.rule_id = rr.id
        WHERE rr.name = 'Test Manual Rule'
    `);
    if (res[0]) {
        console.log(JSON.stringify(res[0].values, null, 2));
    } else {
        console.log('No instances found for Test Manual Rule');
    }

    console.log('\n--- All pending recurring instances ---');
    const pending = db.exec(`
        SELECT ri.date, rr.name
        FROM recurring_instances ri
        JOIN recurring_rules rr ON ri.rule_id = rr.id
        WHERE ri.generated_transaction_id IS NULL
    `);
    if (pending[0]) {
        console.log(JSON.stringify(pending[0].values, null, 2));
    } else {
        console.log('No pending instances found');
    }
}
check();
