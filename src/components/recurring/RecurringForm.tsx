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
    const [frequency, setFrequency] = useState<RecurringRule['frequency']>('monthly');
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState('');
    const [maxInstances, setMaxInstances] = useState('');
    const [endCondition, setEndCondition] = useState<'none' | 'date' | 'count'>('none');
    const [autoAdd, setAutoAdd] = useState(true);
    const [defaultStatus, setDefaultStatus] = useState<'pending' | 'posted'>('pending');

    const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
    const [toAccountId, setToAccountId] = useState('');

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
                setType(initialData.type);
                setAccountId(initialData.account_id);
                setToAccountId(initialData.to_account_id || '');
                setCategoryId(initialData.category_id || '');
                setSubCategoryId(initialData.sub_category_id || '');
                setFrequency(initialData.frequency);
                setStartDate(initialData.start_date);
                setEndDate(initialData.end_date || '');
                setMaxInstances(initialData.max_instances?.toString() || '');

                if (initialData.max_instances) setEndCondition('count');
                else if (initialData.end_date) setEndCondition('date');
                else setEndCondition('none');

                setAutoAdd(initialData.auto_add !== 0);
                setDefaultStatus(initialData.default_status);
            } else {
                setName('');
                setAmount('');
                setType('expense');
                setAccountId('');
                setToAccountId('');
                setCategoryId('');
                setSubCategoryId('');
                setFrequency('monthly');
                setStartDate(new Date().toISOString().slice(0, 10));
                setEndDate('');
                setMaxInstances('');
                setEndCondition('none');
                setAutoAdd(true);
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

        if (type === 'transfer') {
            if (!toAccountId) {
                showToast('Please select "To Account"', 'error');
                return;
            }
            if (accountId === toAccountId) {
                showToast('Source and Destination accounts must be different', 'error');
                return;
            }
        } else {
            if (!categoryId) {
                showToast('Please select a category', 'error');
                return;
            }
        }

        if (endCondition === 'date' && endDate && endDate < startDate) {
            showToast('End date cannot be before start date', 'error');
            return;
        }

        if (endCondition === 'count' && (!maxInstances || parseInt(maxInstances) <= 0)) {
            showToast('Max instances must be greater than 0', 'error');
            return;
        }

        setLoading(true);
        try {
            const rawAmount = Math.abs(parseFloat(amount));
            const finalAmount = type === 'expense' ? -rawAmount : rawAmount;

            const payload: any = {
                name,
                type,
                frequency,
                account_id: accountId,
                to_account_id: type === 'transfer' ? toAccountId : null,
                amount: finalAmount,
                category_id: type === 'transfer' ? (categoryId || null) : categoryId,
                sub_category_id: subCategoryId || null,
                start_date: startDate,
                end_date: endCondition === 'date' ? endDate : null,
                max_instances: endCondition === 'count' ? (parseInt(maxInstances) || null) : null,
                auto_add: autoAdd ? 1 : 0,
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
                            className={`flex-1 text-sm py-1 rounded transition-colors ${type === 'expense' ? 'bg-red-500/20 text-red-500' : 'text-gray-400 hover:bg-gray-700'}`}
                        >
                            Expense
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('income')}
                            className={`flex-1 text-sm py-1 rounded transition-colors ${type === 'income' ? 'bg-emerald-500/20 text-emerald-500' : 'text-gray-400 hover:bg-gray-700'}`}
                        >
                            Income
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('transfer')}
                            className={`flex-1 text-sm py-1 rounded transition-colors ${type === 'transfer' ? 'bg-blue-500/20 text-blue-500' : 'text-gray-400 hover:bg-gray-700'}`}
                        >
                            Transfer
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
                        <label className="block text-xs font-medium text-gray-400 mb-1">{type === 'transfer' ? 'From Account' : 'Account'}</label>
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

                {type === 'transfer' && (
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">To Account</label>
                        <select
                            required
                            value={toAccountId}
                            onChange={e => setToAccountId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        >
                            <option value="">Select Destination...</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
                        <select
                            required={type !== 'transfer'}
                            value={categoryId}
                            onChange={e => { setCategoryId(e.target.value); setSubCategoryId(''); }}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        >
                            <option value="">{type === 'transfer' ? 'None (Optional)' : 'Select...'}</option>
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

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Frequency</label>
                        <select
                            required
                            value={frequency}
                            onChange={e => setFrequency(e.target.value as any)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Bi-weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Start Date</label>
                        <input
                            required
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">End Condition</label>
                        <select
                            value={endCondition}
                            onChange={e => setEndCondition(e.target.value as any)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        >
                            <option value="none">Never (No End)</option>
                            <option value="date">Ends On Date</option>
                            <option value="count">Ends After Count</option>
                        </select>
                    </div>
                    {endCondition === 'date' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">End Date</label>
                            <input
                                required
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                            />
                        </div>
                    )}
                    {endCondition === 'count' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Max Instances</label>
                            <input
                                required
                                type="number"
                                min="1"
                                value={maxInstances}
                                onChange={e => setMaxInstances(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                                placeholder="e.g. 12"
                            />
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Processing Mode</label>
                    <div className="flex bg-gray-800 rounded p-1">
                        <button
                            type="button"
                            onClick={() => setAutoAdd(true)}
                            className={`flex-1 text-sm py-1 rounded transition-colors ${autoAdd ? 'bg-emerald-500/20 text-emerald-500' : 'text-gray-400 hover:bg-gray-700'}`}
                        >
                            Auto-Add
                        </button>
                        <button
                            type="button"
                            onClick={() => setAutoAdd(false)}
                            className={`flex-1 text-sm py-1 rounded transition-colors ${!autoAdd ? 'bg-orange-500/20 text-orange-500' : 'text-gray-400 hover:bg-gray-700'}`}
                        >
                            Manual
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                        {autoAdd ? 'Transactions are created automatically on due date.' : 'Transactions must be added manually. You will see a warning when due.'}
                    </p>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Default Status</label>
                    <div className="flex bg-gray-800 rounded p-1">
                        <button
                            type="button"
                            onClick={() => setDefaultStatus('pending')}
                            className={`flex-1 text-sm py-1 rounded transition-colors ${defaultStatus === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : 'text-gray-400 hover:bg-gray-700'}`}
                        >
                            Pending
                        </button>
                        <button
                            type="button"
                            onClick={() => setDefaultStatus('posted')}
                            className={`flex-1 text-sm py-1 rounded transition-colors ${defaultStatus === 'posted' ? 'bg-emerald-500/20 text-emerald-500' : 'text-gray-400 hover:bg-gray-700'}`}
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
