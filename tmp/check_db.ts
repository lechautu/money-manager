
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';
import path from 'path';

async function check() {
    const SQL = await initSqlJs();
    const dbPath = 'd:/Projects/mm2/tool-gateway/data/mm2.sqlite';
    const fileBuffer = readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);

    console.log("--- Installment Plans (auto_add status) ---");
    const plans = db.exec("SELECT id, name, auto_add, credit_account_id FROM installment_plans");
    console.table(plans[0]?.values.map(v => ({ id: v[0], name: v[1], auto_add: v[2], credit: v[3] })));

    console.log("\n--- Installment Payments (Recent/Due) ---");
    const payments = db.exec(`
        SELECT p.id, p.due_date, p.status, p.expense_transaction_id, p.generated_transaction_id, plan.name 
        FROM installment_payments p 
        JOIN installment_plans plan ON p.plan_id = plan.id
        WHERE p.status != 'upcoming' OR p.due_date <= '2026-03-05'
        LIMIT 20
    `);
    if (payments[0]) {
        console.table(payments[0].values.map(v => ({
            id: v[0],
            due_date: v[1],
            status: v[2],
            expense_tx: v[3],
            pay_tx: v[4],
            plan: v[5]
        })));
    } else {
        console.log("No relevant payments found.");
    }

    console.log("\n--- Recent Transactions for Installments ---");
    const txs = db.exec("SELECT id, account_id, amount, date, source, note FROM transactions WHERE source = 'installment' ORDER BY created_at DESC LIMIT 10");
    if (txs[0]) {
        console.table(txs[0].values.map(v => ({ id: v[0], acc: v[1], amount: v[2], date: v[3], source: v[4], note: v[5] })));
    } else {
        console.log("No installment transactions found.");
    }
}

check();
