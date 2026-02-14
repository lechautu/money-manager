import { useState } from 'react';
import { Wallet, Banknote, CreditCard, ChevronDown, ChevronRight } from 'lucide-react';

interface AccountLiquidityListProps {
    accounts: any[];
    onAccountClick?: (id: string) => void;
}

export default function AccountLiquidityList({ accounts, onAccountClick }: AccountLiquidityListProps) {
    const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});

    const formatMoney = (amount: number, currency: string) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

    const getIcon = (type: string) => {
        switch (type) {
            case 'bank': return <Banknote className="text-blue-400" size={18} />;
            case 'credit': return <CreditCard className="text-purple-400" size={18} />;
            default: return <Wallet className="text-emerald-400" size={18} />;
        }
    };

    // Group accounts by type
    const groupedAccounts = accounts.reduce((acc, account) => {
        if (!acc[account.type]) acc[account.type] = [];
        acc[account.type].push(account);
        return acc;
    }, {} as Record<string, any[]>);

    // Calculate totals per type per currency
    const getGroupTotals = (typeAccounts: any[]) => {
        const totals: Record<string, number> = {};
        typeAccounts.forEach(acc => {
            if (!totals[acc.currency]) totals[acc.currency] = 0;
            totals[acc.currency] += acc.balance.effective;
        });
        return totals;
    };

    const toggleExpand = (type: string) => {
        setExpandedTypes(prev => ({ ...prev, [type]: !prev[type] }));
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Account Liquidity</h3>
                <Wallet className="text-gray-400" size={20} />
            </div>

            <div className="flex flex-col space-y-3">
                {(Object.entries(groupedAccounts) as [string, any[]][]).map(([type, typeAccounts]) => {
                    const isExpanded = expandedTypes[type];
                    const totals = getGroupTotals(typeAccounts);

                    return (
                        <div key={type} className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                            {/* Group Header */}
                            <div
                                onClick={() => toggleExpand(type)}
                                className="bg-gray-50 dark:bg-gray-800/80 p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="p-1.5 bg-white dark:bg-gray-700 rounded-md shadow-sm">
                                        {getIcon(type)}
                                    </div>
                                    <span className="font-semibold text-gray-700 dark:text-gray-200 capitalize">{type}</span>
                                    <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                                        {typeAccounts.length}
                                    </span>
                                </div>

                                <div className="flex items-center space-x-3">
                                    <div className="text-right">
                                        {Object.entries(totals).map(([curr, amount]) => (
                                            <div key={curr} className={`text-sm font-bold ${amount >= 0 ? 'text-gray-800 dark:text-white' : 'text-red-500'}`}>
                                                {formatMoney(amount, curr)}
                                            </div>
                                        ))}
                                    </div>
                                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                                </div>
                            </div>

                            {/* Expanded List */}
                            {isExpanded && (
                                <div className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                                    {typeAccounts.map((acc: any) => (
                                        <div
                                            key={acc.id}
                                            onClick={() => onAccountClick?.(acc.id)}
                                            className="p-3 pl-12 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors"
                                        >
                                            <span className="text-sm text-gray-600 dark:text-gray-300">{acc.name}</span>
                                            <span className={`text-sm font-medium ${acc.balance.effective >= 0 ? 'text-gray-800 dark:text-white' : 'text-red-500'}`}>
                                                {formatMoney(acc.balance.effective, acc.currency)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {accounts.length === 0 && (
                    <div className="text-center text-gray-500 py-4">No accounts found</div>
                )}
            </div>
        </div>
    );
}
