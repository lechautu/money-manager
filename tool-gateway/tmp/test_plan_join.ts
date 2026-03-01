
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function testJoin() {
    const SQL = await initSqlJs();
    const dbPath = path.join(process.cwd(), 'data', 'mm2.db');
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);

    const query = `
        SELECT t.*, 
               r.name as recurring_name,
               ip.name as installment_plan_name,
               p.due_month as installment_period
        FROM transactions t
        LEFT JOIN recurring_rules r ON t.source = 'recurring' AND t.source_ref_id = r.id
        LEFT JOIN installment_payments p ON t.source = 'installment' AND t.source_ref_id = p.id
        LEFT JOIN installment_plans ip ON p.plan_id = ip.id
        WHERE t.deleted_at IS NULL
        LIMIT 5
    `;

    const stmt = db.prepare(query);
    while (stmt.step()) {
        console.log(JSON.stringify(stmt.getAsObject(), null, 2));
    }

    db.close();
}

testJoin().catch(console.error);
