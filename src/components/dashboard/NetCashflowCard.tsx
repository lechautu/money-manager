import { TrendingUp } from 'lucide-react';

interface NetCashflowCardProps {
    income: number;
    expense: number;
    currency?: string;
}

export default function NetCashflowCard({ income, expense, currency = 'VND' }: NetCashflowCardProps) {
    const net = income - Math.abs(expense);
    const formatMoney = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col justify-between h-full">
            <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <TrendingUp size={20} />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Monthly Performance</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p className="text-xs text-gray-500 mb-1">Total Income</p>
                    <p className="text-sm font-bold text-emerald-500">{formatMoney(income)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500 mb-1">Total Expense</p>
                    <p className="text-sm font-bold text-red-500">{formatMoney(Math.abs(expense))}</p>
                </div>
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 mb-1">Net Cashflow</p>
                <div className="flex items-baseline space-x-2">
                    <span className={`text-xl font-bold ${net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {net >= 0 ? '+' : ''}{formatMoney(net)}
                    </span>
                    {/* Placeholder for MoM */}
                    {/* <span className="text-xs bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-medium">+2.4% MoM</span> */}
                </div>
            </div>
        </div>
    );
}
