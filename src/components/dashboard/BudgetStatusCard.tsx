import { PieChart } from 'lucide-react';

interface BudgetStatusCardProps {
    totalBudget: number;
    totalSpent: number;
    currency?: string;
}

export default function BudgetStatusCard({ totalBudget, totalSpent, currency = 'VND' }: BudgetStatusCardProps) {
    const formatMoney = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

    const percent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const remaining = totalBudget - totalSpent;
    const isOverBudget = remaining < 0;

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col justify-between h-full">
            <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <PieChart size={20} />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Monthly Budget</p>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Spent / Budget</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-white">
                            {formatMoney(totalSpent)} <span className="text-gray-400 font-normal">/ {formatMoney(totalBudget)}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">{isOverBudget ? 'Over Spent' : 'Remaining'}</p>
                        <p className={`text-sm font-bold ${isOverBudget ? 'text-red-500' : 'text-emerald-500'}`}>
                            {formatMoney(Math.abs(remaining))}
                        </p>
                    </div>
                </div>

                <div className="relative pt-1">
                    <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-100 dark:bg-gray-700">
                        <div
                            style={{ width: `${Math.min(percent, 100)}%` }}
                            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${isOverBudget ? 'bg-red-500' : 'bg-purple-500'}`}
                        ></div>
                    </div>
                    <p className="text-xs text-right mt-1 text-gray-500">{percent.toFixed(1)}%</p>
                </div>
            </div>
        </div>
    );
}
