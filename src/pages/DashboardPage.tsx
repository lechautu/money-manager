import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { StatisticsService } from '../services/StatisticsService';
import { AccountService } from '../services/AccountService';
import { TransactionService } from '../services/TransactionService';
import { BudgetService } from '../services/BudgetService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Components
import NetCashflowCard from '../components/dashboard/NetCashflowCard';
import PendingSummaryCard from '../components/dashboard/PendingSummaryCard';
import BudgetStatusCard from '../components/dashboard/BudgetStatusCard';
import AccountLiquidityList from '../components/dashboard/AccountLiquidityList';
import UpcomingPaymentsList from '../components/dashboard/UpcomingPaymentsList';
import CashflowTrendChart from '../components/dashboard/CashflowTrendChart';

export function DashboardPage() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>({ income: 0, expense: 0, balances: [] });
    const [expenseCategoryData, setExpenseCategoryData] = useState<any[]>([]);
    const [cashflowTrend, setCashflowTrend] = useState<any[]>([]);
    const [pendingSummary, setPendingSummary] = useState<any>({ count: 0, total_amount: 0 });
    const [budgetSummary, setBudgetSummary] = useState<any>({ totalBudget: 0, totalSpent: 0 });
    const [upcomingPayments, setUpcomingPayments] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, [currentMonth]);

    const loadData = async () => {
        setLoading(true);
        const monthStr = format(currentMonth, 'yyyy-MM');
        const startDateStr = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const endDateStr = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

        try {
            const [
                stats,
                expenseStructure,
                trend,
                pending,
                upcoming,
                budget,
                allAccounts,
                allBalances
            ] = await Promise.all([
                StatisticsService.getDashboardSummary(monthStr),
                StatisticsService.getExpenseByCategory(monthStr),
                StatisticsService.getCashflowTrend(startDateStr, endDateStr),
                StatisticsService.getPendingSummary(),
                StatisticsService.getUpcomingPayments(30),
                BudgetService.getMonthSummary(monthStr),
                AccountService.getAll(),
                TransactionService.getBalances()
            ]);

            setSummary(stats);
            setExpenseCategoryData(expenseStructure);
            setCashflowTrend(trend);
            setPendingSummary(pending);
            setUpcomingPayments(upcoming);
            setBudgetSummary(budget);

            // Merge accounts with balances
            const liquidityAccounts = allAccounts.map(acc => ({
                ...acc,
                balance: allBalances[acc.id] || { posted: 0, effective: 0 }
            }));
            setAccounts(liquidityAccounts);

        } catch (error) {
            console.error("Failed to load dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMonthChange = (direction: 'prev' | 'next') => {
        setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
    };

    // Colors for Pie Chart
    const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

    const topExpenses = useMemo(() => {
        if (!expenseCategoryData || expenseCategoryData.length === 0) return [];
        const sorted = [...expenseCategoryData].sort((a, b) => b.value - a.value);
        const top5 = sorted.slice(0, 5);
        const others = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);

        if (others > 0) {
            return [...top5, { name: 'Others', value: others, color: '#9CA3AF' }];
        }
        return top5;
    }, [expenseCategoryData]);

    const formatMoney = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(amount);

    if (loading) {
        return <div className="flex h-96 items-center justify-center text-gray-500">Loading dashboard...</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Month Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
                    <p className="text-sm text-gray-500">Financial overview for {format(currentMonth, 'MMMM yyyy')}</p>
                </div>

                <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-1">
                    <button onClick={() => handleMonthChange('prev')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-500 transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="px-4 font-medium text-gray-700 dark:text-gray-200 min-w-[140px] text-center">
                        {format(currentMonth, 'MMMM yyyy')}
                    </span>
                    <button onClick={() => handleMonthChange('next')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-500 transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Top Stats Row - Full Width */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <NetCashflowCard income={summary.income} expense={summary.expense} />
                <BudgetStatusCard totalBudget={budgetSummary.totalBudget} totalSpent={budgetSummary.totalSpent} />
                <PendingSummaryCard count={pendingSummary.count} amount={pendingSummary.total_amount} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content Layout (Sidebar on right for desktop) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Cashflow Trend */}
                    <div className="h-[400px]">
                        <CashflowTrendChart data={cashflowTrend} />
                    </div>

                    {/* Expense Structure */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Expense Structure</h3>
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            {/* Pie Chart */}
                            <div className="w-full md:w-1/2 h-[300px] flex items-center justify-center relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={topExpenses}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {topExpenses.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            formatter={(value: number | undefined) => value !== undefined ? formatMoney(value) : ''}
                                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6', borderRadius: '8px' }}
                                            itemStyle={{ color: '#f3f4f6' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Center Text */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-xs text-gray-400 font-medium">Total Expense</span>
                                    <span className="text-xl font-bold text-gray-800 dark:text-white mt-1">
                                        {formatMoney(Math.abs(summary.expense))}
                                    </span>
                                </div>
                            </div>

                            {/* Detailed List */}
                            <div className="w-full md:w-1/2 space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {expenseCategoryData.map((item, index) => {
                                    const percent = Math.abs(summary.expense) > 0 ? (item.value / Math.abs(summary.expense)) * 100 : 0;
                                    return (
                                        <div key={index} className="group">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[180px]" title={item.name}>
                                                    {item.name}
                                                </span>
                                                <div className="text-right">
                                                    <span className="font-bold text-gray-800 dark:text-white block">
                                                        {formatMoney(item.value)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500 ease-out"
                                                        style={{
                                                            width: `${percent}%`,
                                                            backgroundColor: COLORS[index % COLORS.length]
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-500 w-10 text-right">{percent.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {expenseCategoryData.length === 0 && (
                                    <div className="text-center text-gray-500 py-8">No expenses this month</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column (Sidebar) */}
                <div className="space-y-6">
                    {/* Account Liquidity */}
                    <div>
                        <AccountLiquidityList accounts={accounts} />
                    </div>

                    {/* Upcoming Payments */}
                    <div className="h-[400px]">
                        <UpcomingPaymentsList payments={upcomingPayments} />
                    </div>
                </div>
            </div>
        </div>
    );
}
