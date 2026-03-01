
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';

async function fix() {
    const SQL = await initSqlJs();
    const dbPath = 'd:/Projects/mm2/tool-gateway/data/mm2.db';
    const fileBuffer = readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);

    console.log("Identifying incorrectly 'paid' installments for today (2026-03-01)...");

    // Force update status and swap columns
    db.run(`
        UPDATE installment_payments 
        SET 
            expense_transaction_id = COALESCE(expense_transaction_id, generated_transaction_id),
            generated_transaction_id = NULL,
            status = 'due',
            paid_at = NULL
        WHERE due_date = '2026-03-01' 
          AND status = 'paid'
    `);

    const changes = db.exec("SELECT changes()")[0].values[0][0];
    console.log(`Updated ${changes} payments.`);

    // Verify
    const verify = db.exec("SELECT id, status, expense_transaction_id FROM installment_payments WHERE due_date = '2026-03-01'");
    console.log("Verification:", JSON.stringify(verify[0]?.values, null, 2));

    const data = db.export();
    writeFileSync(dbPath, Buffer.from(data));
    console.log("Fix written to disk.");
}

fix();
