import { format, parseISO, differenceInDays } from 'date-fns';
import { Home, Zap, Shield, GraduationCap, Wifi, CreditCard, Calendar } from 'lucide-react';

interface UpcomingPaymentsListProps {
    payments: any[];
}

export default function UpcomingPaymentsList({ payments }: UpcomingPaymentsListProps) {
    const formatMoney = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(amount);

    const getIcon = (categoryName: string) => {
        // Simple mapping based on name or default
        const name = (categoryName || '').toLowerCase();
        if (name.includes('rent') || name.includes('home')) return <Home size={18} className="text-rose-500" />;
        if (name.includes('util') || name.includes('electr')) return <Zap size={18} className="text-amber-500" />;
        if (name.includes('insur')) return <Shield size={18} className="text-blue-500" />;
        if (name.includes('educ') || name.includes('school')) return <GraduationCap size={18} className="text-purple-500" />;
        if (name.includes('net') || name.includes('wifi')) return <Wifi size={18} className="text-cyan-500" />;
        return <CreditCard size={18} className="text-gray-500" />;
    };

    const getColor = (categoryName: string) => {
        const name = (categoryName || '').toLowerCase();
        if (name.includes('rent') || name.includes('home')) return 'bg-rose-500';
        if (name.includes('util') || name.includes('electr')) return 'bg-amber-500';
        if (name.includes('insur')) return 'bg-blue-500';
        if (name.includes('educ') || name.includes('school')) return 'bg-purple-500';
        if (name.includes('net') || name.includes('wifi')) return 'bg-cyan-500';
        return 'bg-gray-500';
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Upcoming Payments (Next 30 Days)</h3>
                <Calendar className="text-gray-400" size={20} />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[300px] custom-scrollbar">
                {payments.length > 0 ? (
                    payments.map((payment, index) => {
                        const date = parseISO(payment.date);
                        const dayDiff = differenceInDays(date, new Date());
                        const isToday = dayDiff === 0;
                        const isTomorrow = dayDiff === 1;
                        let dateText = format(date, 'MMM d');
                        if (isToday) dateText = 'Today';
                        if (isTomorrow) dateText = 'Tomorrow';

                        return (
                            <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    {getIcon(payment.category_name || payment.name)}
                                    <div>
                                        <span className="text-sm font-bold text-gray-800 dark:text-white mr-2">{dateText}:</span>
                                        <span className="text-sm text-gray-500">{payment.name}</span>
                                        <span className="text-sm text-gray-500 ml-1">({formatMoney(payment.amount)})</span>
                                    </div>
                                </div>
                                <div className={`w-2 h-2 rounded-full ${getColor(payment.category_name || payment.name)}`}></div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center text-gray-500 py-8">No upcoming payments found</div>
                )}
            </div>
        </div>
    );
}
