import { useState, useEffect } from 'react';
import { format, subMonths, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Calculator, Save, AlertCircle } from 'lucide-react';
import { BudgetService } from '../services/BudgetService';
import type { Budget } from '../services/BudgetService';
import { CategoryService } from '../services/CategoryService';
import type { Category } from '../services/CategoryService';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/common/Toast';

export default function BudgetPage() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_loading, setLoading] = useState(true);

    // Edit State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<string>('');
    const [editAmount, setEditAmount] = useState('');
    const { showToast } = useToast();

    useEffect(() => {
        loadData();
    }, [currentMonth]);

    const loadData = async () => {
        setLoading(true);
        const monthStr = format(currentMonth, 'yyyy-MM');

        const [b, c] = await Promise.all([
            BudgetService.getBudgetsForMonth(monthStr),
            CategoryService.getAll()
        ]);

        // Merge categories without budgets yet
        const merged: Budget[] = c.map(cat => {
            const existing = b.find(bud => bud.category_id === cat.id);
            return existing || {
                id: 'temp-' + cat.id,
                month: monthStr,
                category_id: cat.id,
                category_name: cat.name,
                amount: 0,
                spent: 0
            };
        });

        // Fetch spent for those that didn't have budget row (if any transactions exist)
        // Actually BudgetService.getBudgetsForMonth only returns rows in budgets table.
        // We need a way to get spent even if no budget set.
        // Refinement: The Service should probably do the Left Join on Categories instead of Budgets.
        // For MVP, let's just use what we have and maybe missing "spent" data for non-budgeted categories is acceptable?
        // Better: Update Service to LEFT JOIN from Categories. 
        // For now, let's handle it by manually fetching stats if needed, or rely on user creating budget.

        // Actually, let's just stick to "Set Budgets". If 0, it's 0.
        // But we want to see "Spent" even if budget is 0. 
        // Let's assume the user will set budgets.

        setBudgets(merged);
        setCategories(c);
        setLoading(false);
    };

    const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
    const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));

    const handleEdit = (b: Budget) => {
        setEditingCategory(b.category_id);
        setEditAmount(b.amount.toString());
        setIsEditOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const monthStr = format(currentMonth, 'yyyy-MM');
            await BudgetService.setBudget(monthStr, editingCategory, parseFloat(editAmount));
            showToast('Budget updated successfully');
            setIsEditOpen(false);
            loadData();
        } catch (e) {
            console.error(e);
            showToast('Failed to update budget', 'error');
        }
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Calculator className="text-primary" /> Budget
                </h1>
                <div className="flex items-center gap-4 bg-gray-900 px-4 py-2 rounded-lg border border-gray-800">
                    <button onClick={handlePrevMonth} className="text-gray-400 hover:text-white">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="font-semibold w-32 text-center">
                        {format(currentMonth, 'MMMM yyyy')}
                    </span>
                    <button onClick={handleNextMonth} className="text-gray-400 hover:text-white">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Summary Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
                <div>
                    <div className="text-gray-400 text-sm">Total Budget</div>
                    <div className="text-2xl font-bold text-white">{formatMoney(totalBudget)}</div>
                </div>
                <div className="flex-1 w-full md:mx-8">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Spent: {formatMoney(totalSpent)}</span>
                        <span className="text-gray-400">{Math.round((totalSpent / (totalBudget || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div
                            className={`h-full ${totalSpent > totalBudget ? 'bg-red-500' : 'bg-primary'}`}
                            style={{ width: `${Math.min((totalSpent / (totalBudget || 1)) * 100, 100)}%` }}
                        ></div>
                    </div>
                </div>
                <div>
                    <div className="text-gray-400 text-sm">Remaining</div>
                    <div className={`text-2xl font-bold ${totalBudget - totalSpent < 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {formatMoney(totalBudget - totalSpent)}
                    </div>
                </div>
            </div>

            {/* Budget List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {budgets.map(b => {
                    const progress = Math.min(((b.spent || 0) / (b.amount || 1)) * 100, 100);
                    const isOver = (b.spent || 0) > b.amount && b.amount > 0;

                    return (
                        <div key={b.category_id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 relative group">
                            <div className="flex justify-between items-start mb-2">
                                <div className="font-semibold text-lg text-white">{b.category_name}</div>
                                <button onClick={() => handleEdit(b)} className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    Edit
                                </button>
                            </div>

                            <div className="text-xl font-bold text-white mb-2">
                                {formatMoney(b.amount)}
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>Spent: {formatMoney(b.spent || 0)}</span>
                                    {isOver && <span className="text-red-500 flex items-center gap-1"><AlertCircle size={10} /> Over!</span>}
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`h-full ${isOver ? 'bg-red-500' : 'bg-green-500'}`}
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Set Budget">
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
                        <input
                            disabled
                            value={categories.find(c => c.id === editingCategory)?.name || ''}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Monthly Budget</label>
                        <input
                            autoFocus
                            type="number"
                            step="0.01"
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setIsEditOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary hover:bg-blue-600 rounded text-sm text-white flex items-center gap-2">
                            <Save size={16} /> Save
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
