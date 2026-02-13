import { useState, useEffect } from 'react';
import { TransactionService } from '../../services/TransactionService';
import type { Transaction } from '../../services/TransactionService';
import { AccountService } from '../../services/AccountService';
import type { Account } from '../../services/AccountService';
import { CategoryService } from '../../services/CategoryService';
import type { Category, SubCategory } from '../../services/CategoryService';
import { Modal } from '../ui/Modal';
import { useToast } from '../common/Toast';

interface TransactionFormProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Transaction | null;
    defaultValues?: Partial<Transaction> & { toAccountId?: string; amount?: number; type?: 'expense' | 'income' | 'transfer' };
    onSuccess: (tx?: Transaction) => void;
    readOnlyFields?: string[];
}

export function TransactionForm({ isOpen, onClose, initialData, defaultValues, onSuccess, readOnlyFields }: TransactionFormProps) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
    const [accountId, setAccountId] = useState('');
    const [toAccountId, setToAccountId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [subCategoryId, setSubCategoryId] = useState('');
    const [note, setNote] = useState('');
    const [status, setStatus] = useState<'posted' | 'pending'>('posted');

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    // Destructure readOnlyFields for easier access
    const isReadOnly = (field: string) => readOnlyFields?.includes(field);

    useEffect(() => {
        if (isOpen) {
            loadMeta();
            if (initialData) {
                setDate(initialData.date);
                setAmount(Math.abs(initialData.amount).toString());

                if (initialData.source === 'transfer') {
                    setType('transfer');
                    setAccountId(initialData.account_id);
                    setToAccountId(initialData.to_account_id || '');
                } else {
                    setType(initialData.amount < 0 ? 'expense' : 'income');
                    setAccountId(initialData.account_id);
                }

                setCategoryId(initialData.category_id);
                setSubCategoryId(initialData.sub_category_id || '');
                setNote(initialData.note || '');
                setStatus(initialData.status as any);
            } else if (defaultValues) {
                setDate(defaultValues.date || new Date().toISOString().split('T')[0]);
                // Handle extended defaultValues
                const def: any = defaultValues;
                setAmount(def.amount !== undefined ? Math.abs(def.amount).toString() : '');

                if (def.type) {
                    setType(def.type);
                } else {
                    setType((def.amount || 0) > 0 ? 'income' : 'expense');
                }

                setAccountId(def.account_id || '');
                setToAccountId(def.toAccountId || '');
                setCategoryId(def.category_id || '');
                setSubCategoryId(def.sub_category_id || '');
                setNote(def.note || '');
                setStatus((def.status as any) || 'posted');
            } else {
                // Defaults
                setDate(new Date().toISOString().split('T')[0]);
                setAmount('');
                setType('expense');
                setStatus('posted');
                setNote('');
                // Account/Category defaults handled after loadMeta or user selection
            }
        }
    }, [isOpen, initialData, defaultValues]);

    // When category changes, load subcategories
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

        if (!initialData && !defaultValues?.account_id) {
            if (accs.length > 0) setAccountId(accs[0].id);
        }
        if (!initialData && !defaultValues?.category_id) {
            if (cats.length > 0) setCategoryId(cats[0].id);
        }
    };

    const handleSubmit = async () => {
        if (!amount || !accountId || !categoryId || !note) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        if (type === 'transfer') {
            if (!toAccountId) {
                showToast('Please select "To Account"', 'error');
                return;
            }
            if (accountId === toAccountId) {
                showToast('Source and Destination accounts must be different', 'error');
                return;
            }
        }

        setLoading(true);
        try {
            const val = Math.abs(parseFloat(amount));
            if (val <= 0) {
                showToast('Please enter an amount greater than zero', 'error');
                return;
            }

            let savedTx: any;
            if (initialData) {
                // Update existing record
                const updateData: any = {
                    date,
                    amount: type === 'expense' ? -val : val,
                    account_id: accountId,
                    to_account_id: type === 'transfer' ? toAccountId : null,
                    category_id: categoryId,
                    sub_category_id: subCategoryId || null,
                    note,
                    status,
                    month: date.slice(0, 7),
                    source: initialData.source // Preserve source
                };
                await TransactionService.update(initialData.id, updateData);
                savedTx = { ...initialData, ...updateData };
            } else {
                // New record
                if (type === 'transfer') {
                    savedTx = await TransactionService.transfer(accountId, toAccountId, val, date, categoryId, subCategoryId || undefined, note);
                } else {
                    const finalAmount = type === 'expense' ? -val : val;
                    const txData: any = {
                        date,
                        amount: finalAmount,
                        account_id: accountId,
                        category_id: categoryId,
                        sub_category_id: subCategoryId || null,
                        note,
                        status,
                        month: date.slice(0, 7),
                        source: defaultValues?.source || 'manual'
                    };
                    savedTx = await TransactionService.create(txData);
                }
            }

            if (onSuccess) {
                await Promise.resolve(onSuccess(savedTx));
            }

            showToast(initialData ? 'Transaction updated successfully' : 'Transaction created successfully');
            onClose();
        } catch (e) {
            console.error(e);
            showToast('Failed to save transaction', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Transaction' : 'New Transaction'}>
            <div className="space-y-4">
                <div className="flex gap-2 p-1 bg-gray-800 rounded-lg">
                    <button
                        disabled={isReadOnly('type') || (initialData?.source === 'transfer')}
                        className={`flex-1 py-1 text-sm rounded-md transition-colors ${type === 'expense' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white'} ${(isReadOnly('type') || (initialData?.source === 'transfer')) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => !isReadOnly('type') && setType('expense')}
                    >
                        Expense
                    </button>
                    <button
                        disabled={isReadOnly('type') || (initialData?.source === 'transfer')}
                        className={`flex-1 py-1 text-sm rounded-md transition-colors ${type === 'income' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'} ${(isReadOnly('type') || (initialData?.source === 'transfer')) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => !isReadOnly('type') && setType('income')}
                    >
                        Income
                    </button>
                    <button
                        disabled={isReadOnly('type') || (initialData?.source === 'transfer')}
                        className={`flex-1 py-1 text-sm rounded-md transition-colors ${type === 'transfer' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'} ${(isReadOnly('type') || (initialData?.source === 'transfer')) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => !isReadOnly('type') && setType('transfer')}
                    >
                        Transfer
                    </button>
                </div>
                {initialData?.source === 'transfer' && (
                    <div className="text-xs text-gray-500 text-center">
                        Transfer type cannot be changed. Delete and recreate if needed.
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            disabled={isReadOnly('date')}
                            className={`w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary ${isReadOnly('date') ? 'opacity-50' : ''}`}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Amount</label>
                        <input
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
                            placeholder="0"
                            disabled={isReadOnly('amount')}
                            className={`w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary ${isReadOnly('amount') ? 'opacity-50' : ''}`}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">{type === 'transfer' ? 'From Account' : 'Account'}</label>
                        <select
                            value={accountId}
                            onChange={e => setAccountId(e.target.value)}
                            disabled={isReadOnly('account_id')}
                            className={`w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary ${isReadOnly('account_id') ? 'opacity-50' : ''}`}
                        >
                            <option value="">Select Account</option>
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                            ))}
                        </select>
                    </div>

                    {type === 'transfer' && (
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">To Account</label>
                            <select
                                value={toAccountId}
                                onChange={e => setToAccountId(e.target.value)}
                                disabled={isReadOnly('toAccountId')}
                                className={`w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary ${isReadOnly('toAccountId') ? 'opacity-50' : ''}`}
                            >
                                <option value="">Select Account</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs text-gray-400">Category</label>
                            <button
                                onClick={() => {
                                    const name = prompt("Enter new category name:");
                                    if (name) {
                                        CategoryService.createCategory(name).then(newCat => {
                                            setCategories([...categories, newCat]);
                                            setCategoryId(newCat.id);
                                        });
                                    }
                                }}
                                className="text-xs text-primary hover:text-blue-400"
                            >
                                + New
                            </button>
                        </div>
                        <select
                            value={categoryId}
                            onChange={e => setCategoryId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                        >
                            <option value="">Select Category</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs text-gray-400">Sub Category</label>
                            {categoryId && (
                                <button
                                    onClick={() => {
                                        const name = prompt("Enter new sub-category name:");
                                        if (name) {
                                            CategoryService.createSubCategory(categoryId, name).then(newSub => {
                                                setSubCategories([...subCategories, newSub]);
                                                setSubCategoryId(newSub.id);
                                            });
                                        }
                                    }}
                                    className="text-xs text-primary hover:text-blue-400"
                                >
                                    + New
                                </button>
                            )}
                        </div>
                        <select
                            value={subCategoryId}
                            onChange={e => setSubCategoryId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                            disabled={!categoryId}
                        >
                            <option value="">Select Sub Category</option>
                            {subCategories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-gray-400 mb-1">Note</label>
                    <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Description..."
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary resize-none"
                    />
                </div>

                {type !== 'transfer' && (
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="status"
                            checked={status === 'pending'}
                            onChange={e => setStatus(e.target.checked ? 'pending' : 'posted')}
                        />
                        <label htmlFor="status" className="text-sm text-gray-300">Mark as pending</label>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm rounded transition-colors"
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </Modal >
    );
}
