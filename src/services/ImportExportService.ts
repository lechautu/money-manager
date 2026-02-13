import { getDB, run } from '../db/client';

export const ImportExportService = {
    async exportDb(): Promise<Blob | null> {
        try {
            const tables = [
                'meta', 'settings', 'accounts', 'categories', 'sub_categories',
                'transactions', 'installment_plans', 'installment_payments',
                'recurring_rules', 'recurring_instances', 'budgets'
            ];

            const data: any = {
                version: 1,
                timestamp: new Date().toISOString(),
                tables: {}
            };

            const { sqlite, db } = await getDB();
            if (!sqlite || !db) return null;

            for (const table of tables) {
                const rows = await run(`SELECT * FROM ${table}`);
                data.tables[table] = rows;
            }

            const json = JSON.stringify(data, null, 2);
            return new Blob([json], { type: 'application/json' });
        } catch (e) {
            console.error('Export failed', e);
            return null;
        }
    },

    async importDb(file: File): Promise<void> {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.tables) throw new Error('Invalid backup file');

            await getDB();

            await run('BEGIN TRANSACTION');
            try {
                await run('PRAGMA foreign_keys = OFF');

                // Clear all tables
                const tables = [
                    'budgets', 'recurring_instances', 'recurring_rules',
                    'installment_payments', 'installment_plans', 'transactions',
                    'sub_categories', 'categories', 'accounts', 'settings', 'meta'
                ];

                for (const table of tables) {
                    await run(`DELETE FROM ${table}`);
                }

                // Insert new data
                for (const [algoTable, rows] of Object.entries(data.tables)) {
                    const table = algoTable as string;
                    const rowList = rows as any[];
                    if (rowList.length > 0) {
                        const cols = Object.keys(rowList[0]);
                        const placeholders = cols.map(() => '?').join(',');
                        const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`;

                        for (const row of rowList) {
                            const values = cols.map(c => row[c]);
                            await run(sql, values);
                        }
                    }
                }

                await run('PRAGMA foreign_keys = ON');
                await run('COMMIT');

                window.location.reload();
            } catch (err) {
                await run('ROLLBACK');
                throw err;
            }
        } catch (e) {
            console.error(e);
            throw new Error('Import failed: ' + (e as any).message);
        }
    }
};
