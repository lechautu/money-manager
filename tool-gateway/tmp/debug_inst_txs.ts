
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

async function check() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db'));

    const ids = [
        'a313ec83-10a7-4f76-b089-284f0c77135e',
        '2970a398-d08a-49cd-b236-c6519f82fa7d',
        'b454fac7-8d7b-476d-8d29-63fc6907c4b2',
        '7b9542a1-3ec5-43a9-b6ee-2b5387247c2a'
    ];

    console.log('--- Expense Transactions for March Installments ---');
    const placeholders = ids.map(() => '?').join(',');
    const txs = db.exec(`SELECT id, amount, month, source FROM transactions WHERE id IN (${placeholders})`, ids);
    console.log(JSON.stringify(txs[0]?.values || [], null, 2));
}
check();
