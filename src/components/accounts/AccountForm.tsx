import { useState, useEffect } from 'react';
import { AccountService } from '../../services/AccountService';
import type { Account } from '../../services/AccountService';
import { Modal } from '../ui/Modal';
import { useToast } from '../common/Toast';

interface AccountFormProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Account | null;
    onSuccess: () => void;
}

export function AccountForm({ isOpen, onClose, initialData, onSuccess }: AccountFormProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState<'bank' | 'credit' | 'debit'>('bank');
    const [currency, setCurrency] = useState('VND');
    const [initialBalance, setInitialBalance] = useState('0');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setType(initialData.type);
            setCurrency(initialData.currency);
            setInitialBalance(initialData.initial_balance.toString());
            setNote(initialData.note || '');
        } else {
            // Reset for new
            if (isOpen) {
                setName('');
                setType('bank');
                setCurrency('VND');
                setInitialBalance('0');
                setNote('');
            }
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const balanceVal = parseFloat(initialBalance) || 0;
            if (initialData) {
                await AccountService.update(initialData.id, { name, type, currency, initial_balance: balanceVal, note });
            } else {
                await AccountService.create({ name, type, currency, initial_balance: balanceVal, note });
            }
            showToast(initialData ? 'Account updated successfully' : 'Account created successfully');
            onSuccess();
            onClose();
        } catch (e) {
            showToast('Failed to save account', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!initialData) return;
        if (!window.confirm(`Are you sure you want to delete account "${initialData.name}"? This action cannot be undone.`)) return;

        setLoading(true);
        try {
            await AccountService.delete(initialData.id);
            showToast('Account deleted successfully');
            onSuccess();
            onClose();
        } catch (e: any) {
            console.error(e);
            showToast(e.message || 'Failed to delete account', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? 'Edit Account' : 'New Account'}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Account Name</label>
                    <input
                        required
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        placeholder="e.g. Vietcombank"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Type</label>
                        <select
                            value={type}
                            onChange={e => setType(e.target.value as any)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        >
                            <option value="bank">Bank Account</option>
                            <option value="credit">Credit Card</option>
                            <option value="debit">Cash / Debit</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Currency</label>
                        <select
                            value={currency}
                            onChange={e => setCurrency(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        >
                            <option value="VND">VND</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Initial Balance</label>
                    <input
                        required
                        type="number"
                        step="any"
                        value={initialBalance}
                        onChange={e => setInitialBalance(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        placeholder="0"
                    />
                    <p className="text-[10px] text-gray-500 mt-1 italic">* This historical balance doesn't affect your transaction reports.</p>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Note (Optional)</label>
                    <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary h-20 resize-none"
                    />
                </div>

                <div className="pt-4 flex justify-between gap-3">
                    {initialData ? (
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded text-sm font-medium transition-colors"
                        >
                            Delete
                        </button>
                    ) : <div></div>}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded text-sm text-gray-400 hover:text-white"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-primary hover:bg-blue-600 rounded text-sm text-white font-medium disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : initialData ? 'Update Account' : 'Create Account'}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
