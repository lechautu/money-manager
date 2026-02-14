import { useRef, useState } from 'react';
import { Download, Upload, Database, AlertTriangle } from 'lucide-react';
import { ImportExportService } from '../../services/ImportExportService';
import { useToast } from '../common/Toast';

export function ImportExportParams() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const { showToast } = useToast();

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const blob = await ImportExportService.exportDb();
            if (!blob) throw new Error('Export failed: No data returned');

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `money_manager_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('Backup file created successfully');
        } catch (e) {
            console.error(e);
            showToast('Export failed', 'error');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const confirm = window.confirm("WARNING: Importing a backup will overwrite ALL current data. An automatic backup will be created if possible, which you can 'Undo' later from the Dashboard. Proceed?");
        if (!confirm) {
            e.target.value = '';
            return;
        }

        setIsImporting(true);
        try {
            await ImportExportService.importDb(file);
            // importDb already reloads the page on success
            showToast('Data imported successfully. Reloading...', 'success');
        } catch (e) {
            console.error(e);
            showToast('Import failed: Invalid file or data error', 'error');
            setIsImporting(false);
        }
    };

    return (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                <Database size={80} className="text-emerald-500" />
            </div>

            <div className="relative z-10">
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-white">
                    <Database size={20} className="text-emerald-400" />
                    Data Management (Import/Export)
                </h2>
                <p className="text-gray-400 text-sm mb-6 max-w-md">
                    Export your data to a JSON file for backup or transfer. You can restore your data by importing a previously exported file.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        onClick={handleExport}
                        disabled={isExporting || isImporting}
                        className="flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl transition-all group/btn disabled:opacity-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center transition-colors group-hover/btn:bg-emerald-500 group-hover/btn:text-white">
                                <Download size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold text-white">Export Data</div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Download JSON backup</div>
                            </div>
                        </div>
                        {isExporting && <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>}
                    </button>

                    <button
                        onClick={handleImportClick}
                        disabled={isExporting || isImporting}
                        className="flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl transition-all group/btn disabled:opacity-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center transition-colors group-hover/btn:bg-orange-500 group-hover/btn:text-white">
                                <Upload size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold text-white">Import Data</div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Restore from backup</div>
                            </div>
                        </div>
                        {isImporting && <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>}
                    </button>
                </div>

                <div className="mt-6 flex items-start gap-3 p-3 bg-red-500/5 rounded-lg border border-red-500/20 text-[11px] text-gray-500">
                    <AlertTriangle size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
                    <p>
                        Importing data will <strong>permanently replace</strong> all current transactions, categories, and settings.
                        Make sure you have a recent backup before proceeding.
                    </p>
                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
            />
        </div>
    );
}
