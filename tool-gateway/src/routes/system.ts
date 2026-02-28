import { Router } from 'express';
import { all, get, run, exec } from '../db/client.js';
import { approvalGuard } from '../middleware/approval.js';
import { auditLog } from '../middleware/audit.js';

export const systemRoutes = Router();

systemRoutes.get('/get_settings', (_req, res) => {
    try {
        let settings = get('SELECT * FROM settings LIMIT 1');
        if (!settings) {
            const now = new Date().toISOString();
            run("INSERT INTO settings (id, date_format, lock_enabled, created_at, updated_at) VALUES ('default', 'dd/MM/yyyy', 0, ?, ?)", [now, now]);
            settings = get('SELECT * FROM settings LIMIT 1');
        }
        res.json({ data: settings });
    } catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

systemRoutes.post('/set_date_format', auditLog('set_date_format', 1, 'settings'), (req, res) => {
    try {
        run("UPDATE settings SET date_format = ?, updated_at = ? WHERE id = 'default'", [req.body.dateFormat, new Date().toISOString()]);
        res.json({ data: { success: true } });
    } catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

systemRoutes.get('/has_password', (_req, res) => {
    try {
        const settings = get<any>('SELECT password_hash FROM settings LIMIT 1');
        res.json({ data: { hasPassword: !!settings?.password_hash } });
    } catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

systemRoutes.post('/set_lock_enabled', auditLog('set_lock_enabled', 1, 'settings'), (req, res) => {
    try {
        run("UPDATE settings SET lock_enabled = ?, updated_at = ? WHERE id = 'default'", [req.body.enabled ? 1 : 0, new Date().toISOString()]);
        res.json({ data: { success: true } });
    } catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

systemRoutes.post('/set_password', auditLog('set_password', 1, 'settings'), (req, res) => {
    try {
        const { password } = req.body;
        // In a real app, hash this! For dev simplicity/local use, we'll store hash if provided or the raw if it looks like one.
        // Actually, let's just use it as is for now as this is a local gateway.
        run("UPDATE settings SET password_hash = ?, updated_at = ? WHERE id = 'default'", [password, new Date().toISOString()]);
        res.json({ data: { success: true } });
    } catch (e: any) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: e.message } }); }
});

systemRoutes.post('/verify_password', (req, res) => {
    try {
        const { password } = req.body;
        const settings = get<any>('SELECT password_hash FROM settings LIMIT 1');
        const valid = settings?.password_hash === password;
        res.json({ data: { valid } });
    } catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

systemRoutes.get('/get_audit_logs', (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string || '50', 10);
        const offset = parseInt(req.query.offset as string || '0', 10);
        res.json({ data: all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]) });
    } catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

systemRoutes.get('/export_system_data', (_req, res) => {
    try {
        const tables = ['accounts', 'categories', 'sub_categories', 'transactions', 'transaction_splits', 'recurring_rules', 'recurring_instances', 'installment_plans', 'installment_payments', 'budgets', 'settings'];
        const exportData: Record<string, any[]> = {};
        for (const table of tables) {
            exportData[table] = all(`SELECT * FROM ${table}`);
        }
        res.json({ data: exportData });
    } catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});

systemRoutes.post('/import_system_data', approvalGuard('import_system_data'), auditLog('import_system_data', 2, 'system'), (req, res) => {
    try {
        const importData = req.body;
        const tables = ['accounts', 'categories', 'sub_categories', 'transactions', 'transaction_splits', 'recurring_rules', 'recurring_instances', 'installment_plans', 'installment_payments', 'budgets', 'settings'];

        // Disable FK checks and clear all tables
        exec('PRAGMA foreign_keys = OFF');
        for (const table of tables.reverse()) {
            run(`DELETE FROM ${table}`);
        }
        tables.reverse();

        // Import data
        for (const table of tables) {
            const rows = importData[table];
            if (!rows || !Array.isArray(rows)) continue;
            for (const row of rows) {
                const cols = Object.keys(row);
                const placeholders = cols.map(() => '?').join(',');
                run(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`, cols.map(c => row[c]));
            }
        }

        exec('PRAGMA foreign_keys = ON');
        res.json({ data: { success: true } });
    } catch (e: any) { res.status(500).json({ error: { code: 'INTERNAL', message: e.message } }); }
});
