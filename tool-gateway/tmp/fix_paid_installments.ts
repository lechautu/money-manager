
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';

async function fix() {
    const SQL = await initSqlJs();
    const dbPath = 'd:/Projects/mm2/tool-gateway/data/mm2.db';
    const fileBuffer = readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);

    console.log("Identifying incorrectly 'paid' installments for today (2026-03-01)...");

    // These payments were marked paid by the buggy auto-add logic which only created the debt expense
    // We move the debt tx to expense_transaction_id and reset status to 'due'
    db.run(`
        UPDATE installment_payments 
        SET 
            expense_transaction_id = generated_transaction_id,
            generated_transaction_id = NULL,
            status = 'due',
            paid_at = NULL
        WHERE due_date = '2026-03-01' 
          AND status = 'paid' 
          AND expense_transaction_id IS NULL
          AND generated_transaction_id IS NOT NULL
    `);

    const changes = db.exec("SELECT changes()")[0].values[0][0];
    console.log(`Updated ${changes} payments back to 'due' status.`);

    const data = db.export();
    writeFileSync(dbPath, Buffer.from(data));
    console.log("Fix applied successfully.");
}

fix();
