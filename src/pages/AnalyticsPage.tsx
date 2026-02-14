import { useState, useEffect } from 'react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ChevronLeft, ChevronRight, BarChart3, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import { formatMonthYear, formatDisplayDate } from '../utils/dateUtils';
import { StatisticsService } from '../services/StatisticsService';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts';
import TrendsPage from './TrendsPage';

const COLORS = ['#0088FE', '#10B981', '#FFBB28', '#FF8042', '#8884d8', '#34D399', '#ffc658', '#8dd1e1'];

function AnalyticsOverview() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [dailyData, setDailyData] = useState<any[]>([]);
    const [categoryData, setCategoryData] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [currentMonth]);

    const loadData = async () => {
        setLoading(true);
        const monthStr = format(currentMonth, 'yyyy-MM');

        const [daily, cats] = await Promise.all([
            StatisticsService.getDailySpending(monthStr),
            StatisticsService.getExpenseByCategory(monthStr)
        ]);

        // Fill in missing days for the chart
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        const days = eachDayOfInterval({ start, end });

        const filledDaily = days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const found = daily.find((d: any) => d.date === dateStr);
            return {
                date: format(day, 'dd'),
                fullDate: dateStr,
                value: found ? found.value : 0
            };
        });

        setDailyData(filledDaily);
        setCategoryData(cats);
        setLoading(false);
    };

    const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
    const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));

    const totalExpense = categoryData.reduce((sum, item) => sum + item.value, 0);

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(amount);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-800">
                <h2 className="text-lg font-semibold text-gray-300">Monthly Overview</h2>
                <div className="flex items-center gap-4">
                    <button onClick={handlePrevMonth} className="text-gray-400 hover:text-white">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="font-semibold w-full px-2 text-center text-white capitalize">
                        {formatMonthYear(currentMonth)}
                    </span>
                    <button onClick={handleNextMonth} className="text-gray-400 hover:text-white">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Spending Trend */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        Spending Trend
                        <span className="text-xs font-normal text-gray-500 ml-auto">Daily Expenses</span>
                    </h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                    tickFormatter={(val) => `${val / 1000}k`}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6', borderRadius: '8px' }}
                                    formatter={(value: any) => [formatMoney(Number(value) || 0), 'Spending']}
                                    labelFormatter={(_label, payload) => {
                                        if (payload && payload[0]) {
                                            return formatDisplayDate(payload[0].payload.fullDate);
                                        }
                                        return '';
                                    }}
                                />
                                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Spending Structure */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        Spending Structure
                        <span className="text-xs font-normal text-gray-500 ml-auto">
                            Total: {formatMoney(totalExpense)}
                        </span>
                    </h2>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        {categoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {categoryData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6', borderRadius: '8px' }}
                                        formatter={(value: any) => formatMoney(Number(value) || 0)}
                                    />
                                    <Legend
                                        layout="vertical"
                                        verticalAlign="middle"
                                        align="right"
                                        formatter={(value) => (
                                            <span className="text-gray-300 text-sm ml-2">{value}</span>
                                        )}
                                    />
                                </RePieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-gray-500">No data for this month</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AnalyticsPage() {
    const [tab, setTab] = useState<'overview' | 'trends'>('overview');

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BarChart3 className="text-primary" /> Analytics
                </h1>

                <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
                    <button
                        onClick={() => setTab('overview')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === 'overview' ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    >
                        <PieChartIcon size={16} /> Overview
                    </button>
                    <button
                        onClick={() => setTab('trends')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === 'trends' ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    >
                        <TrendingUp size={16} /> Trends
                    </button>
                </div>
            </div>

            {tab === 'overview' ? <AnalyticsOverview /> : <TrendsPage />}
        </div>
    );
}
