import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart as LucideLineChart, ChevronDown, Check } from 'lucide-react';
import { formatMonthYear, formatShortMonthYear } from '../utils/dateUtils';
import { ForecastService } from '../services/ForecastService';
import type { ForecastPoint } from '../services/ForecastService';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function ForecastPage() {
    const [data, setData] = useState<ForecastPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [months, setMonths] = useState(12);
    const [customMonths, setCustomMonths] = useState('12');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    useEffect(() => {
        loadData(months);
    }, [months]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadData = async (m: number) => {
        setLoading(true);
        const points = await ForecastService.getForecast(m);
        setData(points);
        setLoading(false);
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCustomMonths(e.target.value);
    };

    const handleApplyCustom = (e: React.FormEvent) => {
        e.preventDefault();
        const val = parseInt(customMonths);
        if (!isNaN(val) && val > 0 && val <= 60) {
            setMonths(val);
            setIsDropdownOpen(false);
        }
    };

    const options = [3, 6, 9, 12];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <LucideLineChart className="text-primary" /> Forecast
                </h1>

                {/* Range Selector Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-2 bg-gray-900 border border-gray-800 hover:border-gray-700 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all shadow-sm"
                    >
                        <span>Next {months} Months</span>
                        <ChevronDown size={16} className={`text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="py-1">
                                {options.map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => {
                                            setMonths(option);
                                            setCustomMonths(option.toString());
                                            setIsDropdownOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-300 hover:bg-primary/10 hover:text-primary transition-colors text-left"
                                    >
                                        Next {option} Months
                                        {months === option && <Check size={14} />}
                                    </button>
                                ))}
                            </div>
                            <div className="border-t border-gray-800 p-3 bg-gray-950/50">
                                <p className="text-[10px] text-gray-500 uppercase font-semibold mb-2 px-1">Custom Range</p>
                                <form onSubmit={handleApplyCustom} className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="number"
                                            value={customMonths}
                                            onChange={handleCustomChange}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition-colors pr-6"
                                            min="1"
                                            max="60"
                                            placeholder="Mo"
                                        />
                                        <span className="absolute right-2 top-2 text-[10px] text-gray-500 pointer-events-none">M</span>
                                    </div>
                                    <button
                                        type="submit"
                                        className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-md hover:bg-primary-dark transition-colors"
                                    >
                                        Set
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    {months} Month Financial Projection
                    <span className="text-xs font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                        Until {data.length > 0 ? formatMonthYear(data[data.length - 1].month) : '...'}
                    </span>
                </h2>
                <div className="h-[400px] w-full">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-gray-500">
                            <div className="animate-pulse flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                Calculating Projection...
                            </div>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis
                                    dataKey="month"
                                    stroke="#9CA3AF"
                                    fontSize={10}
                                    tickFormatter={(val) => formatShortMonthYear(val)}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                    tickFormatter={(val) => {
                                        if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                                        if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                                        return val;
                                    }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6', borderRadius: '8px' }}
                                    formatter={(value: any) => formatMoney(Number(value) || 0)}
                                    labelFormatter={(label) => formatMonthYear(label)}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <Line type="monotone" dataKey="projectedBalance" name="Projected Balance" stroke="#3B82F6" strokeWidth={2} dot={months <= 12 ? { r: 4 } : false} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="income" name="Est. Income" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                <Line type="monotone" dataKey="expense" name="Est. Expense" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Monthly Breakdown</h2>
                    <span className="text-xs text-gray-500 italic">* All amounts in VND</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-3 font-semibold">Month</th>
                                <th className="px-6 py-3 font-semibold text-right">Income</th>
                                <th className="px-6 py-3 font-semibold text-right">Expense</th>
                                <th className="px-6 py-3 font-semibold text-right">Net Change</th>
                                <th className="px-6 py-3 font-semibold text-right">Projected Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading projection data...</td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No projection data available</td>
                                </tr>
                            ) : (
                                data.map((point) => {
                                    const netChange = point.income - point.expense;
                                    return (
                                        <tr
                                            key={point.month}
                                            className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                                            onClick={() => navigate(`/forecast/${point.month}`)}
                                        >
                                            <td className="px-6 py-4 text-sm font-medium text-white whitespace-nowrap">
                                                {formatMonthYear(point.month)}
                                                {point.month === new Date().toISOString().slice(0, 7) && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] rounded uppercase">Current</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-emerald-400 text-right whitespace-nowrap font-mono">
                                                {point.income > 0 ? `+${formatMoney(point.income)}` : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-red-400 text-right whitespace-nowrap font-mono">
                                                {point.expense > 0 ? `-${formatMoney(point.expense)}` : '—'}
                                            </td>
                                            <td className={`px-6 py-4 text-sm text-right whitespace-nowrap font-mono font-medium ${netChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {netChange > 0 ? '+' : ''}{formatMoney(netChange)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-white font-bold text-right whitespace-nowrap font-mono">
                                                {formatMoney(point.projectedBalance)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
