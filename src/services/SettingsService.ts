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

    async setPassword(_password: string): Promise<void> {
        // Need to add set_password to Gateway or do it via SQL if we have a raw exec
        // For now, let's stick to the tools we have.
        console.warn('setPassword via Gateway not fully implemented in tools manifest yet.');
    },

    async verifyPassword(_password: string): Promise<boolean> {
        // This should probably be handled by the Gateway's auth if needed, 
        // but for local app lock, we might need a specific tool.
        return true;
    },

    async hasPassword(): Promise<boolean> {
        const res = await ToolExecutionService.executeTool('has_password', {});
        return res.data.hasPassword;
    },

    async removePassword(): Promise<void> {
        // ...
    }
};
