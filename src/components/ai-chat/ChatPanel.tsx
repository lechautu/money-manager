import React, { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react';
import { X, Send, Sparkles, WifiOff, Trash2 } from 'lucide-react';
import { AIChatStore } from '../../services/AIChatStore';
import type { ConfirmationCard as ConfirmationCardType } from '../../types/aiChat';
import { ChatMessage } from './ChatMessage';
import { WaitingIndicator } from './WaitingIndicator';
import { ConfirmationCard } from './ConfirmationCard';

interface Props {
    onClose: () => void;
}

export const ChatPanel: React.FC<Props> = ({ onClose }) => {
    const state = useSyncExternalStore(AIChatStore.subscribe, AIChatStore.getSnapshot);
    const [input, setInput] = useState('');
    const historyRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // ── Debug Logs ──
    useEffect(() => {
        return () => { };
    }, []);

    // ── ESC handler ──
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKey, true);
        return () => window.removeEventListener('keydown', handleKey, true);
    }, [onClose]);

    // ── Mobile Back handler (Simplified to avoid loops) ──
    useEffect(() => {
        const handlePop = () => {
            onClose();
        };

        window.addEventListener('popstate', handlePop);

        // Push a dummy state so 'Back' closes the panel
        if (window.history.state?.aiChat !== true) {
            window.history.pushState({ aiChat: true }, '');
        }

        return () => {
            window.removeEventListener('popstate', handlePop);
        };
    }, [onClose]);

    // ── Refresh on open ──
    useEffect(() => {
        AIChatStore.refresh();
    }, []);

    // ── Auto-scroll ──
    useEffect(() => {
        if (historyRef.current) {
            historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
    }, [state.entities.length, state.isWaiting]);

    // ── Focus input ──
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // ── Send ──
    const handleSend = useCallback(() => {
        if (state.isWaiting) return;
        const trimmed = input.trim();
        if (!trimmed) return;
        setInput('');
        AIChatStore.sendMessage(trimmed).catch(console.error);
    }, [input, state.isWaiting]);

    // ── Clear ──
    const handleClear = useCallback(() => {
        if (window.confirm('Clear chat history?')) {
            AIChatStore.clearHistory().catch(console.error);
        }
    }, []);

    // ── Key handling ──
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ── Retry ──
    const handleRetry = (id: string) => {
        AIChatStore.retryMessage(id);
    };

    // ── Confirm ──
    const handleConfirm = (id: string, decision: 'approve' | 'reject') => {
        AIChatStore.confirmAction(id, decision);
    };

    // Check pending confirmation
    const hasPendingConfirmation = state.pendingConfirmationId && state.entities.some(
        (e) => e.id === state.pendingConfirmationId && e.type === 'confirmation' && (e as ConfirmationCardType).status === 'pending'
    );

    // Sort entities by sequence
    const sortedEntities = [...state.entities].sort(
        (a, b) => (a.serverSequence ?? 0) - (b.serverSequence ?? 0)
    );

    return (
        <div className="fixed inset-0 z-[200] flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Panel */}
            <div className="relative w-full md:w-[420px] h-full flex flex-col bg-gray-950 border-l border-gray-800 shadow-2xl overflow-hidden animate-slide-in-right">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600/20 flex items-center justify-center">
                            <Sparkles size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold text-sm leading-none">AI Assistant</h3>
                            <div className="flex items-center gap-1.5 mt-1">
                                {state.isOffline ? (
                                    <>
                                        <WifiOff size={10} className="text-amber-400" />
                                        <span className="text-[10px] text-amber-400 font-medium">Offline</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        <span className="text-[10px] text-gray-400 font-medium">Ready</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {state.entities.length > 0 && (
                            <button
                                onClick={handleClear}
                                title="Clear History"
                                className="w-8 h-8 rounded-lg hover:bg-red-500/20 flex items-center justify-center group transition-colors"
                            >
                                <Trash2 size={16} className="text-gray-400 group-hover:text-red-400" />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center transition-colors"
                        >
                            <X size={18} className="text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Offline banner */}
                {state.isOffline && (
                    <div className="px-4 py-2 bg-amber-900/30 border-b border-amber-700/30 text-xs text-amber-300">
                        May be outdated (offline). Messages will be retried when connection resumes.
                    </div>
                )}

                {/* Chat History */}
                <div
                    ref={historyRef}
                    className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
                >
                    {sortedEntities.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-blue-600/10 flex items-center justify-center">
                                <Sparkles size={28} className="text-blue-400" />
                            </div>
                            <div>
                                <h4 className="text-white font-semibold text-base">Hi! I'm your AI Assistant</h4>
                                <p className="text-gray-400 text-sm mt-1 max-w-[260px]">
                                    Ask me about your finances, accounts, transactions, or budgets.
                                </p>
                            </div>
                        </div>
                    )}

                    {sortedEntities.map((entity) => {
                        switch (entity.type) {
                            case 'user':
                            case 'assistant':
                            case 'system':
                                return <ChatMessage key={entity.id} entity={entity} onRetry={handleRetry} />;
                            case 'waiting':
                                return <WaitingIndicator key={entity.id} />;
                            case 'confirmation':
                                return <ConfirmationCard key={entity.id} entity={entity as ConfirmationCardType} onConfirm={handleConfirm} />;
                            default:
                                return null;
                        }
                    })}
                </div>

                {/* Pending confirmation warning */}
                {hasPendingConfirmation && !state.isWaiting && (
                    <div className="px-4 py-2 bg-amber-900/20 border-t border-amber-700/30 text-xs text-amber-400">
                        ⚠ Sending a new message will expire the pending confirmation.
                    </div>
                )}

                {/* Composer */}
                <div className="p-3 border-t border-gray-800 bg-gray-900/80 backdrop-blur-sm shrink-0">
                    <div className="relative flex items-end gap-2">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={state.isWaiting ? 'Waiting for response...' : 'Ask about your finances...'}
                            disabled={state.isWaiting}
                            rows={1}
                            className="flex-1 bg-gray-800/60 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ maxHeight: '120px' }}
                            onInput={(e) => {
                                const el = e.target as HTMLTextAreaElement;
                                el.style.height = 'auto';
                                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={state.isWaiting || !input.trim()}
                            className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
