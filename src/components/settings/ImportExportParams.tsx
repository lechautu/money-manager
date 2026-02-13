import { useState } from 'react';
import { ImportExportService } from '../../services/ImportExportService';
import { Upload, Download } from 'lucide-react';
import { useToast } from '../common/Toast';

export function ImportExportParams() {
    const [importing, setImporting] = useState(false);
    const { showToast } = useToast();

    const handleExport = async () => {
        const blob = await ImportExportService.exportDb();
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'money-mgmt-backup.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Database exported successfully');
        } else {
            showToast('Failed to export database', 'error');
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm('This will replace ALL existing data with the imported file. Are you sure?')) {
            e.target.value = ''; // reset
            return;
        }

        setImporting(true);
        try {
            await ImportExportService.importDb(file);
            // Service reloads page on success, but just in case:
            showToast('Database imported successfully. Reloading...');
        } catch (err: any) {
            console.error(err);
            showToast(err.message || 'Failed to import database', 'error');
            setImporting(false);
        }
    };

    return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Database Management</h2>

            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                    <div>
                        <h3 className="font-medium text-white">Export Backup</h3>
                        <p className="text-sm text-gray-400">Download a backup of your data (.json)</p>
                    </div>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white transition-colors"
                    >
                        <Download size={16} />
                        Export
                    </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-red-900/30">
                    <div>
                        <h3 className="font-medium text-white">Import Backup</h3>
                        <p className="text-sm text-gray-400">Replace current data with a backup file</p>
                    </div>
                    <label className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white cursor-pointer transition-colors">
                        <Upload size={16} />
                        {importing ? 'Importing...' : 'Import'}
                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={handleImport}
                            disabled={importing}
                        />
                    </label>
                </div>
            </div>
        </div>
    );
}
