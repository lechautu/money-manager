
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';

async function reset() {
    const SQL = await initSqlJs();
    const dbPath = 'd:/Projects/mm2/tool-gateway/data/mm2.db';
    const fileBuffer = readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);

    const paymentId = '2f53ab61-313d-4237-b0e7-55f6e05ef216';
    const txId = '7b9542a1-3ec5-43a9-b6ee-2b5387247c2a';

    console.log(`Resetting payment ${paymentId} and deleting tx ${txId}...`);

    db.run("DELETE FROM transactions WHERE id = ?", [txId]);
    db.run("UPDATE installment_payments SET status = 'due', generated_transaction_id = NULL, expense_transaction_id = NULL, paid_at = NULL WHERE id = ?", [paymentId]);

    const data = db.export();
    writeFileSync(dbPath, Buffer.from(data));
    console.log("Reset complete.");
}

reset();
