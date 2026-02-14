
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { RotateCcw, X, CheckCircle } from 'lucide-react';

import { ImportExportService } from '../../services/ImportExportService';

interface UndoContextType {
    showUndo: (message: string, onUndo: () => Promise<void>) => void;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

export function UndoProvider({ children }: { children: ReactNode }) {
    const [notification, setNotification] = useState<{
        id: string;
        message: string;
        onUndo: () => Promise<void>;
    } | null>(null);

    const [isRestoring, setIsRestoring] = useState(false);

    const closeNotification = useCallback(() => {
        setNotification(null);
    }, []);

    const showUndo = useCallback((message: string, onUndo: () => Promise<void>) => {
        const id = Math.random().toString(36).substr(2, 9);
        setNotification({ id, message, onUndo });
    }, []);

    // Check for import undo on mount
    useEffect(() => {
        const importUndoAvailable = localStorage.getItem('mm_import_undo_available');
        if (importUndoAvailable === 'true') {
            showUndo('Import successful.', async () => {
                try {
                    setIsRestoring(true);
                    await ImportExportService.restoreBackup();
                    localStorage.removeItem('mm_import_undo_available');
                    // window.location.reload(); // restoreBackup already reloads
                } catch (error) {
                    console.error('Failed to restore import backup', error);
                    setIsRestoring(false);
                    alert('Failed to undo import.');
                }
            });
            // Clear flag if not used? No, we clear it if they dismiss or timeout?
            // Actually, if they dismiss, we can clear it.
            // Or only clear on successful restore.
            // If they don't undo now, they lose the chance? Yes, 10s rule.

            // Only clear the flag if we are setting up the notification.
            // We should clear the flag from localStorage immediately after showing it? 
            // If we reload page, it's gone?
            // If we reload page (refresh), we might want to check again? 
            // But requirement says 10s snackbar.
            // So if they refresh, the snackbar might appear again unless we clear it.
            // Let's clear it on timeout.
        }
    }, [showUndo]);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
                // If it was the import undo, we should clear the flag?
                if (localStorage.getItem('mm_import_undo_available')) {
                    localStorage.removeItem('mm_import_undo_available');
                }
            }, 10000); // 10 seconds
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const handleUndo = async () => {
        if (notification) {
            await notification.onUndo();
            setNotification(null);
        }
    };

    return (
        <UndoContext.Provider value={{ showUndo }}>
            {children}
            {notification && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 pointer-events-none w-full max-w-md px-4">
                    <div className="pointer-events-auto bg-gray-800 text-white rounded-lg shadow-2xl border border-gray-700 p-4 flex items-center justify-between animate-in slide-in-from-bottom fade-in duration-300">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="text-emerald-500" size={20} />
                            <span className="font-medium">{notification.message}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleUndo}
                                disabled={isRestoring}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded font-medium transition-colors text-sm"
                            >
                                {isRestoring ? 'Restoring...' : (
                                    <>
                                        <RotateCcw size={14} />
                                        Undo
                                    </>
                                )}
                            </button>
                            <button
                                onClick={closeNotification}
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </UndoContext.Provider>
    );
}

export function useUndo() {
    const context = useContext(UndoContext);
    if (!context) {
        throw new Error('useUndo must be used within an UndoProvider');
    }
    return context;
}
