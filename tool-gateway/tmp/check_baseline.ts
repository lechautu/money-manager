
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

async function check() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync('d:/Projects/mm2/tool-gateway/data/mm2.db'));

    const currentMonthStr = '2026-03';
    const getNMonthsAgo = (n) => {
        const d = new Date();
        d.setMonth(d.getMonth() - n);
        return d.toISOString().substring(0, 7);
    };

    const manualHistory = db.exec(`
        SELECT 
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_income,
            COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_expense,
            COUNT(DISTINCT month) as month_count
        FROM transactions 
        WHERE source NOT IN ('recurring', 'installment', 'transfer') 
        AND deleted_at IS NULL AND status != 'ignored'
        AND month < '${currentMonthStr}'
    `);
    console.log('--- Manual History Statistics ---');
    console.log(JSON.stringify(manualHistory[0]?.values || [], null, 2));

    const activeMonths = Math.max(1, manualHistory[0]?.values[0][2] || 1);
    const avgManualExpense = (manualHistory[0]?.values[0][1] || 0) / activeMonths;
    console.log('Average Manual Expense per Month:', avgManualExpense);
}
check();
