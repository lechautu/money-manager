import { run } from '../../db/client';

export interface AppSettings {
    id: string;
    lock_enabled: number;
    password_salt?: string;
    password_verifier?: string;
    date_format: string;
    updated_at: string;
}

const SETTINGS_ID = 'default';

export const LocalSettingsService = {
    async getSettings(): Promise<AppSettings> {
        const rows = await run('SELECT * FROM settings WHERE id = ?', [SETTINGS_ID]);
        if (rows.length === 0) {
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

    async hasPassword(): Promise<boolean> {
        const settings = await this.getSettings();
        return !!(settings.password_salt && settings.password_verifier);
    }
};
