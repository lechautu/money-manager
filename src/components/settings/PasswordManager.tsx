import { useState, useEffect } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { SettingsService } from '../../services/SettingsService';
import type { AppSettings } from '../../services/SettingsService';
import { useToast } from '../common/Toast';

export function PasswordManager() {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [hasPassword, setHasPassword] = useState(false);
    const [isChangeMode, setIsChangeMode] = useState(false);

    // Form State
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const s = await SettingsService.getSettings();
        setSettings(s);
        setHasPassword(!!(s.password_salt && s.password_verifier));
    };

    const handleToggleLock = async () => {
        if (!settings) return;

        if (!settings.lock_enabled) {
            // Enable lock
            if (hasPassword) {
                // Just enable
                await SettingsService.setLockEnabled(true);
                showToast('App lock enabled');
                loadSettings();
            } else {
                // Must set password first
                setIsChangeMode(true);
            }
        } else {
            // Disable lock
            await SettingsService.setLockEnabled(false);
            showToast('App lock disabled');
            loadSettings();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 4) {
            showToast('Password must be at least 4 characters', 'error');
            return;
        }

        try {
            if (hasPassword) {
                // Verify old password
                const isValid = await SettingsService.verifyPassword(oldPassword);
                if (!isValid) {
                    showToast('Incorrect old password', 'error');
                    return;
                }
            }

            await SettingsService.setPassword(newPassword);
            showToast('Password updated successfully');
            setIsChangeMode(false);
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
            loadSettings(); // Reloads settings and hasPassword state
        } catch (e) {
            console.error(e);
            showToast('Failed to set password', 'error');
        }
    };

    if (!settings) return <div className="text-gray-500 text-sm">Loading settings...</div>;

    return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    {settings.lock_enabled ? <Lock size={20} className="text-primary" /> : <Unlock size={20} className="text-gray-500" />}
                    App Lock
                </h2>
                <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!settings.lock_enabled}
                            onChange={handleToggleLock}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>
            </div>

            <p className="text-sm text-gray-400 mb-4">
                {settings.lock_enabled
                    ? "App requires password on launch."
                    : "Secure your data by enabling password protection."}
            </p>

            {!isChangeMode && (
                <button
                    onClick={() => setIsChangeMode(true)}
                    className="text-sm text-primary hover:text-blue-400 underline"
                >
                    {hasPassword ? "Change Password" : "Set Password"}
                </button>
            )}

            {isChangeMode && (
                <form onSubmit={handleSubmit} className="mt-4 space-y-3 bg-gray-800/50 p-4 rounded border border-gray-700">
                    <h3 className="text-sm font-medium mb-2">{hasPassword ? "Change Password" : "Set New Password"}</h3>

                    {hasPassword && (
                        <div>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Current Password"
                                value={oldPassword}
                                onChange={e => setOldPassword(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                            />
                        </div>
                    )}

                    <div>
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="New Password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                        />
                    </div>

                    <div>
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Confirm New Password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="show-pw"
                            checked={showPassword}
                            onChange={e => setShowPassword(e.target.checked)}
                            className="rounded bg-gray-700 border-gray-600 text-primary focus:ring-primary"
                        />
                        <label htmlFor="show-pw" className="text-xs text-gray-400 select-none">Show Passwords</label>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button type="submit" className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium">
                            Save Password
                        </button>
                        <button type="button" onClick={() => { setIsChangeMode(false); }} className="text-gray-400 hover:text-white px-3 py-2 text-sm">
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
