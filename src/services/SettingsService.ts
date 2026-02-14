import { run } from '../db/client';

export interface AppSettings {
    id: string;
    lock_enabled: number;
    password_salt?: string;
    password_verifier?: string;
    date_format: string;
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
                'INSERT INTO settings (id, lock_enabled, date_format, updated_at) VALUES (?, 0, \'dd/MM/yyyy\', ?)',
                [SETTINGS_ID, now]
            );
            return await this.getSettings();
        }
        return rows[0];
    },

    async initSettings() {
        const rows = await run('SELECT * FROM settings WHERE id = ?', [SETTINGS_ID]);
        if (rows.length === 0) {
            const now = new Date().toISOString();
            await run(
                'INSERT INTO settings (id, lock_enabled, date_format, updated_at) VALUES (?, 0, \'dd/MM/yyyy\', ?)',
                [SETTINGS_ID, now]
            );
        }
    },

    async setDateFormat(format: string): Promise<void> {
        await this.initSettings();
        const now = new Date().toISOString();
        await run('UPDATE settings SET date_format = ?, updated_at = ? WHERE id = ?', [format, now, SETTINGS_ID]);
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
    },

    async removePassword(): Promise<void> {
        await this.initSettings();
        const now = new Date().toISOString();
        await run(
            'UPDATE settings SET password_salt = NULL, password_verifier = NULL, lock_enabled = 0, updated_at = ? WHERE id = ?',
            [now, SETTINGS_ID]
        );
    }
};
