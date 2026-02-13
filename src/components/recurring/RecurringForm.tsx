import { useState, useEffect } from 'react';
import { RecurringService } from '../../services/RecurringService';
import type { RecurringRule } from '../../services/RecurringService';
import { AccountService } from '../../services/AccountService';
import type { Account } from '../../services/AccountService';
import { CategoryService } from '../../services/CategoryService';
import type { Category, SubCategory } from '../../services/CategoryService';
import { Modal } from '../ui/Modal';
import { useToast } from '../common/Toast';

interface RecurringFormProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: RecurringRule | null;
    onSuccess: () => void;
}

export function RecurringForm({ isOpen, onClose, initialData, onSuccess }: RecurringFormProps) {
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [accountId, setAccountId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [subCategoryId, setSubCategoryId] = useState('');
    const [dayOfMonth, setDayOfMonth] = useState(1);
    const [startMonth, setStartMonth] = useState(new Date().toISOString().slice(0, 7));
    const [endMonth, setEndMonth] = useState('');
    const [defaultStatus, setDefaultStatus] = useState<'pending' | 'posted'>('pending');

    const [type, setType] = useState<'income' | 'expense'>('expense');

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            loadMeta();
            if (initialData) {
                setName(initialData.name);
                setAmount(Math.abs(initialData.amount).toString());
                setType(initialData.amount >= 0 ? 'income' : 'expense');
                setAccountId(initialData.account_id);
                setCategoryId(initialData.category_id);
                setSubCategoryId(initialData.sub_category_id || '');
                setDayOfMonth(initialData.day_of_month);
                setStartMonth(initialData.start_month);
                setEndMonth(initialData.end_month || '');
                setDefaultStatus(initialData.default_status);
            } else {
                setName('');
                setAmount('');
                setType('expense');
                setDayOfMonth(1);
                setStartMonth(new Date().toISOString().slice(0, 7));
                setEndMonth('');
                setDefaultStatus('pending');
            }
        }
    }, [isOpen, initialData]);

    useEffect(() => {
        if (categoryId) {
            CategoryService.getSubCategories(categoryId).then(setSubCategories);
        } else {
            setSubCategories([]);
        }
    }, [categoryId]);

    const loadMeta = async () => {
        const [accs, cats] = await Promise.all([
            AccountService.getAll(),
            CategoryService.getAll()
        ]);
        setAccounts(accs);
        setCategories(cats);

        if (!initialData) {
            if (accs.length > 0) setAccountId(accs[0].id);
            if (cats.length > 0) setCategoryId(cats[0].id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const rawAmount = Math.abs(parseFloat(amount));
            const finalAmount = type === 'expense' ? -rawAmount : rawAmount;

            const payload: any = {
                name,
                account_id: accountId,
                amount: finalAmount,
                category_id: categoryId,
                sub_category_id: subCategoryId || undefined,
                day_of_month: dayOfMonth,
                start_month: startMonth,
                end_month: endMonth || undefined,
                default_status: defaultStatus,
                is_active: 1
            };

            if (initialData) {
                await RecurringService.update(initialData.id, payload);
            } else {
                await RecurringService.create(payload);
            }
            showToast(initialData ? 'Recurring rule updated successfully' : 'Recurring rule created successfully');
            onSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            showToast('Failed to save recurring rule', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? 'Edit Recurring Rule' : 'New Recurring Rule'}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
                    <input
                        required
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        placeholder="e.g. Rent, Netflix"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Type</label>
                    <div className="flex bg-gray-800 rounded p-1">
                        <button
                            type="button"
                            onClick={() => setType('expense')}
                            className={`flex-1 text-sm py-1 rounded ${type === 'expense' ? 'bg-red-500/20 text-red-500' : 'text-gray-400'}`}
                        >
                            Expense
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('income')}
                            className={`flex-1 text-sm py-1 rounded ${type === 'income' ? 'bg-green-500/20 text-green-500' : 'text-gray-400'}`}
                        >
                            Income
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Amount</label>
                        <input
                            required
                            type="number"
                            min="0"
                            step="any"
                            value={amount}
                            onChange={e => {
                                const val = e.target.value.replace(/-/g, '');
                                setAmount(val);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === '-') {
                                    e.preventDefault();
                                }
                            }}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                            placeholder="0.00"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Account</label>
                        <select
                            required
                            value={accountId}
                            onChange={e => setAccountId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        >
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
                        <select
                            required
                            value={categoryId}
                            onChange={e => { setCategoryId(e.target.value); setSubCategoryId(''); }}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        >
                            <option value="" disabled>Select...</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Sub-Category</label>
                        <select
                            value={subCategoryId}
                            onChange={e => setSubCategoryId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                            disabled={subCategories.length === 0}
                        >
                            <option value="">None</option>
                            {subCategories.map(sub => (
                                <option key={sub.id} value={sub.id}>{sub.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Day of Month</label>
                        <input
                            required
                            type="number"
                            min="1"
                            max="28"
                            value={dayOfMonth}
                            onChange={e => setDayOfMonth(parseInt(e.target.value))}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Start Month</label>
                        <input
                            required
                            type="month"
                            value={startMonth}
                            onChange={e => setStartMonth(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">End Month</label>
                        <input
                            type="month"
                            value={endMonth}
                            onChange={e => setEndMonth(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                            placeholder="Optional"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Default Status</label>
                    <div className="flex bg-gray-800 rounded p-1">
                        <button
                            type="button"
                            onClick={() => setDefaultStatus('pending')}
                            className={`flex-1 text-sm py-1 rounded ${defaultStatus === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : 'text-gray-400'}`}
                        >
                            Pending
                        </button>
                        <button
                            type="button"
                            onClick={() => setDefaultStatus('posted')}
                            className={`flex-1 text-sm py-1 rounded ${defaultStatus === 'posted' ? 'bg-green-500/20 text-green-500' : 'text-gray-400'}`}
                        >
                            Posted
                        </button>
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
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
                        className="px-4 py-2 bg-primary hover:bg-blue-600 rounded text-sm text-white font-medium"
                    >
                        {loading ? 'Saving...' : 'Save Rule'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
