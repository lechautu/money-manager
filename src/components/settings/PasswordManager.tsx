import { useState, useEffect } from 'react';
import { Lock, Unlock, Key, ShieldCheck, AlertCircle } from 'lucide-react';
import { SettingsService } from '../../services/SettingsService';
import type { AppSettings } from '../../services/SettingsService';
import { useToast } from '../common/Toast';

export function PasswordManager() {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [isChanging, setIsChanging] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const { showToast } = useToast();

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const s = await SettingsService.getSettings();
        setSettings(s);
    };

    const handleToggleLock = async () => {
        if (!settings) return;

        // If trying to enable but no password set, show password form
        if (!settings.password_verifier && !settings.lock_enabled) {
            setIsChanging(true);
            return;
        }

        try {
            const nextState = !settings.lock_enabled;
            await SettingsService.setLockEnabled(nextState);
            await loadSettings();
            showToast(`App lock ${nextState ? 'enabled' : 'disabled'}`);
        } catch (e) {
            showToast('Failed to update lock status', 'error');
        }
    };

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 4) {
            setError('Password must be at least 4 characters');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        try {
            await SettingsService.setPassword(password);
            await loadSettings();
            setIsChanging(false);
            setPassword('');
            setConfirmPassword('');
            showToast('Password set successfully');
        } catch (e) {
            showToast('Failed to set password', 'error');
        }
    };

    const handleRemovePassword = async () => {
        if (!window.confirm('Are you sure you want to remove the password? This will also disable the app lock.')) return;

        try {
            await SettingsService.removePassword();
            await loadSettings();
            showToast('Password removed successfully');
        } catch (e) {
            showToast('Failed to remove password', 'error');
        }
    };

    if (!settings) return null;

    return (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl overflow-hidden relative">
            <div className="absolute -bottom-6 -right-6 opacity-10 pointer-events-none">
                <ShieldCheck size={120} className="text-blue-500 -rotate-12" />
            </div>

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                        <Lock size={20} className="text-blue-400" />
                        Security (App Lock)
                    </h2>

                    {!isChanging && (
                        <button
                            onClick={handleToggleLock}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${settings.lock_enabled ? 'bg-blue-600' : 'bg-gray-700'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.lock_enabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    )}
                </div>

                <p className="text-gray-400 text-sm mb-6 max-w-md">
                    Protect your financial data with an app-level password. When enabled, you'll be prompted for your password every time you open the app.
                </p>

                {isChanging ? (
                    <form onSubmit={handleSetPassword} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">New Password</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                    <input
                                        type="password"
                                        autoFocus
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-white focus:border-blue-500 outline-none transition-all"
                                        placeholder="••••••"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 ml-1">Confirm Password</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-white focus:border-blue-500 outline-none transition-all"
                                        placeholder="••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 p-2 rounded-lg border border-red-400/20">
                                <AlertCircle size={14} />
                                {error}
                            </div>
                        )}

                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => { setIsChanging(false); setError(''); }}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-all"
                            >
                                Set Password
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${settings.lock_enabled ? 'bg-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-gray-700 text-gray-500'}`}>
                                {settings.lock_enabled ? <Lock size={24} /> : <Unlock size={24} />}
                            </div>
                            <div>
                                <div className="text-sm font-bold text-white capitalize">
                                    Status: {settings.lock_enabled ? 'Enabled' : 'Disabled'}
                                </div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                                    {settings.password_verifier ? 'Password Protected' : 'No password set yet'}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                            <button
                                onClick={() => setIsChanging(true)}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-800/50 hover:bg-gray-700 border border-gray-700 text-white rounded-lg text-sm font-medium transition-all"
                            >
                                <Key size={16} className="text-gray-400" />
                                {settings.password_verifier ? 'Change Password' : 'Set Password'}
                            </button>
                            {settings.password_verifier && (
                                <button
                                    onClick={handleRemovePassword}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-900/10 hover:bg-red-900/30 border border-red-900/20 text-red-400 rounded-lg text-sm font-medium transition-all"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
