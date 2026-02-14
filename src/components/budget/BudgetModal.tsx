import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { BudgetService } from '../../services/BudgetService';
import { CategoryService } from '../../services/CategoryService';
import type { Category, SubCategory } from '../../services/CategoryService';
import { Save, Trash2 } from 'lucide-react';

interface BudgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    month: string;
    onSaved: () => void;
    initialData?: {
        id: string;
        categoryId: string;
        subCategoryId: string | null;
        amount: number;
    } | null;
}

export function BudgetModal({ isOpen, onClose, month, onSaved, initialData }: BudgetModalProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

    const [categoryId, setCategoryId] = useState('');
    const [subCategoryId, setSubCategoryId] = useState<string>('none');
    const [amount, setAmount] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadCategories();
            if (initialData) {
                setCategoryId(initialData.categoryId);
                setSubCategoryId(initialData.subCategoryId || 'none');
                setAmount(initialData.amount.toString());
            } else {
                setCategoryId('');
                setSubCategoryId('none');
                setAmount('');
            }
        }
    }, [isOpen, initialData]);

    const loadCategories = async () => {
        const [cats, subs] = await Promise.all([
            CategoryService.getAll(),
            CategoryService.getAllSubCategories()
        ]);
        setCategories(cats);
        setSubCategories(subs);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoryId) return;

        try {
            const subId = subCategoryId === 'none' ? null : subCategoryId;
            await BudgetService.setBudget(month, categoryId, subId, parseFloat(amount || '0'), initialData?.id);
            onSaved();
            onClose();
        } catch (error) {
            console.error('Failed to save budget:', error);
        }
    };

    const handleDelete = async () => {
        if (!initialData) return;
        if (confirm('Are you sure you want to delete this budget?')) {
            try {
                await BudgetService.deleteBudget(initialData.id);
                onSaved();
                onClose();
            } catch (error) {
                console.error('Failed to delete budget:', error);
            }
        }
    };

    const filteredSubCats = subCategories.filter(s => s.category_id === categoryId);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Budget" : "New Budget"}>
            <form onSubmit={handleSave} className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Category</label>
                    <select
                        required
                        value={categoryId}
                        onChange={e => {
                            setCategoryId(e.target.value);
                            setSubCategoryId('none');
                        }}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                    >
                        <option value="">Select Category</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Sub-Category (Optional)</label>
                    <select
                        value={subCategoryId}
                        onChange={e => setSubCategoryId(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary disabled:opacity-50"
                        disabled={!categoryId}
                    >
                        <option value="none">Category Overall</option>
                        {filteredSubCats.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Monthly Amount</label>
                    <input
                        type="number"
                        step="0.01"
                        required
                        autoFocus
                        placeholder="0.00"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                    />
                </div>

                <div className="flex justify-between items-center pt-2">
                    <div>
                        {initialData && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="flex items-center gap-2 text-red-500 hover:text-red-400 text-sm font-medium"
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-primary hover:bg-blue-600 rounded text-sm font-bold text-white flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                        >
                            <Save size={16} /> {initialData ? "Update" : "Save"}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
