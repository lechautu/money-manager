import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { ImportExportParams } from '../components/settings/ImportExportParams';
import { PasswordManager } from '../components/settings/PasswordManager';
import { DateFormatSettings } from '../components/settings/DateFormatSettings';

export default function SettingsPage() {
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold mb-6 text-white">Settings</h1>

            <PasswordManager />
            <DateFormatSettings />
            <ImportExportParams />

            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <History size={20} className="text-blue-400" />
                    <span className="text-white">Data History</span>
                </h2>
                <div className="flex items-center justify-between">
                    <p className="text-gray-400 text-sm">View system audit logs and action history.</p>
                    <Link
                        to="/audit-logs"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors text-sm font-medium"
                    >
                        View Logs
                    </Link>
                </div>
            </div>

            <div className="text-center text-xs text-gray-600 pt-8">
                Money Manager MVP1 • SQLite WASM + OPFS
            </div>
        </div>
    );
}
