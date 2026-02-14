import { getDB, run } from '../db/client';
import { BackupService } from './BackupService';
import { AuditService } from './AuditService';

export const ImportExportService = {
    async getExportData(): Promise<any> {
        try {
            const tables = [
                'meta', 'settings', 'accounts', 'categories', 'sub_categories',
                'transactions', 'transaction_splits', 'installment_plans', 'installment_payments',
                'recurring_rules', 'recurring_instances', 'budgets',
                'audit_logs'
            ];

            const data: any = {
                version: 1,
                timestamp: new Date().toISOString(),
                tables: {}
            };

            const { sqlite, db } = await getDB();
            if (!sqlite || !db) return null;

            for (const table of tables) {
                try {
                    const rows = await run(`SELECT * FROM ${table}`);
                    data.tables[table] = rows;
                } catch (e) {
                    console.warn(`Table ${table} export failed (maybe doesn't exist)`, e);
                }
            }
            return data;
        } catch (e) {
            console.error('Export Data failed', e);
            throw e;
        }
    },

    async exportDb(): Promise<Blob | null> {
        try {
            const data = await this.getExportData();
            if (!data) return null;
            const json = JSON.stringify(data, null, 2);
            return new Blob([json], { type: 'application/json' });
        } catch (e) {
            console.error('Export failed', e);
            return null;
        }
    },


    async restoreBackup(): Promise<void> {
        try {
            const data = await BackupService.restoreSnapshot();
            // Reuse the inner logic of importDb but with the data object
            // To avoid code duplication, we should refactor the core import logic or just duplicate it for now.
            // Duplication is safer to avoid breaking importDb signature or behavior right now.

            await getDB();
            await run('BEGIN TRANSACTION');
            try {
                await run('PRAGMA foreign_keys = OFF');

                // Clear all tables
                const tables = [
                    'budgets', 'recurring_instances', 'recurring_rules',
                    'installment_payments', 'installment_plans', 'transaction_splits', 'transactions',
                    'sub_categories', 'categories', 'accounts', 'settings', 'meta',
                    'audit_logs'
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
                // await AuditService.log('restore_backup', 'system', undefined, { timestamp: new Date().toISOString() });
                await run('COMMIT');

                // Clear backup after successful restore? Or keep it?
                // BackupService.clearSnapshot(); 
                // Let UndoProvider handle clearing.

                window.location.reload();
            } catch (err) {
                await run('ROLLBACK');
                throw err;
            }
        } catch (e) {
            console.error('Restore failed', e);
            throw new Error('Restore failed: ' + (e as any).message);
        }
    },

    async importDb(file: File): Promise<void> {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.tables) throw new Error('Invalid backup file');

            // Create JSON Snapshot
            try {
                const currentData = await this.getExportData();
                await BackupService.createSnapshot(currentData);
            } catch (e) {
                console.error("Failed to create rollback snapshot", e);
                // Proceed with import anyway? Or block?
                // If we block, user can't import if storage is full.
                // Let's warn but proceed.
            }

            await getDB();

            await run('BEGIN TRANSACTION');
            try {
                await run('PRAGMA foreign_keys = OFF');

                // Clear all tables
                const tables = [
                    'budgets', 'recurring_instances', 'recurring_rules',
                    'installment_payments', 'installment_plans', 'transaction_splits', 'transactions',
                    'sub_categories', 'categories', 'accounts', 'settings', 'meta',
                    'audit_logs'
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
                await AuditService.log('import_replace', 'system', undefined, { timestamp: new Date().toISOString() });
                await run('COMMIT');

                localStorage.setItem('mm_import_undo_available', 'true');
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
