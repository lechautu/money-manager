import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Calculator, Plus, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { BudgetService } from '../services/BudgetService';
import type { Budget } from '../services/BudgetService';
import { useToast } from '../components/common/Toast';
import { BudgetModal } from '../components/budget/BudgetModal';
import { MonthPicker } from '../components/common/MonthPicker';

export default function BudgetPage() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBudget, setSelectedBudget] = useState<{ id: string, categoryId: string, subCategoryId: string | null, amount: number } | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    const { showToast } = useToast();

    useEffect(() => {
        loadData();
    }, [currentMonth]);

    const loadData = async () => {
        setLoading(true);
        try {
            const b = await BudgetService.getBudgetsForMonth(format(currentMonth, 'yyyy-MM'));
            setBudgets(b);
        } catch (e) {
            console.error(e);
            showToast('Failed to load budgets', 'error');
        } finally {
            setLoading(false);
        }
    };

    const groupedBudgets = useMemo(() => {
        const groups: Record<string, { id: string, name: string, budgets: Budget[], totalAmount: number, totalSpent: number }> = {};

        budgets.forEach(b => {
            if (!groups[b.category_id]) {
                groups[b.category_id] = { id: b.category_id, name: b.category_name, budgets: [], totalAmount: 0, totalSpent: 0 };
            }
            groups[b.category_id].budgets.push(b);
            groups[b.category_id].totalAmount += b.amount;
            groups[b.category_id].totalSpent += (b.spent || 0);
        });

        return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount || a.name.localeCompare(b.name));
    }, [budgets]);

    const handleEdit = (b: Budget) => {
        setSelectedBudget({
            id: b.id,
            categoryId: b.category_id,
            subCategoryId: b.sub_category_id || null,
            amount: b.amount
        });
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setSelectedBudget(null);
        setIsModalOpen(true);
    };

    const toggleExpand = (catId: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(catId)) next.delete(catId);
            else next.add(catId);
            return next;
        });
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const monthSummary = useMemo(() => {
        const total = budgets.reduce((acc, b) => ({
            budget: acc.budget + b.amount,
            spent: acc.spent + (b.spent || 0)
        }), { budget: 0, spent: 0 });
        return total;
    }, [budgets]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center text-blue-500">
                        <Calculator size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Budgets</h1>
                        <p className="text-xs text-gray-500">Plan your monthly spending</p>
                    </div>
                </div>

                <MonthPicker currentDate={currentMonth} onChange={setCurrentMonth} />

                <button
                    onClick={handleNew}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 rounded-lg text-sm font-bold text-white shadow-lg shadow-blue-900/40 transition-all active:scale-95"
                >
                    <Plus size={18} /> New Budget
                </button>
            </div>

            {/* Summary Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 text-gray-800 pointer-events-none group-hover:scale-110 transition-transform">
                        <Calculator size={64} />
                    </div>
                    <div className="relative">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Budget</div>
                        <div className="text-2xl font-black text-white">{formatMoney(monthSummary.budget)}</div>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col justify-center">
                    <div className="flex justify-between items-end mb-2">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Global Progress</div>
                        <div className="text-lg font-black text-white">
                            {formatMoney(monthSummary.spent)} <span className="text-xs text-gray-500 font-normal">/ {Math.round((monthSummary.spent / (monthSummary.budget || 1)) * 100)}%</span>
                        </div>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden border border-gray-700/50 p-0.5">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ${monthSummary.spent > monthSummary.budget ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
                            style={{ width: `${Math.min((monthSummary.spent / (monthSummary.budget || 1)) * 100, 100)}%` }}
                        ></div>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Remaining</div>
                    <div className={`text-2xl font-black ${monthSummary.budget - monthSummary.spent < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {formatMoney(monthSummary.budget - monthSummary.spent)}
                    </div>
                </div>
            </div>

            {/* Category Groups */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-20 text-gray-500 animate-pulse">Loading budgets...</div>
                ) : groupedBudgets.length === 0 ? (
                    <div className="bg-gray-900/50 border border-dashed border-gray-800 rounded-2xl py-20 text-center">
                        <Calculator size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="text-gray-500">No budgets set for this month.</p>
                        <button onClick={handleNew} className="text-primary hover:underline mt-2">Start budgeting</button>
                    </div>
                ) : (
                    groupedBudgets.map(group => {
                        const isExpanded = expandedCategories.has(group.id);
                        const progress = Math.min((group.totalSpent / (group.totalAmount || 1)) * 100, 100);
                        const isOver = group.totalSpent > group.totalAmount && group.totalAmount > 0;


                        return (
                            <div key={group.id} className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg hover:border-gray-700 transition-colors overflow-hidden">
                                {/* Header Row */}
                                <div
                                    className={`p-4 flex items-center justify-between cursor-pointer ${isExpanded ? 'bg-gray-800/30' : ''}`}
                                    onClick={() => toggleExpand(group.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg ${isOver ? 'bg-red-500/10 text-red-500' : 'bg-gray-800 text-gray-400'}`}>
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white flex items-center gap-2">
                                                {group.name}
                                                {isOver && <span className="bg-red-500 text-[10px] px-1.5 py-0.5 rounded text-white font-black uppercase tracking-tighter shadow-lg shadow-red-900/20">Over</span>}
                                            </h3>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                                                {group.budgets.length} item{group.budgets.length > 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="hidden md:block w-32">
                                            {group.totalAmount > 0 ? (
                                                <>
                                                    <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                                                        <span>{Math.round(progress)}%</span>
                                                        <span>{formatMoney(group.totalSpent)}</span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${isOver ? 'bg-red-500' : 'bg-primary'}`}
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-right">
                                                    <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Spent</div>
                                                    <div className="text-xs font-bold text-gray-400">{formatMoney(group.totalSpent)}</div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right">
                                            <div className="text-sm font-black text-white">
                                                {group.totalAmount > 0 ? formatMoney(group.totalAmount) : "Unlimited"}
                                            </div>
                                            {group.totalAmount > 0 ? (
                                                <div className={`text-[10px] font-bold ${group.totalAmount - group.totalSpent < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    {group.totalAmount - group.totalSpent < 0 ? '-' : '+'}{formatMoney(Math.abs(group.totalAmount - group.totalSpent))} left
                                                </div>
                                            ) : (
                                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">No Limit</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Items */}
                                {isExpanded && (
                                    <div className="border-t border-gray-800 bg-gray-900/80 divide-y divide-gray-800/50 animate-in slide-in-from-top-2 duration-300">
                                        {group.budgets.sort((a, b) => (a.sub_category_name || '').localeCompare(b.sub_category_name || '')).map(b => (
                                            <div key={b.id} className="p-3 pl-12 flex items-center justify-between group/item hover:bg-gray-800/20 transition-colors">
                                                <div className="flex-1">
                                                    <div className="text-sm font-semibold text-gray-300">
                                                        {b.sub_category_name || <span className="italic text-gray-500">Unallocated</span>}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        {b.amount > 0 ? (
                                                            <div className="flex-1 max-w-[150px] h-1 bg-gray-800 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${b.spent && b.spent > b.amount ? 'bg-red-500' : 'bg-gray-600'}`}
                                                                    style={{ width: `${Math.min(((b.spent || 0) / (b.amount || 1)) * 100, 100)}%` }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">No Cap</div>
                                                        )}
                                                        <span className="text-[10px] font-medium text-gray-500">{formatMoney(b.spent || 0)} used</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <span className="text-sm font-bold text-gray-200">
                                                        {b.amount > 0 ? formatMoney(b.amount) : "Unlimited"}
                                                    </span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEdit(b); }}
                                                        className="p-1.5 text-gray-600 hover:text-white hover:bg-gray-800 rounded transition-all opacity-0 group-hover/item:opacity-100"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        <div className="p-2 pl-12 flex justify-start">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleNew(); }}
                                                className="text-[10px] font-bold text-primary hover:text-blue-400 flex items-center gap-1 uppercase tracking-wider p-1"
                                            >
                                                <Plus size={12} /> Add sub-category budget
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <BudgetModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                month={format(currentMonth, 'yyyy-MM')}
                onSaved={loadData}
                initialData={selectedBudget}
            />
        </div>
    );
}

