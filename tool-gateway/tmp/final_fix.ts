
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';

async function fix() {
    const SQL = await initSqlJs();
    const dbPath = 'd:/Projects/mm2/tool-gateway/data/mm2.db';
    const fileBuffer = readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);

    console.log("Checking tx a313ec83-10a7-4f76-b089-284f0c77135e...");
    const tx = db.exec("SELECT account_id, to_account_id, amount FROM transactions WHERE id = 'a313ec83-10a7-4f76-b089-284f0c77135e'");
    console.log("Tx details:", JSON.stringify(tx[0]?.values, null, 2));

    console.log("Resetting all 2026-03-01 installments back to DUE (amber status)...");

    // Swap generated_transaction_id back to expense_transaction_id if it's currently marked as paid incorrectly
    db.run(`
        UPDATE installment_payments 
        SET 
            expense_transaction_id = COALESCE(expense_transaction_id, generated_transaction_id),
            generated_transaction_id = NULL,
            status = 'due',
            paid_at = NULL
        WHERE (due_date = '2026-03-01' OR status = 'paid' AND paid_at IS NULL)
          AND (generated_transaction_id IS NOT NULL OR status = 'paid')
    `);

    const changes = db.exec("SELECT changes()")[0].values[0][0];
    console.log(`Updated ${changes} payments.`);

    const data = db.export();
    writeFileSync(dbPath, Buffer.from(data));
    console.log("Final fix written to disk.");
}

fix();
