import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, TrendingUp, Home, CreditCard, ShoppingCart,
    Briefcase, Info
} from 'lucide-react';
import { format, parseISO, isAfter, startOfMonth } from 'date-fns';
import { ForecastService } from '../services/ForecastService';
import type { ForecastDetailResult, ForecastDetailItem } from '../services/ForecastService';

export default function ForecastDetailPage() {
    const { month } = useParams<{ month: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<ForecastDetailResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (month) {
            loadData(month);
        }
    }, [month]);

    const loadData = async (m: string) => {
        setLoading(true);
        try {
            const result = await ForecastService.getForecastDetails(m);
            setData(result);
        } catch (error) {
            console.error('Failed to load forecast details', error);
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
    };

    const renderBadge = (item: ForecastDetailItem) => {
        if (item.type === 'recurring') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 mt-1">
                    Recurring
                </span>
            );
        }
        if (item.type === 'installment') {
            return (
                <div className="flex gap-2 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                        Installment
                    </span>
                    {item.meta && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 self-center">
                            Month {item.meta.current}/{item.meta.total}
                        </span>
                    )}
                </div>
            );
        }
        if (item.type === 'manual') {
            const statusColor = item.status === 'posted'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
            return (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${statusColor} mt-1`}>
                    {item.status === 'posted' ? 'Posted' : 'Pending'}
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 mt-1">
                Estimated
            </span>
        );
    };

    const groupByCategory = (items: ForecastDetailItem[]) => {
        const groups: Record<string, { total: number, items: ForecastDetailItem[] }> = {};
        for (const item of items) {
            const cat = item.categoryName || 'Uncategorized';
            if (!groups[cat]) groups[cat] = { total: 0, items: [] };
            groups[cat].items.push(item);
            groups[cat].total += item.amount;
        }
        return groups;
    };

    const getCategoryIcon = (categoryName: string) => {
        const lower = categoryName.toLowerCase();
        if (lower.includes('salary') || lower.includes('income') || lower.includes('wage')) return <Briefcase size={20} />;
        if (lower.includes('invest')) return <TrendingUp size={20} />;
        if (lower.includes('home') || lower.includes('house') || lower.includes('rent') || lower.includes('util')) return <Home size={20} />;
        if (lower.includes('debt') || lower.includes('loan') || lower.includes('credit')) return <CreditCard size={20} />;
        if (lower.includes('shop') || lower.includes('food') || lower.includes('grocer')) return <ShoppingCart size={20} />;
        return <Info size={20} />;
    };

    if (loading || !data) {
        return (
            <div className="flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    const netChange = data.income.total - data.expense.total;
    const isFuture = isAfter(parseISO(data.month + '-01'), startOfMonth(new Date()));

    // Group items
    const incomeGroups = groupByCategory(data.income.items);
    const expenseGroups = groupByCategory(data.expense.items);

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12">
            {/* Header / Nav */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/forecast')}
                    className="flex items-center text-sm font-medium text-gray-500 hover:text-primary transition-colors group"
                >
                    <ArrowLeft className="mr-1 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Forecast
                </button>
                <div className="text-xs text-gray-500 italic">
                    * All amounts in VND
                </div>
            </div>

            {/* Summary Card */}
            <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        {format(parseISO(data.month + '-01'), 'MMMM yyyy')}
                        {isFuture && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-800/50">
                                Future Projection
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">Detailed breakdown of expected cash flow.</p>
                </div>
                <div className="flex items-center gap-8 border-t md:border-t-0 md:border-l border-gray-800 pt-4 md:pt-0 md:pl-8 mt-2 md:mt-0">
                    <div className="text-right">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Net Change</p>
                        <p className={`text-2xl font-bold ${netChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {netChange > 0 ? '+' : ''}{formatMoney(netChange)}
                        </p>
                    </div>
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Projected Balance</p>
                        <p className="text-xl font-semibold text-white">{formatMoney(data.closingBalance)}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Income Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <span className="w-2 h-6 rounded-full bg-emerald-500"></span>
                            Projected Income
                        </h2>
                        <span className="text-emerald-500 font-bold text-lg">+{formatMoney(data.income.total)}</span>
                    </div>

                    {Object.keys(incomeGroups).length === 0 && (
                        <div className="text-center py-8 text-gray-500 bg-gray-900 rounded-lg border border-gray-800">No income sources found for this month.</div>
                    )}

                    {Object.entries(incomeGroups).map(([catName, group]) => (
                        <div key={catName} className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden transition-all hover:border-emerald-500/30 hover:shadow-md">
                            <div className="px-5 py-4 bg-gray-950/30 flex justify-between items-center border-b border-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-900/20 rounded-lg text-emerald-500">
                                        {getCategoryIcon(catName)}
                                    </div>
                                    <span className="font-medium text-white">{catName}</span>
                                </div>
                                <span className="font-bold text-emerald-500">+{formatMoney(group.total)}</span>
                            </div>
                            <div className="divide-y divide-gray-800">
                                {group.items.map(item => (
                                    <div key={item.id} className="px-5 py-3 flex justify-between items-center hover:bg-gray-800/50 transition-colors">
                                        <div>
                                            <p className="text-sm font-medium text-gray-200">{item.name}</p>
                                            {renderBadge(item)}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-semibold text-white block">{formatMoney(item.amount)}</span>
                                            <span className="text-xs text-gray-500">{format(parseISO(item.date), 'dd MMM')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Expense Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <span className="w-2 h-6 rounded-full bg-red-500"></span>
                            Projected Expenses
                        </h2>
                        <span className="text-red-500 font-bold text-lg">-{formatMoney(data.expense.total)}</span>
                    </div>

                    {Object.keys(expenseGroups).length === 0 && (
                        <div className="text-center py-8 text-gray-500 bg-gray-900 rounded-lg border border-gray-800">No expenses projected for this month.</div>
                    )}

                    {Object.entries(expenseGroups).map(([catName, group]) => (
                        <div key={catName} className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden transition-all hover:border-red-500/30 hover:shadow-md">
                            <div className="px-5 py-4 bg-gray-950/30 flex justify-between items-center border-b border-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-900/20 rounded-lg text-red-500">
                                        {getCategoryIcon(catName)}
                                    </div>
                                    <span className="font-medium text-white">{catName}</span>
                                </div>
                                <span className="font-bold text-red-500">-{formatMoney(group.total)}</span>
                            </div>
                            <div className="divide-y divide-gray-800">
                                {group.items.map(item => (
                                    <div key={item.id} className="px-5 py-3 flex justify-between items-center hover:bg-gray-800/50 transition-colors">
                                        <div>
                                            <p className="text-sm font-medium text-gray-200">{item.name}</p>
                                            {renderBadge(item)}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-semibold text-white block">{formatMoney(item.amount)}</span>
                                            <span className="text-xs text-gray-500">{format(parseISO(item.date), 'dd MMM')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Disclaimer Info */}
            <div className="rounded-md bg-blue-900/20 p-4 border border-blue-800/30">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <Info className="text-blue-400 h-5 w-5" />
                    </div>
                    <div className="ml-3 flex-1 md:flex md:justify-between">
                        <p className="text-sm text-blue-300">
                            Projections are based on your recurring transactions and active installment plans.
                            Actual results may vary based on discretionary spending.
                        </p>
                        <p className="mt-3 text-sm md:mt-0 md:ml-6">
                            <button onClick={() => navigate('/recurring')} className="whitespace-nowrap font-medium text-blue-300 hover:text-blue-200">
                                Edit Recurring Settings <span aria-hidden="true">&rarr;</span>
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
