import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface CashflowTrendChartProps {
    data: any[];
}

export default function CashflowTrendChart({ data }: CashflowTrendChartProps) {
    const formatMoney = (amount: number) =>
        new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(amount);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-800 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Cashflow Trend (Last 30 Days)</h3>
                <div className="flex space-x-4 text-xs">
                    <div className="flex items-center"><span className="w-3 h-1 bg-emerald-500 rounded-full mr-2"></span> Income</div>
                    <div className="flex items-center"><span className="w-3 h-1 bg-red-500 rounded-full mr-2"></span> Expense</div>
                    <div className="flex items-center"><span className="w-3 h-1 bg-blue-500 rounded-full mr-2"></span> Net</div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(str) => str.slice(8, 10)}
                            stroke="#9CA3AF"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#9CA3AF"
                            fontSize={12}
                            tickFormatter={(value) => formatMoney(value)}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6', borderRadius: '8px' }}
                            itemStyle={{ color: '#f3f4f6' }}
                            labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        />
                        <Area
                            type="monotone"
                            dataKey="income"
                            stroke="#10B981"
                            fillOpacity={1}
                            fill="url(#colorIncome)"
                            strokeWidth={2}
                        />
                        <Area
                            type="monotone"
                            dataKey="expense"
                            stroke="#EF4444"
                            fillOpacity={0}
                            fill="transparent"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                        />
                        <Area
                            type="monotone"
                            dataKey="net"
                            stroke="#3B82F6"
                            fillOpacity={0}
                            fill="transparent"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
