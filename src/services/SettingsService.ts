import { run } from '../db/client';

export interface AppSettings {
    id: string;
    lock_enabled: number;
    password_salt?: string;
    password_verifier?: string;
    updated_at: string;
}

const SETTINGS_ID = 'default';

export const SettingsService = {
    async getSettings(): Promise<AppSettings> {
        const rows = await run('SELECT * FROM settings WHERE id = ?', [SETTINGS_ID]);
        if (rows.length === 0) {
            // Create default settings if not exists
            const now = new Date().toISOString();
            await run(
                'INSERT INTO settings (id, lock_enabled, updated_at) VALUES (?, 0, ?)',
                [SETTINGS_ID, now]
            );
            // Wait, schema definitely has updated_at. Let's check schema again.
            // 123: CREATE TABLE IF NOT EXISTS settings (
            // 124:     id TEXT PRIMARY KEY,
            // 125:     lock_enabled INTEGER NOT NULL DEFAULT 0,
            // 126:     password_salt TEXT,
            // 127:     password_verifier TEXT,
            // 128:     updated_at TEXT NOT NULL
            // 129: );
            // So only updated_at.

            // Re-run get to be sure
            return await this.getSettings();
        }
        return rows[0];
    },

    async initSettings() {
        // idempotent init
        const rows = await run('SELECT * FROM settings WHERE id = ?', [SETTINGS_ID]);
        if (rows.length === 0) {
            const now = new Date().toISOString();
            await run(
                'INSERT INTO settings (id, lock_enabled, updated_at) VALUES (?, 0, ?)',
                [SETTINGS_ID, now]
            );
        }
    },

    async setLockEnabled(enabled: boolean): Promise<void> {
        await this.initSettings();
        const now = new Date().toISOString();
        await run('UPDATE settings SET lock_enabled = ?, updated_at = ? WHERE id = ?', [enabled ? 1 : 0, now, SETTINGS_ID]);
    },

    async setPassword(password: string): Promise<void> {
        await this.initSettings();
        const salt = crypto.randomUUID(); // simple salt
        const verifier = await this.hashPassword(password, salt);
        const now = new Date().toISOString();

        await run(
            'UPDATE settings SET password_salt = ?, password_verifier = ?, lock_enabled = 1, updated_at = ? WHERE id = ?',
            [salt, verifier, now, SETTINGS_ID]
        );
    },

    // Simple SHA-256 hash
    async hashPassword(password: string, salt: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async verifyPassword(password: string): Promise<boolean> {
        const settings = await this.getSettings();
        if (!settings.password_salt || !settings.password_verifier) return false;

        const hash = await this.hashPassword(password, settings.password_salt);
        // Compare hash
        return hash === settings.password_verifier;
    },

    async hasPassword(): Promise<boolean> {
        const settings = await this.getSettings();
        return !!(settings.password_salt && settings.password_verifier);
    }
};
