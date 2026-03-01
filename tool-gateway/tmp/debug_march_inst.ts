
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

async function check() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db'));

    console.log('--- All Installment Payments for March ---');
    const pays = db.exec("SELECT id, due_date, status, expense_transaction_id, amount FROM installment_payments WHERE due_date LIKE '2026-03%'");
    console.log(JSON.stringify(pays[0]?.values || [], null, 2));
}
check();
