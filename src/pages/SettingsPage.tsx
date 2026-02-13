import { ImportExportParams } from '../components/settings/ImportExportParams';
import { PasswordManager } from '../components/settings/PasswordManager';

export default function SettingsPage() {
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold mb-6">Settings</h1>

            <PasswordManager />
            <ImportExportParams />

            <div className="text-center text-xs text-gray-600 pt-8">
                Money Manager MVP1 • SQLite WASM + OPFS
            </div>
        </div>
    );
}
