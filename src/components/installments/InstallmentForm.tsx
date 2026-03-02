import { useState, useEffect } from 'react';
import { InstallmentService } from '../../services/InstallmentService';
import type { InstallmentPlan } from '../../services/InstallmentService';
import { AccountService } from '../../services/AccountService';
import type { Account } from '../../services/AccountService';
import { CategoryService } from '../../services/CategoryService';
import type { Category, SubCategory } from '../../services/CategoryService';
import { Modal } from '../ui/Modal';
import { useToast } from '../common/Toast';

interface InstallmentFormProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: InstallmentPlan | null;
    onSuccess: () => void;
}

export function InstallmentForm({ isOpen, onClose, onSuccess, initialData }: InstallmentFormProps) {
    const [name, setName] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [tenor, setTenor] = useState(6);
    const [creditAccountId, setCreditAccountId] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [categoryId, setCategoryId] = useState('');
    const [subCategoryId, setSubCategoryId] = useState('');
    const [defaultStatus, setDefaultStatus] = useState<'posted' | 'pending'>('pending');

    const [categories, setCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
    const [autoAdd, setAutoAdd] = useState(true);
    const [allAccounts, setAllAccounts] = useState<Account[]>([]);

    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            loadMeta();
            if (initialData) {
                setName(initialData.name || '');
                setTotalAmount(initialData.total_amount.toString());
                setTenor(initialData.tenor_months);
                setCreditAccountId(initialData.credit_account_id);
                setStartDate(initialData.start_date);
                setCategoryId(initialData.payment_category_id);
                setSubCategoryId(initialData.payment_sub_category_id || '');
                setAutoAdd(initialData.auto_add === 1);
                setDefaultStatus(initialData.default_status || 'posted');
            } else {
                // Reset form
                setName('');
                setTotalAmount('');
                setTenor(6);
                setStartDate(new Date().toISOString().split('T')[0]);
                setAutoAdd(true);
                setDefaultStatus('pending');
            }
        }
    }, [isOpen, initialData]);

    useEffect(() => {
        if (categoryId) {
            CategoryService.getSubCategories(categoryId).then((subs) => {
                setSubCategories(subs);
                if (initialData && initialData.payment_category_id === categoryId) {
                    setSubCategoryId(initialData.payment_sub_category_id || '');
                }
            });
        } else {
            setSubCategories([]);
        }
    }, [categoryId, initialData]);

    const loadMeta = async () => {
        const [accs, cats] = await Promise.all([
            AccountService.getAll(),
            CategoryService.getAll()
        ]);
        setCategories(cats);
        setAllAccounts(accs);

        if (!initialData) {
            if (accs.length > 0) setCreditAccountId(accs[0].id);
            if (cats.length > 0) setCategoryId(cats[0].id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload: any = {
                name,
                credit_account_id: creditAccountId,
                total_amount: Math.abs(parseFloat(totalAmount)),
                tenor_months: tenor,
                start_date: startDate,
                notify_before_days: 0,
                payment_category_id: categoryId,
                payment_sub_category_id: subCategoryId || undefined,
                auto_add: autoAdd,
                default_status: defaultStatus
            };

            if (initialData) {
                await InstallmentService.update(initialData.id, payload);
                showToast('Installment plan updated successfully');
            } else {
                await InstallmentService.create(payload);
                showToast('Installment plan created successfully');
            }
            onSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            showToast('Failed to save installment plan', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? "Edit Installment Plan" : "New Installment Plan"}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Plan Name</label>
                    <input
                        required
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        placeholder="e.g. iPhone 15"
                    />
                </div>

                {!initialData && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Total Amount</label>
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={totalAmount}
                                    onChange={e => {
                                        const val = e.target.value.replace(/-/g, '');
                                        setTotalAmount(val);
                                    }}
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Deduct from Account</label>
                                <select
                                    required
                                    value={creditAccountId}
                                    onChange={e => setCreditAccountId(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                                >
                                    {allAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Tenor (Months)</label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={tenor}
                                    onChange={e => setTenor(parseInt(e.target.value))}
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                                />
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
                    </>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Category (Billing)</label>
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

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Auto-Add</label>
                        <div className="flex bg-gray-900/50 rounded-lg p-1 gap-1">
                            <button
                                type="button"
                                onClick={() => setAutoAdd(true)}
                                className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all border ${autoAdd ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-transparent border-transparent text-gray-500'}`}
                            >
                                ON
                            </button>
                            <button
                                type="button"
                                onClick={() => setAutoAdd(false)}
                                className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all border ${!autoAdd ? 'bg-gray-700 border-gray-600 text-white' : 'bg-transparent border-transparent text-gray-500'}`}
                            >
                                OFF
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Default Status</label>
                        <div className="flex bg-gray-900/50 rounded-lg p-1 gap-1">
                            <button
                                type="button"
                                onClick={() => setDefaultStatus('posted')}
                                className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all border ${defaultStatus === 'posted' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-transparent border-transparent text-gray-500'}`}
                            >
                                POSTED
                            </button>
                            <button
                                type="button"
                                onClick={() => setDefaultStatus('pending')}
                                className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all border ${defaultStatus === 'pending' ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'bg-transparent border-transparent text-gray-500'}`}
                            >
                                PENDING
                            </button>
                        </div>
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
                        {loading ? 'Saving...' : (initialData ? 'Update Plan' : 'Create Plan')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
