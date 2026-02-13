import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountService } from '../../services/AccountService';
import type { Account } from '../../services/AccountService';
import { TransactionService } from '../../services/TransactionService';
import { AccountForm } from './AccountForm';
import { Plus, Edit, Wallet, CreditCard, Banknote } from 'lucide-react';

export function AccountList() {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [balances, setBalances] = useState<Record<string, { posted: number, effective: number }>>({});
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [accs, bals] = await Promise.all([
            AccountService.getAll(),
            TransactionService.getBalances()
        ]);
        setAccounts(accs);
        setBalances(bals);
    };

    const handleEdit = (acc: Account) => {
        setEditingAccount(acc);
        setIsFormOpen(true);
    };

    const handleClose = () => {
        setIsFormOpen(false);
        setEditingAccount(null);
    };

    const formatMoney = (amount: number, currency: string) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: currency }).format(amount);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'bank': return <Banknote className="text-blue-400" size={24} />;
            case 'credit': return <CreditCard className="text-purple-400" size={24} />;
            default: return <Wallet className="text-green-400" size={24} />;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Accounts</h2>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-blue-600 rounded-lg text-sm font-medium text-white transition-colors"
                >
                    <Plus size={16} /> Add Account
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map(acc => {
                    const balance = balances[acc.id] || { posted: 0, effective: 0 };
                    return (
                        <div
                            key={acc.id}
                            onClick={() => navigate(`/transactions?accountId=${acc.id}`)}
                            className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 hover:border-gray-700 transition-colors group cursor-pointer relative"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gray-800 rounded-lg">
                                        {getIcon(acc.type)}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">{acc.name}</h3>
                                        <span className="text-xs text-uppercase text-gray-500 font-medium tracking-wider">{acc.currency} • {acc.type}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleEdit(acc); }}
                                    className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                    <Edit size={16} />
                                </button>
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-sm text-gray-400">Posted</span>
                                    <span className="text-lg font-bold text-white">{formatMoney(balance.posted, acc.currency)}</span>
                                </div>
                                {(balance.effective !== balance.posted) && (
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs text-gray-500">Effective</span>
                                        <span className="text-sm text-gray-400">{formatMoney(balance.effective, acc.currency)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {accounts.length === 0 && (
                <div className="text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-xl">
                    <p>No accounts found. Create one to get started.</p>
                </div>
            )}

            <AccountForm
                isOpen={isFormOpen}
                onClose={handleClose}
                initialData={editingAccount}
                onSuccess={loadData}
            />
        </div>
    );
}
