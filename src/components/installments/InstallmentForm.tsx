import { useState, useEffect } from 'react';
import { InstallmentService } from '../../services/InstallmentService';
import { AccountService } from '../../services/AccountService';
import type { Account } from '../../services/AccountService';
import { CategoryService } from '../../services/CategoryService';
import type { Category, SubCategory } from '../../services/CategoryService';
import { Modal } from '../ui/Modal';
import { useToast } from '../common/Toast';

interface InstallmentFormProps {
    isOpen: boolean;
    onClose: () => void;
    // initialData?: InstallmentPlan | null; // MVP1: No editing of plans once created for simplicity? Or just allow editing name?
    // Let's allow creating new plans. Editing complex schedules is out of scope for MVP1 basic.
    onSuccess: () => void;
}

export function InstallmentForm({ isOpen, onClose, onSuccess }: InstallmentFormProps) {
    const [name, setName] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [tenor, setTenor] = useState(6);
    const [creditAccountId, setCreditAccountId] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [categoryId, setCategoryId] = useState('');
    const [subCategoryId, setSubCategoryId] = useState('');

    const [creditAccounts, setCreditAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            loadMeta();
            // Reset form
            setName('');
            setTotalAmount('');
            setTenor(6);
            setStartDate(new Date().toISOString().split('T')[0]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (categoryId) {
            CategoryService.getSubCategories(categoryId).then(setSubCategories);
            setSubCategoryId('');
        } else {
            setSubCategories([]);
        }
    }, [categoryId]);

    const loadMeta = async () => {
        const [accs, cats] = await Promise.all([
            AccountService.getAll(),
            CategoryService.getAll()
        ]);
        // Filter for credit accounts (assuming 'credit' type exists, or just allow all)
        // Schema has type CHECK(type IN ('bank','credit','debit'))
        const credits = accs.filter(a => a.type === 'credit');
        setCreditAccounts(credits);
        setCategories(cats);

        if (credits.length > 0) setCreditAccountId(credits[0].id);
        if (cats.length > 0) setCategoryId(cats[0].id);
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
                payment_source_account_id: undefined // Optional, user can set later? Or add to form?
            };

            await InstallmentService.create(payload);
            showToast('Installment plan created successfully');
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
            title="New Installment Plan"
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
                        <label className="block text-xs font-medium text-gray-400 mb-1">Credit Account</label>
                        <select
                            required
                            value={creditAccountId}
                            onChange={e => setCreditAccountId(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        >
                            {creditAccounts.length > 0 ? (
                                creditAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))
                            ) : (
                                <option value="" disabled>No credit accounts found</option>
                            )}
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

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Category (for payments)</label>
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
                        {loading ? 'Creating...' : 'Create Plan'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
