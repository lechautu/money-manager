import { useState, useEffect } from 'react';
import { StatisticsService } from '../services/StatisticsService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { ArrowUp, ArrowDown, Wallet } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function DashboardPage() {
    const [summary, setSummary] = useState<any>(null);
    const [recentTxs, setRecentTxs] = useState<any[]>([]);
    const [expenseByCat, setExpenseByCat] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

    useEffect(() => {
        loadData();
    }, [month]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sum, recents, cats] = await Promise.all([
                StatisticsService.getDashboardSummary(month),
                StatisticsService.getRecentTransactions(5),
                StatisticsService.getExpenseByCategory(month)
            ]);
            setSummary(sum);
            setRecentTxs(recents);
            setExpenseByCat(cats);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (amount: number, currency: string = 'VND') => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <input
                    type="month"
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none"
                />
            </div>

            {/* Balances & Month Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Net Worth / Balances */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:col-span-1">
                    <h2 className="text-sm text-gray-400 font-medium mb-3 flex items-center gap-2">
                        <Wallet size={16} /> Total Balance
                    </h2>
                    <div className="space-y-2">
                        {summary?.balances.map((b: any) => (
                            <div key={b.currency} className="flex justify-between items-baseline">
                                <span className="text-xs text-gray-500">{b.currency}</span>
                                <span className="text-xl font-bold text-white">{formatMoney(b.balance, b.currency)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Income */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <h2 className="text-sm text-gray-400 font-medium mb-1 flex items-center gap-2">
                        <ArrowUp size={16} className="text-green-500" /> Income
                    </h2>
                    <div className="text-2xl font-bold text-green-500 mt-2">
                        {formatMoney(summary?.income, 'VND')}
                        <span className="text-xs text-gray-500 font-normal ml-2">(Est. Base)</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">This month</p>
                </div>

                {/* Expense */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <h2 className="text-sm text-gray-400 font-medium mb-1 flex items-center gap-2">
                        <ArrowDown size={16} className="text-red-500" /> Expense
                    </h2>
                    <div className="text-2xl font-bold text-white mt-2">
                        {formatMoney(Math.abs(summary?.expense), 'VND')}
                        <span className="text-xs text-gray-500 font-normal ml-2">(Est. Base)</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">This month</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expense Chart */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 min-h-[300px]">
                    <h2 className="text-lg font-semibold mb-4">Expense Structure</h2>
                    {expenseByCat.length > 0 ? (
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={expenseByCat}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {expenseByCat.map((_entry: unknown, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(value: number | undefined) => value !== undefined ? formatMoney(value) : '0'}
                                        contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                                        itemStyle={{ color: '#f3f4f6' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            No expense data for this month
                        </div>
                    )}
                </div>

                {/* Recent Transactions */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
                    <div className="space-y-3">
                        {recentTxs.map((tx: any) => (
                            <div key={tx.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0 hover:bg-gray-800/30 px-2 rounded -mx-2">
                                <div>
                                    <div className="font-medium text-white">{tx.category_name}</div>
                                    <div className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString('vi-VN')} • {tx.note || 'No note'}</div>
                                </div>
                                <div className={`font-medium ${tx.amount < 0 ? 'text-white' : 'text-green-400'}`}>
                                    {tx.amount < 0 ? '-' : '+'}{formatMoney(Math.abs(tx.amount), tx.currency)}
                                </div>
                            </div>
                        ))}
                        {recentTxs.length === 0 && <div className="text-gray-500 text-sm">No recent transactions</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}
