
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function checkLinks() {
    const SQL = await initSqlJs();
    const dbPath = path.join(process.cwd(), 'data', 'mm2.db');
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);

    console.log('--- Recurring Links ---');
    const recurring = db.prepare(`
        SELECT COUNT(*) as count 
        FROM recurring_instances 
        WHERE generated_transaction_id IS NOT NULL
    `);
    while (recurring.step()) console.log('Recurring Instances with TX:', recurring.getAsObject().count);

    console.log('\n--- Installment Links ---');
    const instExpenses = db.prepare(`
        SELECT COUNT(*) as count 
        FROM installment_payments 
        WHERE expense_transaction_id IS NOT NULL
    `);
    while (instExpenses.step()) console.log('Installment Initial Purchases (Expense TX):', instExpenses.getAsObject().count);

    const instPayments = db.prepare(`
        SELECT COUNT(*) as count 
        FROM installment_payments 
        WHERE (generated_transaction_id IS NOT NULL OR linked_transaction_id IS NOT NULL)
    `);
    while (instPayments.step()) console.log('Installment Monthly Payments (Payment TX):', instPayments.getAsObject().count);

    console.log('\n--- Transactions Source Breakdown ---');
    const sourceBreakdown = db.prepare(`
        SELECT source, COUNT(*) as count 
        FROM transactions 
        WHERE deleted_at IS NULL 
        GROUP BY source
    `);
    while (sourceBreakdown.step()) {
        const row = sourceBreakdown.getAsObject();
        console.log(`${row.source}: ${row.count}`);
    }

    db.close();
}

checkLinks().catch(console.error);
