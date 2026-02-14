import { useState, useEffect } from 'react';
import { TransactionService } from '../../services/TransactionService';
import type { Transaction } from '../../services/TransactionService';
import { Modal } from '../ui/Modal';
import { Search } from 'lucide-react';
import { AccountService } from '../../services/AccountService';
import { CategoryService } from '../../services/CategoryService';
import { formatDisplayDate } from '../../utils/dateUtils';

interface TransactionSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (tx: Transaction) => void;
    currentTransactionId?: string;
    filterAmount?: number;
    filterSource?: string;
    filterAccountId?: string;
}

export function TransactionSelector({ isOpen, onClose, onSelect, currentTransactionId, filterAmount, filterSource, filterAccountId }: TransactionSelectorProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [search, setSearch] = useState('');
    const [accMap, setAccMap] = useState<Record<string, string>>({});
    const [catMap, setCatMap] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, search]);

    const loadData = async () => {
        // Fetch candidates. 
        // Logic: Ideally we filter by amount similar to the installment amount if provided, 
        // but user might want to select any transaction.
        // Let's fetch recent transactions.

        const [txs, accs, cats] = await Promise.all([
            TransactionService.getAll({
                search: search || undefined,
                excludeSource: filterSource ? undefined : ['recurring'], // If filtering by specific source, don't exclude recurring by default (unless requested)
                source: filterSource,
                accountId: filterAccountId,
                excludeLinkedToInstallments: true,
                // If we are looking for transfer IN to credit account, amount should be > 0.
                // But let's leave that to the user or filter below?
                // Actually the user said "Link to transfer transaction". Usually that means the incoming part.
            }),
            AccountService.getAll(),
            CategoryService.getAll()
        ]);

        const aMap: Record<string, string> = {};
        accs.forEach(a => aMap[a.id] = a.name);
        setAccMap(aMap);

        const cMap: Record<string, string> = {};
        cats.forEach(c => cMap[c.id] = c.name);
        setCatMap(cMap);

        // Filter out transactions that are already linked to installments? 
        // This query doesn't check 'linked_transaction_id' in installment_payments table. 
        // We might want to pass 'excludeLinked' or check in SQL.
        // For now, let's just list them.

        // If strict filtering for installment payment:
        let filtered = txs;
        if (filterSource === 'transfer' && filterAccountId) {
            // We only want transfers INTO the account (Income, so amount > 0)
            filtered = txs.filter(t => t.amount > 0);
        }

        setTransactions(filtered);
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return formatDisplayDate(dateStr);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Link Transaction">
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 pl-9 text-sm text-white focus:outline-none focus:border-primary"
                    />
                </div>

                <div className="max-h-96 overflow-y-auto divide-y divide-gray-800 border border-gray-800 rounded-lg">
                    {transactions.map(tx => (
                        <div
                            key={tx.id}
                            onClick={() => onSelect(tx)}
                            className={`p-3 cursor-pointer hover:bg-gray-800/50 transition-colors flex justify-between items-center ${currentTransactionId === tx.id ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                        >
                            <div className="flex-1">
                                <div className="text-sm text-white font-medium truncate">{tx.note || 'No description'}</div>
                                <div className="text-xs text-gray-500">
                                    {formatDate(tx.date)} • {catMap[tx.category_id]} • {accMap[tx.account_id]}
                                </div>
                            </div>
                            <div className={`text-sm font-medium ${tx.amount < 0 ? 'text-white' : 'text-emerald-500'}`}>
                                {formatMoney(tx.amount)}
                            </div>
                        </div>
                    ))}
                    {transactions.length === 0 && (
                        <div className="p-4 text-center text-gray-500 text-sm">No transactions found</div>
                    )}
                </div>

                {filterAmount && (
                    <p className="text-xs text-gray-500 text-center">
                        Looking for amount: {formatMoney(filterAmount * -1)}
                    </p>
                )}
            </div>
        </Modal>
    );
}
