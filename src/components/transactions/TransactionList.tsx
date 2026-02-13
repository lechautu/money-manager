import { useState, useEffect } from 'react';
import { TransactionService } from '../../services/TransactionService';
import type { Transaction, TransactionFilter } from '../../services/TransactionService';
import { AccountService } from '../../services/AccountService';
import type { Account } from '../../services/AccountService';
import { CategoryService } from '../../services/CategoryService';
import type { Category } from '../../services/CategoryService';
import { TransactionForm } from './TransactionForm';
import { Plus, Filter, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useToast } from '../common/Toast';

import { useSearchParams } from 'react-router-dom';

export function TransactionList() {
    const [searchParams] = useSearchParams();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Record<string, Account>>({});
    const [categories, setCategories] = useState<Record<string, Category>>({});
    const [summary, setSummary] = useState({ income: 0, expense: 0 });

    // Filters
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [search, setSearch] = useState('');

    // Initialize filter from URL if present
    const [filterAccountId, setFilterAccountId] = useState(searchParams.get('accountId') || '');
    const [filterCategoryId, setFilterCategoryId] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Sort
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        loadData();
    }, [month, search, filterAccountId, filterCategoryId, filterStatus, sortBy, sortOrder]);

    const loadData = async () => {
        const filter: TransactionFilter = {
            month: month || undefined,
            search: search || undefined,
            accountId: filterAccountId || undefined,
            categoryId: filterCategoryId || undefined,
            status: filterStatus || undefined,
            sortBy,
            sortOrder
        };

        const [txs, accs, cats] = await Promise.all([
            TransactionService.getAll(filter),
            AccountService.getAll(),
            CategoryService.getAll()
        ]);

        setTransactions(txs);

        const accMap: Record<string, Account> = {};
        accs.forEach(a => accMap[a.id] = a);
        setAccounts(accMap);

        const catMap: Record<string, Category> = {};
        cats.forEach(c => catMap[c.id] = c);
        setCategories(catMap);

        // Calc summary for current view
        let inc = 0, exp = 0;
        txs.forEach(t => {
            if (t.amount > 0) inc += t.amount;
            else exp += t.amount;
        });
        setSummary({ income: inc, expense: exp });
    };

    const handleSort = (col: 'date' | 'amount') => {
        if (sortBy === col) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(col);
            setSortOrder('desc');
        }
    };

    const handleEdit = (tx: Transaction) => {
        setEditingTx(tx);
        setIsFormOpen(true);
    };

    const handleClose = () => {
        setIsFormOpen(false);
        setEditingTx(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this transaction?')) return;
        try {
            await TransactionService.delete(id);
            showToast('Transaction deleted successfully');
            loadData();
        } catch (e) {
            console.error(e);
            showToast('Failed to delete transaction', 'error');
        }
    };

    const formatMoney = (amount: number, currency: string = 'VND') => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(Math.abs(amount));
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-xl font-bold">Transactions</h2>
                <div className="flex gap-2 w-full md:w-auto">
                    <input
                        type="month"
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none"
                    />
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded border border-gray-700 ${showFilters ? 'bg-primary border-primary' : 'bg-gray-800'}`}
                        title="Filters"
                    >
                        <Filter size={16} />
                    </button>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-blue-600 rounded text-sm text-white ml-auto"
                    >
                        <Plus size={16} /> New
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                    <input
                        type="text"
                        placeholder="Search notes..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                    />
                    <select
                        value={filterAccountId}
                        onChange={e => setFilterAccountId(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                    >
                        <option value="">All Accounts</option>
                        {Object.values(accounts).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <select
                        value={filterCategoryId}
                        onChange={e => setFilterCategoryId(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                    >
                        <option value="">All Categories</option>
                        {Object.values(categories).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                    >
                        <option value="">All Status</option>
                        <option value="posted">Posted</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>
            )}

            {/* Summary for filtered view */}
            <div className="flex gap-4 text-sm text-gray-400">
                <div>Income: <span className="text-green-500 font-medium">+{formatMoney(summary.income)}</span></div>
                <div>Expense: <span className="text-white font-medium">-{formatMoney(Math.abs(summary.expense))}</span></div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 p-3 text-xs font-semibold text-gray-500 border-b border-gray-800 bg-gray-900/50 hidden md:grid">
                    <div
                        className="col-span-1 cursor-pointer flex items-center gap-1 hover:text-white"
                        onClick={() => handleSort('date')}
                    >
                        Date {sortBy === 'date' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                    <div className="col-span-3">Details</div>
                    <div className="col-span-3">Category</div>
                    <div className="col-span-2">Account</div>
                    <div
                        className="col-span-3 text-right cursor-pointer flex items-center justify-end gap-1 hover:text-white"
                        onClick={() => handleSort('amount')}
                    >
                        {sortBy === 'amount' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)} Amount
                    </div>
                </div>

                <div className="divide-y divide-gray-800">
                    {transactions.map(tx => {
                        const acc = accounts[tx.account_id]; // Source Account
                        const cat = categories[tx.category_id];

                        let isExpense = tx.amount < 0;
                        let displayAmount = tx.amount;
                        let description = tx.note || 'No description';
                        let accountLabel = acc?.name || '';
                        let categoryLabel = cat?.name || '';

                        // Handle Transfer Display Logic
                        if (tx.source === 'transfer') {
                            const toAcc = tx.to_account_id ? accounts[tx.to_account_id] : null;

                            if (filterAccountId) {
                                // Context: Viewing specific account
                                if (filterAccountId === tx.to_account_id) {
                                    // Incoming Transfer
                                    isExpense = false;
                                    displayAmount = Math.abs(tx.amount);
                                    description = `Transfer from ${acc?.name}`;
                                    accountLabel = toAcc?.name || ''; // Should match current filter
                                    // Maybe show "From X" in category?
                                    categoryLabel = 'Transfer In';
                                } else {
                                    // Outgoing Transfer
                                    isExpense = true;
                                    displayAmount = tx.amount; // negative
                                    description = `Transfer to ${toAcc?.name}`;
                                    categoryLabel = 'Transfer Out';
                                }
                            } else {
                                // Context: All Accounts
                                // Show Flow
                                description = `Transfer: ${acc?.name} → ${toAcc?.name}`;
                                categoryLabel = 'Transfer';
                                // accountLabel can show both?
                                accountLabel = `${acc?.name} → ${toAcc?.name}`;
                            }
                        }

                        return (
                            <div
                                key={tx.id}
                                onClick={() => handleEdit(tx)}
                                className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-gray-800/50 cursor-pointer transition-colors"
                            >
                                <div className="col-span-2 md:col-span-1 text-sm text-gray-400 font-mono">{formatDate(tx.date)}</div>
                                <div className="col-span-6 md:col-span-3">
                                    <div className="text-sm text-white truncate">{description}</div>
                                    <div className="text-xs text-gray-500 md:hidden">{categoryLabel} • {accountLabel}</div>
                                </div>
                                <div className="col-span-3 text-sm text-gray-300 hidden md:block truncate">{categoryLabel}</div>
                                <div className="col-span-2 text-xs text-gray-400 hidden md:block truncate">{accountLabel}</div>
                                <div className={`col-span-4 md:col-span-3 text-right font-medium text-sm ${isExpense ? 'text-white' : 'text-green-400'}`}>
                                    {isExpense ? '-' : '+'}{formatMoney(Math.abs(displayAmount), acc?.currency)}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(tx.id); }}
                                        className="ml-2 px-2 py-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-500/10 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {transactions.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No transactions found.
                        </div>
                    )}
                </div>

                <TransactionForm
                    isOpen={isFormOpen}
                    onClose={handleClose}
                    initialData={editingTx}
                    defaultValues={filterAccountId ? { account_id: filterAccountId } : undefined}
                    onSuccess={loadData}
                />
            </div>
        </div>
    );
}
