import { useState, useEffect, useMemo } from 'react';
import { format, subMonths, startOfMonth, endOfMonth, subYears } from 'date-fns';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { Filter, TrendingUp, TrendingDown } from 'lucide-react';
import { StatisticsService } from '../services/StatisticsService';
import { AccountService } from '../services/AccountService';
import { useNavigate } from 'react-router-dom';
import { formatMonthYear, formatShortMonthYear } from '../utils/dateUtils';

type RangeOption = 'this_month' | '3m' | '6m' | '12m' | 'custom';
type CompareMode = 'previous_period' | 'yoy';
type TrendMetric = 'expense' | 'income' | 'net';

export default function TrendsPage() {
    const navigate = useNavigate();
    const [range, setRange] = useState<RangeOption>('3m');
    const [compareEnabled, setCompareEnabled] = useState(false);
    const [compareMode, setCompareMode] = useState<CompareMode>('previous_period');
    const [metric, setMetric] = useState<TrendMetric>('expense');

    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

    // Custom Date Range (Placeholder for now, or simple inputs)
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const [trendsData, setTrendsData] = useState<any[]>([]);
    const [movers, setMovers] = useState<{ increased: any[], decreased: any[] }>({ increased: [], decreased: [] });
    const [kpi, setKpi] = useState({ expense: 0, income: 0, net: 0, prevExpense: 0, prevIncome: 0, prevNet: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        AccountService.getAll().then(setAccounts);
    }, []);

    // Calculate Dates based on Range
    const { startDate, endDate, compareStartDate, compareEndDate } = useMemo(() => {
        const now = new Date();
        let start = startOfMonth(now);
        let end = endOfMonth(now);

        if (range === 'this_month') {
            // start/end already set to this month
        } else if (range === '3m') {
            start = startOfMonth(subMonths(now, 2)); // Current + 2 prev = 3 months
        } else if (range === '6m') {
            start = startOfMonth(subMonths(now, 5));
        } else if (range === '12m') {
            start = startOfMonth(subMonths(now, 11));
        } else if (range === 'custom') {
            if (customStart) start = startOfMonth(new Date(customStart));
            if (customEnd) end = endOfMonth(new Date(customEnd));
        }

        let compStart = start;
        let compEnd = end;

        if (compareEnabled) {
            if (compareMode === 'yoy') {
                compStart = subYears(start, 1);
                compEnd = subYears(end, 1);
            } else {
                // Previous Period
                // Calculate duration in months
                const durationMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
                compStart = subMonths(start, durationMonths);
                compEnd = subMonths(end, durationMonths);
            }
        }

        return {
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd'),
            compareStartDate: format(compStart, 'yyyy-MM-dd'),
            compareEndDate: format(compEnd, 'yyyy-MM-dd')
        };
    }, [range, compareEnabled, compareMode, customStart, customEnd]);

    useEffect(() => {
        loadData();
    }, [startDate, endDate, compareStartDate, compareEndDate, selectedAccounts, compareEnabled]);

    const loadData = async () => {
        setLoading(true);
        try {
            const startMonth = startDate.slice(0, 7);
            const endMonth = endDate.slice(0, 7);
            const compStartMonth = compareStartDate.slice(0, 7);
            const compEndMonth = compareEndDate.slice(0, 7);

            const filters = { accountIds: selectedAccounts.length > 0 ? selectedAccounts : undefined };
            const moversFilters = { ...filters, type: 'expense' as const };

            const [currentTrends, prevTrends, moversData] = await Promise.all([
                StatisticsService.getMonthlyTrends(startMonth, endMonth, filters),
                compareEnabled ? StatisticsService.getMonthlyTrends(compStartMonth, compEndMonth, filters) : Promise.resolve([]),
                compareEnabled ? StatisticsService.getCategoryMovers(startMonth, endMonth, compStartMonth, compEndMonth, moversFilters) : Promise.resolve({ increased: [], decreased: [] })
            ]) as [any[], any[], { increased: any[], decreased: any[] }];

            setTrendsData(currentTrends);

            const sum = (arr: any[], key: string) => arr.reduce((acc, item) => acc + item[key], 0);

            const currExp = sum(currentTrends, 'expense');
            const currInc = sum(currentTrends, 'income');
            const currNet = sum(currentTrends, 'net');

            const prevExp = sum(prevTrends, 'expense');
            const prevInc = sum(prevTrends, 'income');
            const prevNet = sum(prevTrends, 'net');

            setKpi({
                expense: currExp, income: currInc, net: currNet,
                prevExpense: prevExp, prevIncome: prevInc, prevNet: prevNet
            });

            setMovers(moversData);

        } catch (e) {
            console.error("Failed to load trends", e);
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Math.abs(amount));
    };

    const renderDelta = (current: number, previous: number, inverse: boolean = false) => {
        if (!compareEnabled) return null;
        const delta = current - previous;
        if (previous === 0) return <span className="text-gray-500 text-xs ml-1">—</span>;

        const percent = (delta / previous) * 100;
        const isPositive = delta > 0;

        // For Expense: Increase is "Bad" (Red), Decrease is "Good" (Green)
        // For Income/Net: Increase is "Good" (Green), Decrease is "Bad" (Red)
        // inverse = true for Expense

        let colorClass = isPositive ? 'text-emerald-500' : 'text-red-500';
        if (inverse) {
            colorClass = isPositive ? 'text-red-500' : 'text-emerald-500';
        }

        const Icon = isPositive ? TrendingUp : TrendingDown;

        return (
            <div className={`flex items-center text-xs ${colorClass} mt-1`}>
                <Icon size={12} className="mr-1" />
                <span>{Math.abs(percent).toFixed(1)}%</span>
                <span className="opacity-70 ml-1">({formatMoney(Math.abs(delta))})</span>
            </div>
        );
    };

    const handleMoverClick = (item: any) => {
        const params = new URLSearchParams();
        params.set('startDate', startDate);
        params.set('endDate', endDate);
        params.set('categoryId', item.id);
        if (item.subCategoryId) {
            params.set('subCategoryId', item.subCategoryId);
        }
        if (selectedAccounts.length > 0) {
            // TransactionList only supports single account filter in UI currently
            // But we can verify if it supports multiple via 'accountIds'? 
            // Implementation plan says "Account = selected".
            // TransactionService.getAll supports multiple via our update? 
            // Wait, we updated TransactionService.getAll to take 'accountId' (singular) in Filter type?
            // Let's check TransactionService.ts again.
            // It has 'accountId?: string'.
            // So we can only filter by one account for now.
            if (selectedAccounts.length === 1) {
                params.set('accountId', selectedAccounts[0]);
            }
        }
        navigate(`/transactions?${params.toString()}`);
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header Controls */}
            <div className="flex flex-col gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800 sticky top-0 z-10 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <TrendingUp className="text-primary" /> Trends
                    </h1>

                    {/* Range Selector */}
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="flex bg-gray-800 rounded-lg p-1 overflow-x-auto">
                            {(['this_month', '3m', '6m', '12m', 'custom'] as RangeOption[]).map(r => (
                                <button
                                    key={r}
                                    onClick={() => setRange(r)}
                                    className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${range === r ? 'bg-primary text-white font-medium' : 'text-gray-400 hover:text-white'}`}
                                >
                                    {r === 'this_month' ? 'This Month' : r === 'custom' ? 'Custom' : r.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        {range === 'custom' && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={e => setCustomStart(e.target.value)}
                                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                />
                                <span className="text-gray-500">-</span>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={e => setCustomEnd(e.target.value)}
                                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Compare Toggle */}
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
                        <input
                            type="checkbox"
                            checked={compareEnabled}
                            onChange={e => setCompareEnabled(e.target.checked)}
                            className="rounded bg-gray-700 border-gray-600 text-primary focus:ring-0"
                        />
                        <span>Compare</span>
                    </label>

                    {compareEnabled && (
                        <div className="flex bg-gray-800 rounded-lg p-1">
                            <button
                                onClick={() => setCompareMode('previous_period')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${compareMode === 'previous_period' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCompareMode('yoy')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${compareMode === 'yoy' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                            >
                                YoY
                            </button>
                        </div>
                    )}

                    {/* Account Filter */}
                    <div className="relative">
                        <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-xs text-white">
                            <Filter size={12} />
                            <select
                                value={selectedAccounts[0] || ''}
                                onChange={e => {
                                    const val = e.target.value;
                                    setSelectedAccounts(val ? [val] : []);
                                }}
                                className="bg-transparent border-none p-0 text-white focus:ring-0 cursor-pointer text-xs w-24"
                            >
                                <option value="" className="bg-gray-800">All Accounts</option>
                                {Object.values(accounts).map((acc: any) => (
                                    <option key={acc.id} value={acc.id} className="bg-gray-800">{acc.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <>
                    {/* KPI Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className={`p-4 rounded-xl border ${metric === 'expense' ? 'bg-gray-800 border-primary/50 ring-1 ring-primary/50' : 'bg-gray-900 border-gray-800'} cursor-pointer transition-all`} onClick={() => setMetric('expense')}>
                            <div className="text-gray-400 text-sm mb-1">Total Expense</div>
                            <div className="text-2xl font-bold text-white">{formatMoney(kpi.expense)}</div>
                            {renderDelta(kpi.expense, kpi.prevExpense, true)}
                        </div>
                        <div className={`p-4 rounded-xl border ${metric === 'income' ? 'bg-gray-800 border-primary/50 ring-1 ring-primary/50' : 'bg-gray-900 border-gray-800'} cursor-pointer transition-all`} onClick={() => setMetric('income')}>
                            <div className="text-gray-400 text-sm mb-1">Total Income</div>
                            <div className="text-2xl font-bold text-emerald-500">{formatMoney(kpi.income)}</div>
                            {renderDelta(kpi.income, kpi.prevIncome, false)}
                        </div>
                        <div className={`p-4 rounded-xl border ${metric === 'net' ? 'bg-gray-800 border-primary/50 ring-1 ring-primary/50' : 'bg-gray-900 border-gray-800'} cursor-pointer transition-all`} onClick={() => setMetric('net')}>
                            <div className="text-gray-400 text-sm mb-1">Net Income</div>
                            <div className={`text-2xl font-bold ${kpi.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatMoney(kpi.net)}</div>
                            {renderDelta(kpi.net, kpi.prevNet, false)}
                        </div>
                    </div>

                    {/* Chart Section */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-[300px]">
                        <h3 className="text-sm font-semibold text-gray-400 mb-4 capitalize">{metric} Trend</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendsData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={10} tickFormatter={(val) => formatShortMonthYear(val)} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={10} tickFormatter={(val) => `${val / 1000000}M`} tickLine={false} axisLine={false} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6', borderRadius: '8px' }}
                                    formatter={(value: any) => formatMoney(value)}
                                    labelFormatter={(label) => formatMonthYear(label)}
                                />
                                <Bar dataKey={metric} fill={metric === 'expense' ? '#EF4444' : metric === 'income' ? '#10B981' : '#3B82F6'} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Top Movers */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <TrendingUp size={20} className="text-primary" /> Top Movers
                            {!compareEnabled && <span className="text-xs font-normal text-gray-500 bg-gray-800 px-2 py-1 rounded ml-auto">Turn on Compare to see movers</span>}
                        </h3>

                        {compareEnabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Increased Spending (Actually 'decreased' delta, i.e. more negative) */}
                                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                                    <div className="bg-red-500/10 border-b border-red-500/20 p-3 text-red-500 font-bold text-sm">
                                        Increased Spending
                                    </div>
                                    <div className="divide-y divide-gray-800">
                                        {movers.decreased.length === 0 ? (
                                            <div className="p-4 text-center text-gray-500 text-sm">No significant increases</div>
                                        ) : (
                                            movers.decreased.map(item => (
                                                <div key={item.id} className="p-3 hover:bg-gray-800 cursor-pointer transition-colors" onClick={() => handleMoverClick(item)}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">{item.icon}</span>
                                                            <span className="text-sm font-medium text-white">{item.name}</span>
                                                        </div>
                                                        <span className="text-sm font-bold text-red-500">+{formatMoney(item.delta)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs text-gray-500">
                                                        <span>{formatMoney(item.current)} vs {formatMoney(item.compare)}</span>
                                                        <span className="bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded">+{Math.abs(item.percent || 0).toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Decreased Spending (Actually 'increased' delta, i.e. less negative/positive) */}
                                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                                    <div className="bg-emerald-500/10 border-b border-emerald-500/20 p-3 text-emerald-500 font-bold text-sm">
                                        Decreased Spending
                                    </div>
                                    <div className="divide-y divide-gray-800">
                                        {movers.increased.length === 0 ? (
                                            <div className="p-4 text-center text-gray-500 text-sm">No significant decreases</div>
                                        ) : (
                                            movers.increased.map(item => (
                                                <div key={item.id} className="p-3 hover:bg-gray-800 cursor-pointer transition-colors" onClick={() => handleMoverClick(item)}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">{item.icon}</span>
                                                            <span className="text-sm font-medium text-white">{item.name}</span>
                                                        </div>
                                                        <span className="text-sm font-bold text-emerald-500">-{formatMoney(item.delta)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs text-gray-500">
                                                        <span>{formatMoney(item.current)} vs {formatMoney(item.compare)}</span>
                                                        <span className="bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded">{Math.abs(item.percent || 0).toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

