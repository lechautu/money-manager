
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function checkDetails() {
    const SQL = await initSqlJs();
    const dbPath = path.join(process.cwd(), 'data', 'mm2.db');
    const db = new SQL.Database(fs.readFileSync(dbPath));

    const month = '2026-03';
    console.log(`Checking details for ${month}`);

    const res = db.exec(`
        SELECT t.id, t.note, t.amount, t.source, t.category_id, c.name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.month = '${month}' AND t.deleted_at IS NULL
    `)[0];

    if (res) {
        res.values.forEach(v => {
            console.log(`TX: note=[${v[1]}], val=${v[2]}, src=${v[3]}, catId=${v[4]}, catName=[${v[5]}]`);
        });
    }

    db.close();
}
checkDetails().catch(console.error);
