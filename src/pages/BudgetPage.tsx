import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Calculator, Plus, Edit2, ChevronDown, ChevronUp, Zap, RefreshCw, Copy, Trash2 } from 'lucide-react';
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
    const [syncing, setSyncing] = useState(false);
    const [cloneSourceMonth, setCloneSourceMonth] = useState('');
    const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
    const [selectedBudgetIds, setSelectedBudgetIds] = useState<Set<string>>(new Set());

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

    const handleAutoGenerate = async () => {
        if (!window.confirm('This will automatically create or update budget entries based on your active installments and recurring rules for this month. Continue?')) return;

        setSyncing(true);
        try {
            await BudgetService.generateBudgetsFromAutomation(format(currentMonth, 'yyyy-MM'));
            showToast('Budget generated successfully', 'success');
            await loadData();
        } catch (e) {
            console.error(e);
            showToast('Failed to generate budget', 'error');
        } finally {
            setSyncing(false);
        }
    };

    const handleClone = async () => {
        if (!cloneSourceMonth) return;

        setSyncing(true);
        try {
            await BudgetService.cloneMonthBudget(cloneSourceMonth, format(currentMonth, 'yyyy-MM'));
            showToast('Budget cloned successfully', 'success');
            setIsCloneModalOpen(false);
            await loadData();
        } catch (e) {
            console.error(e);
            showToast('Failed to clone budget', 'error');
        } finally {
            setSyncing(false);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm('Are you sure you want to clear ALL budget entries for this month? This action cannot be undone.')) return;

        setLoading(true);
        try {
            await BudgetService.clearMonthBudgets(format(currentMonth, 'yyyy-MM'));
            showToast('All budgets cleared', 'success');
            await loadData();
        } catch (e) {
            console.error(e);
            showToast('Failed to clear budgets', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (id: string) => {
        setSelectedBudgetIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectCategory = (ids: string[]) => {
        setSelectedBudgetIds(prev => {
            const next = new Set(prev);
            const allSelected = ids.every(id => next.has(id));
            if (allSelected) {
                ids.forEach(id => next.delete(id));
            } else {
                ids.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedBudgetIds.size} budget entries?`)) return;

        setLoading(true);
        try {
            await BudgetService.bulkDeleteBudgets(Array.from(selectedBudgetIds));
            showToast(`${selectedBudgetIds.size} budgets deleted`, 'success');
            setSelectedBudgetIds(new Set());
            await loadData();
        } catch (e) {
            console.error(e);
            showToast('Failed to delete budgets', 'error');
        } finally {
            setLoading(false);
        }
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

                <div className="flex items-center gap-2">
                    {selectedBudgetIds.size > 0 ? (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-red-900/40 transition-all active:scale-95 animate-in zoom-in-95 duration-200"
                        >
                            <Trash2 size={18} />
                            Delete ({selectedBudgetIds.size})
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setIsCloneModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-bold border border-gray-700 shadow-lg transition-all active:scale-95"
                            >
                                <Copy size={18} />
                                <span className="hidden md:inline">Clone</span>
                            </button>
                            <button
                                onClick={handleAutoGenerate}
                                disabled={syncing}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-emerald-500 rounded-lg text-sm font-bold border border-emerald-500/20 shadow-lg transition-all active:scale-95"
                                title="Auto-calculate budget from recurring rules and installments"
                            >
                                {syncing ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
                                <span className="hidden md:inline">Sync from Automation</span>
                            </button>
                            <button
                                onClick={handleClearAll}
                                disabled={loading || budgets.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-red-900/40 text-red-500 rounded-lg text-sm font-bold border border-red-500/20 shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                                title="Delete all budgets for this month"
                            >
                                <Trash2 size={18} />
                                <span className="hidden md:inline">Clear All</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={handleNew}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 rounded-lg text-sm font-bold text-white shadow-lg shadow-blue-900/40 transition-all active:scale-95"
                    >
                        <Plus size={18} /> New Budget
                    </button>
                </div>
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
                                        <div
                                            className="p-1 px-2"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectCategory(group.budgets.map(b => b.id));
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                className="rounded bg-gray-800 border-gray-700 text-primary focus:ring-0 cursor-pointer"
                                                checked={group.budgets.every(b => selectedBudgetIds.has(b.id))}
                                                onChange={() => { }} // Controlled by onClick on parent for better hit area
                                            />
                                        </div>
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
                                            <div
                                                key={b.id}
                                                className={`p-3 pl-12 flex items-center justify-between group/item hover:bg-gray-800/20 transition-colors ${selectedBudgetIds.has(b.id) ? 'bg-primary/5' : ''}`}
                                            >
                                                <div className="flex items-center gap-3 mr-4" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        className="rounded bg-gray-800 border-gray-700 text-primary focus:ring-0 cursor-pointer"
                                                        checked={selectedBudgetIds.has(b.id)}
                                                        onChange={() => handleSelect(b.id)}
                                                    />
                                                </div>
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

            {/* Clone Modal */}
            {isCloneModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Clone Budget</h2>
                            <button onClick={() => setIsCloneModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-400">Select a month to copy the budget entries from. This will add or update entries in the current month.</p>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Source Month</label>
                                <input
                                    type="month"
                                    value={cloneSourceMonth}
                                    onChange={(e) => setCloneSourceMonth(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                        </div>
                        <div className="p-6 bg-gray-800/30 flex gap-3">
                            <button
                                onClick={() => setIsCloneModalOpen(false)}
                                className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-all border border-transparent"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClone}
                                disabled={!cloneSourceMonth || syncing}
                                className="flex-1 py-3 px-4 bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-primary rounded-xl font-bold text-white shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-2"
                            >
                                {syncing ? <RefreshCw size={18} className="animate-spin" /> : <Copy size={18} />}
                                Clone Budget
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

