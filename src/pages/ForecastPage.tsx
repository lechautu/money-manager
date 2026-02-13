import { useState, useEffect } from 'react';
import { LineChart as LucideLineChart } from 'lucide-react';
import { ForecastService } from '../services/ForecastService';
import type { ForecastPoint } from '../services/ForecastService';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function ForecastPage() {
    const [data, setData] = useState<ForecastPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const points = await ForecastService.getForecast(12);
        setData(points);
        setLoading(false);
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <LucideLineChart className="text-primary" /> Forecast
                </h1>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-6">12 Month Projection</h2>
                <div className="h-[400px] w-full">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-gray-500">Calculating Projection...</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis
                                    dataKey="month"
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                    tickFormatter={(val) => val.slice(5)} // Show MM
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
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                                    formatter={(value: any) => formatMoney(Number(value) || 0)}
                                    labelFormatter={(label) => `Month: ${label}`}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="projectedBalance" name="Projected Balance" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="income" name="Est. Income" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                <Line type="monotone" dataKey="expense" name="Est. Expense" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
                <div className="mt-4 text-sm text-gray-500 text-center">
                    * Projection based on current balance, active recurring rules, and upcoming installments.
                </div>
            </div>
        </div>
    );
}
