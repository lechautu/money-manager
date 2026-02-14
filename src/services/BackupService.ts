

const BACKUP_KEY = 'mm_backup_restore_point';

export const BackupService = {
    async createSnapshot(data: any): Promise<void> {
        try {
            const json = JSON.stringify(data);
            try {
                localStorage.setItem(BACKUP_KEY, json);
            } catch (e) {
                console.warn('Backup failed: Storage quota exceeded or unavailable', e);
                // Try to clear old backups or just fail silently?
                // If backup fails, Undo won't work.
                throw new Error("Backup failed: Storage full");
            }
        } catch (e) {
            console.error('Snapshot creation failed', e);
        }
    },

    async restoreSnapshot(): Promise<any> {
        try {
            const json = localStorage.getItem(BACKUP_KEY);
            if (!json) throw new Error("No backup found");
            return JSON.parse(json);
        } catch (e) {
            console.error('Snapshot restore failed', e);
            throw e;
        }
    },

    clearSnapshot() {
        localStorage.removeItem(BACKUP_KEY);
    }
};

