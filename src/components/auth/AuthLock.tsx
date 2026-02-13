import { useState, useEffect } from 'react';
import { SettingsService } from '../../services/SettingsService';
import { Lock, ArrowRight } from 'lucide-react';

export function AuthLock({ children }: { children: React.ReactNode }) {
    const [locked, setLocked] = useState(true);
    const [loading, setLoading] = useState(true);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        checkLock();
    }, []);

    const checkLock = async () => {
        const settings = await SettingsService.getSettings();
        if (!settings.lock_enabled) {
            setLocked(false);
        } else {
            // Check session storage
            if (sessionStorage.getItem('app_unlocked') === 'true') {
                setLocked(false);
            } else {
                setLocked(true);
            }
        }
        setLoading(false);
    };

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const valid = await SettingsService.verifyPassword(password);
            if (valid) {
                sessionStorage.setItem('app_unlocked', 'true');
                setLocked(false);
            } else {
                setError('Incorrect password');
            }
        } catch (e) {
            console.error(e);
            setError('Error verifying password');
        }
    };

    if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;

    if (!locked) return <>{children}</>;

    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-950 text-white p-4 absolute top-0 left-0 z-50">
            <div className="w-full max-w-sm space-y-8">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 bg-gray-900 rounded-full flex items-center justify-center mb-4 border border-gray-800">
                        <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold">Locked</h2>
                    <p className="mt-2 text-sm text-gray-400">Enter password to access Money Manager</p>
                </div>

                <form onSubmit={handleUnlock} className="space-y-4">
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-center text-lg tracking-widest focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder-gray-700"
                            placeholder="••••••"
                            autoFocus
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button
                        type="submit"
                        className="w-full bg-primary hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        Unlock <ArrowRight size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
}
