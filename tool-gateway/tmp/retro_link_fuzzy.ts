
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';

async function retroLinkFuzzy() {
    const SQL = await initSqlJs();
    const dbData = readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db');
    const db = new SQL.Database(dbData);

    console.log('--- Retro-linking Recurring (Fuzzy) ---');
    const rules = db.exec("SELECT id, name, amount, category_id FROM recurring_rules WHERE is_active = 1")[0]?.values || [];

    let linked = 0;
    for (const [id, name, amount, catId] of rules) {
        // Match by month, category and amount
        const matchingTxs = db.exec(`
            SELECT id, date, month FROM transactions 
            WHERE source = 'manual' 
              AND category_id = '${catId}' 
              AND ABS(amount) = ${Math.abs(amount)} 
              AND deleted_at IS NULL
        `)[0]?.values || [];

        for (const [txId, date, month] of matchingTxs) {
            console.log(`Linking ${txId} (${date}) to ${name}`);
            db.run("UPDATE transactions SET source = 'recurring', source_ref_id = ?, note = COALESCE(note, ?) WHERE id = ?", [id, `Recurring: ${name}`, txId]);
            db.run("INSERT OR IGNORE INTO recurring_instances (id, rule_id, date, generated_transaction_id, created_at) VALUES (?, ?, ?, ?, ?)", [Date.now().toString() + Math.random(), id, date, txId, new Date().toISOString()]);
            linked++;
        }
    }

    console.log(`Linked ${linked} transactions.`);
    const data = db.export();
    writeFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db', Buffer.from(data));
}

retroLinkFuzzy().catch(console.error);
