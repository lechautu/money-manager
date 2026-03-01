
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';

async function retroLink() {
    const SQL = await initSqlJs();
    const dbData = readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db');
    const db = new SQL.Database(dbData);

    console.log('--- Retro-linking Recurring Transactions ---');
    const rules = db.exec("SELECT id, name, amount, category_id FROM recurring_rules WHERE is_active = 1")[0]?.values || [];

    let linkedRecurring = 0;
    for (const [id, name, amount, categoryId] of rules) {
        const matchingTxs = db.exec(`
            SELECT id, date FROM transactions 
            WHERE source = 'manual' 
              AND category_id = '${categoryId}' 
              AND amount = ${amount} 
              AND deleted_at IS NULL
        `)[0]?.values || [];

        for (const [txId, date] of matchingTxs) {
            console.log(`Linking manual transaction ${txId} (${date}) to recurring rule ${name}`);
            db.run("UPDATE transactions SET source = 'recurring', source_ref_id = ?, note = COALESCE(note, ?) WHERE id = ?", [id, `Recurring: ${name}`, txId]);
            db.run("INSERT OR IGNORE INTO recurring_instances (id, rule_id, date, generated_transaction_id, created_at) VALUES (?, ?, ?, ?, ?)", [Date.now().toString() + Math.random(), id, date, txId, new Date().toISOString()]);
            linkedRecurring++;
        }
    }

    console.log('--- Retro-linking Installment Transactions ---');
    const installments = db.exec(`
        SELECT p.id, p.due_date, plan.name, plan.payment_category_id, p.amount
        FROM installment_payments p
        JOIN installment_plans plan ON p.plan_id = plan.id
        WHERE p.expense_transaction_id IS NULL
    `)[0]?.values || [];

    let linkedInst = 0;
    for (const [pId, dueDate, planName, catId, amount] of installments) {
        const matchingTxs = db.exec(`
            SELECT id FROM transactions 
            WHERE source = 'manual' 
              AND category_id = '${catId}' 
              AND amount = ${-Math.abs(amount)} 
              AND date = '${dueDate}'
              AND deleted_at IS NULL
        `)[0]?.values || [];

        for (const [txId] of matchingTxs) {
            console.log(`Linking manual transaction ${txId} to installment ${planName} (${dueDate})`);
            db.run("UPDATE transactions SET source = 'installment', source_ref_id = ?, note = COALESCE(note, ?) WHERE id = ?", [pId, `Installment: ${planName}`, txId]);
            db.run("UPDATE installment_payments SET expense_transaction_id = ? WHERE id = ?", [txId, pId]);
            linkedInst++;
        }
    }

    console.log(`Summary: Linked ${linkedRecurring} recurring instances and ${linkedInst} installments.`);

    const data = db.export();
    writeFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db', Buffer.from(data));
}

retroLink().catch(console.error);
