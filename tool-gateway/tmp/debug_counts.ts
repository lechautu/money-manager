
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

async function check() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db'));

    const inst = db.exec("SELECT COUNT(*) FROM installment_payments WHERE status IN ('due', 'overdue')");
    const rec = db.exec("SELECT COUNT(*) FROM recurring_instances WHERE generated_transaction_id IS NULL");

    console.log('Installment Pending Count:', inst[0]?.values[0][0]);
    console.log('Recurring Pending Count:', rec[0]?.values[0][0]);

    if (rec[0]?.values[0][0] > 0) {
        console.log('\n--- Pending Recurring Details ---');
        const details = db.exec(`
            SELECT ri.date, rr.name 
            FROM recurring_instances ri 
            JOIN recurring_rules rr ON ri.rule_id = rr.id 
            WHERE ri.generated_transaction_id IS NULL
        `);
        console.log(JSON.stringify(details[0]?.values, null, 2));
    }
}
check();
