import { AlertOctagon } from 'lucide-react';

interface PendingSummaryCardProps {
    count: number;
    amount: number;
    currency?: string;
}

export default function PendingSummaryCard({ count, amount, currency = 'VND' }: PendingSummaryCardProps) {
    const formatMoney = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col justify-center h-full">
            <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-600 dark:text-amber-500">
                    <AlertOctagon size={24} />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500">Pending Summary</p>
                    <div className="flex flex-col">
                        <span className="text-base font-semibold text-amber-600 dark:text-amber-500">{count} Pending</span>
                        <span className="text-sm text-gray-500">Total {formatMoney(amount)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
