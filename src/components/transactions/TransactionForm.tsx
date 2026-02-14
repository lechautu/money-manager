import { useState, useEffect } from 'react';
import { TransactionService } from '../../services/TransactionService';
import type { Transaction } from '../../services/TransactionService';
import { AccountService } from '../../services/AccountService';
import type { Account } from '../../services/AccountService';
import { CategoryService } from '../../services/CategoryService';
import type { Category, SubCategory } from '../../services/CategoryService';
import { Modal } from '../ui/Modal';
import { useToast } from '../common/Toast';
import { Plus, X } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';

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

    // Split State
    const [isSplit, setIsSplit] = useState(false);
    const [splitLines, setSplitLines] = useState<{ id: string; categoryId: string; subCategoryId: string; amount: string; note: string }[]>([]);

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
    const [allSubCategories, setAllSubCategories] = useState<SubCategory[]>([]);

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

                if (initialData.is_split) {
                    setIsSplit(true);
                    setSplitLines(initialData.splitLines?.map(l => ({
                        id: l.id,
                        categoryId: l.category_id,
                        subCategoryId: l.sub_category_id || '',
                        amount: l.amount.toString(),
                        note: l.note || ''
                    })) || []);
                } else {
                    setIsSplit(false);
                    setSplitLines([]);
                }
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
                setIsSplit(false);
                setSplitLines([]);
                // Account/Category defaults handled after loadMeta or user selection
            }
        }
    }, [isOpen, initialData, defaultValues]);

    // Handle Split Toggle Logic
    const handleToggleSplit = () => {
        if (!isSplit) {
            // Turning ON
            // Auto-create first line from existing values if present
            const currentAmount = amount ? parseFloat(amount) : 0;
            if (currentAmount > 0 || categoryId) {
                setSplitLines([{
                    id: Math.random().toString(36).substr(2, 9),
                    categoryId: categoryId || '',
                    subCategoryId: subCategoryId || '',
                    amount: currentAmount > 0 ? currentAmount.toString() : '',
                    note: note || ''
                }]);
            } else {
                setSplitLines([]);
            }
            setIsSplit(true);
        } else {
            // Turning OFF
            // calculate total amount
            const total = splitLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
            setAmount(total > 0 ? total.toString() : '');

            // Restore category from first line (optional UX improvement)
            if (splitLines.length > 0) {
                setCategoryId(splitLines[0].categoryId);
                setSubCategoryId(splitLines[0].subCategoryId);
            }

            setIsSplit(false);
        }
    };

    const addSplitLine = () => {
        setSplitLines([...splitLines, {
            id: Math.random().toString(36).substr(2, 9),
            categoryId: '',
            subCategoryId: '',
            amount: '',
            note: ''
        }]);
    };

    const removeSplitLine = (index: number) => {
        const newLines = [...splitLines];
        newLines.splice(index, 1);
        setSplitLines(newLines);
    };

    const updateSplitLine = (index: number, field: keyof typeof splitLines[0], value: string) => {
        const newLines = [...splitLines];
        newLines[index] = { ...newLines[index], [field]: value };
        setSplitLines(newLines);
    };

    const getComputedTotal = () => {
        return splitLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
    };

    // When category changes, load subcategories
    useEffect(() => {
        if (categoryId) {
            CategoryService.getSubCategories(categoryId).then(setSubCategories);
        } else {
            setSubCategories([]);
        }
    }, [categoryId]);

    const loadMeta = async () => {
        const [accs, cats, allSubs] = await Promise.all([
            AccountService.getAll(),
            CategoryService.getAll(),
            CategoryService.getAllSubCategories()
        ]);
        setAccounts(accs);
        setCategories(cats);
        setAllSubCategories(allSubs);

        if (!initialData && !defaultValues?.account_id) {
            if (accs.length > 0) setAccountId(accs[0].id);
        }
        if (!initialData && !defaultValues?.category_id) {
            if (cats.length > 0) setCategoryId(cats[0].id);
        }
    };

    const handleSubmit = async () => {
        if (!accountId) {
            showToast('Please select an account', 'error');
            return;
        }

        if (!isSplit && (!amount || !categoryId)) {
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
            const val = amount ? Math.abs(parseFloat(amount)) : 0;
            const computedTotal = isSplit ? getComputedTotal() : val;

            if (computedTotal <= 0) {
                showToast('Total amount must be greater than zero', 'error');
                return;
            }

            if (isSplit) {
                if (splitLines.length === 0) {
                    showToast('Split transaction must have at least one line', 'error');
                    return;
                }
                for (const line of splitLines) {
                    if (!line.categoryId) {
                        showToast('All split lines must have a category', 'error');
                        return;
                    }
                    if (!parseFloat(line.amount) || parseFloat(line.amount) <= 0) {
                        showToast('All split lines must have a valid amount', 'error');
                        return;
                    }
                }
            }

            let savedTx: any;
            if (initialData) {
                // Update existing record
                const finalAmount = type === 'expense' ? -computedTotal : computedTotal;
                const updateData: any = {
                    date,
                    amount: finalAmount,
                    account_id: accountId,
                    to_account_id: type === 'transfer' ? toAccountId : null,
                    category_id: isSplit ? undefined : categoryId,
                    sub_category_id: isSplit ? undefined : (subCategoryId || null),
                    note,
                    status,
                    month: date.slice(0, 7),
                    source: initialData.source, // Preserve source
                    is_split: isSplit ? 1 : 0,
                    splitLines: isSplit ? splitLines.map(l => ({
                        category_id: l.categoryId,
                        sub_category_id: l.subCategoryId || null,
                        amount: parseFloat(l.amount),
                        note: l.note || null
                    })) : []
                };
                await TransactionService.update(initialData.id, updateData);
                savedTx = { ...initialData, ...updateData };
            } else {
                // New record
                if (type === 'transfer') {
                    savedTx = await TransactionService.transfer(accountId, toAccountId, val, date, categoryId, subCategoryId || undefined, note);
                } else {
                    const finalAmount = isSplit
                        ? (type === 'expense' ? -computedTotal : computedTotal)
                        : (type === 'expense' ? -val : val);

                    const txData: any = {
                        date,
                        amount: finalAmount,
                        account_id: accountId,
                        category_id: isSplit ? undefined : categoryId,
                        sub_category_id: isSplit ? undefined : (subCategoryId || null),
                        note,
                        status,
                        month: date.slice(0, 7),
                        source: defaultValues?.source || 'manual',
                        is_split: isSplit ? 1 : 0,
                        splitLines: isSplit ? splitLines.map(l => ({
                            category_id: l.categoryId,
                            sub_category_id: l.subCategoryId || null,
                            amount: parseFloat(l.amount),
                            note: l.note || null
                        })) : []
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
                {/* Type Toggles */}
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
                        className={`flex-1 py-1 text-sm rounded-md transition-colors ${type === 'income' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'} ${(isReadOnly('type') || (initialData?.source === 'transfer')) ? 'opacity-50 cursor-not-allowed' : ''}`}
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

                {/* Split Toggle */}
                {type !== 'transfer' && (
                    <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                        <label className="text-sm text-gray-400">Split Transaction</label>
                        <button
                            onClick={handleToggleSplit}
                            className={`w-10 h-6 rounded-full transition-colors relative ${isSplit ? 'bg-primary' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isSplit ? 'left-5' : 'left-1'}`} />
                        </button>
                    </div>
                )}

                {/* Date and Amount / Account Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs text-gray-400">Date</label>
                            <span className="text-[10px] text-primary font-medium">
                                {formatDisplayDate(date)}
                            </span>
                        </div>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            disabled={isReadOnly('date')}
                            className={`w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary ${isReadOnly('date') ? 'opacity-50' : ''}`}
                        />
                    </div>
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

                {isSplit ? (
                    <div className="space-y-3">
                        {splitLines.map((line, idx) => (
                            <div key={line.id} className="bg-gray-900/50 p-2 rounded border border-gray-800/50 relative">
                                <button
                                    onClick={() => removeSplitLine(idx)}
                                    className="absolute -top-2 -right-2 p-1 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                                >
                                    <X size={12} />
                                </button>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <select
                                        value={line.categoryId}
                                        onChange={e => updateSplitLine(idx, 'categoryId', e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                    >
                                        <option value="">Category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <input
                                        type="number"
                                        value={line.amount}
                                        onChange={e => updateSplitLine(idx, 'amount', e.target.value)}
                                        placeholder="Amount"
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        value={line.subCategoryId}
                                        onChange={e => updateSplitLine(idx, 'subCategoryId', e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                        disabled={!line.categoryId}
                                    >
                                        <option value="">Sub Category</option>
                                        {line.categoryId ? (
                                            allSubCategories
                                                .filter(sc => sc.category_id === line.categoryId)
                                                .map(sc => (
                                                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                                                ))
                                        ) : (
                                            <option value="" disabled>Select Category First</option>
                                        )}
                                    </select>
                                    <input
                                        type="text"
                                        value={line.note}
                                        onChange={e => updateSplitLine(idx, 'note', e.target.value)}
                                        placeholder="Note (opt)"
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                    />
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={addSplitLine}
                            className="w-full py-2 flex items-center justify-center gap-2 text-xs text-primary border border-primary/30 rounded hover:bg-primary/10 transition-colors"
                        >
                            <Plus size={14} /> Add Split Line
                        </button>
                        <div className="flex justify-between items-center px-2 py-1 bg-gray-800 rounded text-sm">
                            <span className="text-gray-400">Total:</span>
                            <span className="font-bold text-white">{getComputedTotal()}</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Amount - only in normal mode */}
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

                        {/* Category Selection */}
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
                    </>
                )}

                {/* Common Note Field */}
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Note (optional)</label>
                    <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Description..."
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary resize-none"
                    />
                </div>

                <div>
                    <label className="block text-xs text-gray-400 mb-1">Status</label>
                    <select
                        value={status}
                        onChange={e => setStatus(e.target.value as any)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    >
                        <option value="posted">Posted</option>
                        <option value="pending">Pending</option>
                        <option value="ignored">Ignored</option>
                    </select>
                </div>

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
        </Modal>
    );
}
