
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

// Advance date function reused from StatisticsService
function advanceDate(dateStr, frequency) {
    const d = new Date(dateStr + 'T00:00:00Z');
    switch (frequency) {
        case 'daily': d.setUTCDate(d.getUTCDate() + 1); break;
        case 'weekly': d.setUTCDate(d.getUTCDate() + 7); break;
        case 'biweekly': d.setUTCDate(d.getUTCDate() + 14); break;
        case 'monthly': d.setUTCMonth(d.getUTCMonth() + 1); break;
        case 'quarterly': d.setUTCMonth(d.getUTCMonth() + 3); break;
        case 'yearly': d.setUTCFullYear(d.getUTCFullYear() + 1); break;
    }
    return d.toISOString().substring(0, 10);
}

function getRecurringDatesInMonth(rule, monthStr) {
    const monthStart = monthStr + '-01';
    const lastDay = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]), 0).getDate();
    const monthEnd = monthStr + '-' + lastDay;
    if (rule.start_date > monthEnd) return [];
    if (rule.end_date && rule.end_date < monthStart) return [];
    let current = rule.start_date;
    if (current < monthStart) {
        const startDate = new Date(current + 'T00:00:00Z');
        const targetDate = new Date(monthStart + 'T00:00:00Z');
        if (rule.frequency === 'daily') {
            const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
            startDate.setUTCDate(startDate.getUTCDate() + diffDays);
        } else if (rule.frequency === 'weekly') {
            const diffWeeks = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24 * 7));
            startDate.setUTCDate(startDate.getUTCDate() + diffWeeks * 7);
        } else if (rule.frequency === 'monthly') {
            const diffMonths = (targetDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (targetDate.getUTCMonth() - startDate.getUTCMonth());
            startDate.setUTCMonth(startDate.getUTCMonth() + diffMonths);
        }
        current = startDate.toISOString().substring(0, 10);
        while (current < monthStart) current = advanceDate(current, rule.frequency);
    }
    const dates = [];
    const limit = rule.end_date && rule.end_date < monthEnd ? rule.end_date : monthEnd;
    let iter = 0;
    while (current <= limit && iter < 50) {
        if (current >= monthStart) dates.push(current);
        current = advanceDate(current, rule.frequency);
        iter++;
    }
    return dates;
}

async function debugForecast() {
    const SQL = await initSqlJs();
    const dbPath = path.join(process.cwd(), 'data', 'mm2.db');
    const db = new SQL.Database(fs.readFileSync(dbPath));

    const todayStr = '2026-03-02';
    const currentMonthStr = '2026-03';

    // 1. Start Balance
    const accounts = db.exec('SELECT initial_balance FROM accounts')[0].values;
    const initial = accounts.reduce((sum, a) => sum + (a[0] || 0), 0);
    const txs = db.exec("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE deleted_at IS NULL AND status = 'posted'")[0].values[0][0];
    const startBalanceNow = initial + txs;
    console.log('Balance Now:', startBalanceNow);

    // 2. Current Month Actuals
    const actuals = db.exec(`SELECT 
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)
        FROM transactions WHERE month = '${currentMonthStr}' AND deleted_at IS NULL AND status != 'ignored' AND source != 'transfer'
    `)[0].values[0];
    console.log('Actuals March:', { income: actuals[0], expense: actuals[1] });

    // 3. Existing Txs (for duplicate check)
    const existingTxs = db.exec(`SELECT source, source_ref_id, date, amount FROM transactions WHERE month >= '${currentMonthStr}' AND deleted_at IS NULL`)[0].values.map(v => ({
        source: v[0], source_ref_id: v[1], date: v[2], amount: v[3]
    }));

    // 4. Projections Logic Check for a specific month
    const rules = db.exec('SELECT * FROM recurring_rules WHERE is_active = 1')[0];
    const columns = rules.columns;
    const ruleObjs = rules.values.map(v => {
        const obj = {};
        columns.forEach((col, idx) => obj[col] = v[idx]);
        return obj;
    });

    console.log('--- Projections for March ---');
    let projExpense = 0;
    for (const rule of ruleObjs) {
        const dates = getRecurringDatesInMonth(rule, currentMonthStr);
        for (const date of dates) {
            const txExists = existingTxs.some(tx => {
                const directMatch = tx.source_ref_id === rule.id && (rule.frequency === 'monthly' ? tx.date.startsWith(currentMonthStr) : tx.date === date);
                if (directMatch) return true;
                if (rule.frequency === 'monthly' && tx.date.startsWith(currentMonthStr) && Math.abs(tx.amount) === Math.abs(rule.amount)) return true;
                return false;
            });

            if (!txExists) {
                if (date > todayStr) {
                    console.log(`Add PROJECTION: ${rule.name} on ${date} of ${rule.amount}`);
                    if (rule.amount < 0) projExpense += Math.abs(rule.amount);
                } else {
                    console.log(`SKIP Past Date no TX: ${rule.name} on ${date}`);
                }
            } else {
                console.log(`SKIP Already Exists: ${rule.name} on ${date}`);
            }
        }
    }

    db.close();
}

debugForecast().catch(console.error);
