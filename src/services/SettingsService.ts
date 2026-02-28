import { ToolExecutionService } from './ToolExecutionService';

export interface AppSettings {
    id: string;
    lock_enabled: number;
    password_salt?: string;
    password_verifier?: string;
    date_format: string;
    updated_at: string;
}

export const SettingsService = {
    async getSettings(): Promise<AppSettings> {
        const res = await ToolExecutionService.executeTool('get_settings', {});
        return res.data;
    },

    async setDateFormat(format: string): Promise<void> {
        await ToolExecutionService.executeTool('set_date_format', { format });
    },

    async setLockEnabled(enabled: boolean): Promise<void> {
        await ToolExecutionService.executeTool('set_lock_enabled', { enabled });
    },

    async setPassword(password: string): Promise<void> {
        await ToolExecutionService.executeTool('set_password', { password });
    },

    async verifyPassword(password: string): Promise<boolean> {
        const res = await ToolExecutionService.executeTool('verify_password', { password });
        return res.data.valid;
    },

    async hasPassword(): Promise<boolean> {
        const res = await ToolExecutionService.executeTool('has_password', {});
        return res.data.hasPassword;
    },

    async removePassword(): Promise<void> {
        // ...
    }
};
