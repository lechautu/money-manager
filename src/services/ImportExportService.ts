import { ToolExecutionService } from './ToolExecutionService';

export const ImportExportService = {
    async getExportData(): Promise<any> {
        const res = await ToolExecutionService.executeTool('export_system_data', {});
        return res.data;
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
        // Redirection to Gateway tool if needed
    },

    async importDb(file: File): Promise<void> {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const tables = data.tables || data; // handle both formats

            await ToolExecutionService.executeTool('import_system_data', tables);

            alert('Import Successful!');
            window.location.reload();
        } catch (e) {
            console.error(e);
            throw new Error('Import failed: ' + (e as any).message);
        }
    }
};
