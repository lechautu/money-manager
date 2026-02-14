import { useState, useEffect } from 'react';
import { TransactionService } from '../../services/TransactionService';
import type { Transaction, TransactionFilter } from '../../services/TransactionService';
import { AccountService } from '../../services/AccountService';
import type { Account } from '../../services/AccountService';
import { CategoryService } from '../../services/CategoryService';
import type { Category, SubCategory } from '../../services/CategoryService';
import { TransactionForm } from './TransactionForm';
import { Plus, ArrowUp, ArrowDown, Trash2, MoreVertical, Copy, Layers, ChevronLeft } from 'lucide-react';
import { useToast } from '../common/Toast';
import { useUndo } from '../common/UndoProvider';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DateRangePicker } from '../common/DateRangePicker';
import {
    startOfDay, endOfDay,
    startOfWeek, endOfWeek,
    startOfMonth, endOfMonth,
    subMonths,
    startOfYear, endOfYear,
    format, parseISO,
    isValid
} from 'date-fns';
import { formatDisplayDate } from '../../utils/dateUtils';

type TimePreset = 'all' | 'today' | 'this_week' | 'this_month' | 'this_year' | 'last_3m' | 'last_6m' | 'custom';

export function TransactionList() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Record<string, Account>>({});
    const [categories, setCategories] = useState<Record<string, Category>>({});
    const [subCategories, setSubCategories] = useState<Record<string, SubCategory>>({});
    const [balances, setBalances] = useState<Record<string, { posted: number, effective: number }>>({});
    const [summary, setSummary] = useState({ income: 0, expense: 0 });

    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

    // Filters
    const [timePreset, setTimePreset] = useState<TimePreset>(() => {
        if (searchParams.get('startDate') && searchParams.get('endDate')) return 'custom';
        if (searchParams.get('month')) return 'this_month';
        return 'all';
    });

    const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(() => {
        const start = searchParams.get('startDate') || searchParams.get('month') ? `${searchParams.get('month')}-01` : null;
        let end = searchParams.get('endDate') || null;

        if (!end && searchParams.get('month')) {
            const m = parseISO(`${searchParams.get('month')}-01`);
            if (isValid(m)) end = format(endOfMonth(m), 'yyyy-MM-dd');
        }

        return (start && end) ? { start, end } : null;
    });

    const [month, setMonth] = useState(searchParams.get('month') || ''); // Keep for mobile/legacy logic or syncing if needed


    const [search, setSearch] = useState('');

    // Initialize filter from URL if present
    const [filterAccountId, setFilterAccountId] = useState(searchParams.get('accountId') || '');
    const [filterCategoryId, setFilterCategoryId] = useState(searchParams.get('categoryId') || '');
    const [filterSubCategoryId, setFilterSubCategoryId] = useState(searchParams.get('subCategoryId') || '');
    const [filterStatus, setFilterStatus] = useState('');

    // Sort
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [cloningTx, setCloningTx] = useState<Transaction | null>(null);
    const { showToast } = useToast();
    const { showUndo } = useUndo();

    // Bulk Actions State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);
    const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, [timePreset, dateRange, month, search, filterAccountId, filterCategoryId, filterSubCategoryId, filterStatus, sortBy, sortOrder]);

    useEffect(() => {
        const handleClickOutside = () => {
            setActiveDropdownId(null);
            setIsBulkMoveOpen(false);
            setIsBulkStatusOpen(false);
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const loadData = async () => {
        const filter: TransactionFilter = {
            startDate: dateRange?.start,
            endDate: dateRange?.end,
            month: (!dateRange && month) ? month : undefined,
            search: search || undefined,
            accountId: filterAccountId || undefined,
            categoryId: filterCategoryId || undefined,
            subCategoryId: filterSubCategoryId || undefined,
            status: filterStatus || undefined,
            sortBy,
            sortOrder
        };

        const [txs, accs, cats, subCats, bals] = await Promise.all([
            TransactionService.getAll(filter),
            AccountService.getAll(),
            CategoryService.getAll(),
            CategoryService.getAllSubCategories(),
            TransactionService.getBalances()
        ]);

        const accMap: Record<string, Account> = {};
        accs.forEach(a => accMap[a.id] = a);
        setAccounts(accMap);

        const catMap: Record<string, Category> = {};
        cats.forEach(c => catMap[c.id] = c);
        setCategories(catMap);

        const subCatMap: Record<string, SubCategory> = {};
        subCats.forEach(s => subCatMap[s.id] = s);
        setSubCategories(subCatMap);

        setBalances(bals);

        // Calc summary for current view - Exclude transfers as they are internal
        let inc = 0, exp = 0;
        txs.forEach(t => {
            if (t.source === 'transfer') return;
            if (t.status === 'ignored') return;
            if (t.amount > 0) inc += t.amount;
            else exp += t.amount;
        });
        setSummary({ income: inc, expense: exp });

        // Transform transactions for display: show 2 sides for transfers if no account filter
        let displayTxs: any[] = [];
        txs.forEach(t => {
            if (t.source === 'transfer' && !filterAccountId) {
                displayTxs.push({ ...t, vSide: 'out' });
                displayTxs.push({ ...t, vSide: 'in' });
            } else {
                displayTxs.push(t);
            }
        });

        // Re-sort if we expanded the list
        if (!filterAccountId && displayTxs.length !== txs.length) {
            displayTxs.sort((a, b) => {
                const dA = new Date(a.date).getTime();
                const dB = new Date(b.date).getTime();
                if (dA !== dB) return sortOrder === 'asc' ? dA - dB : dB - dA;
                return b.created_at.localeCompare(a.created_at);
            });
        }

        setTransactions(displayTxs);
    };

    const handleTimePresetChange = (preset: TimePreset) => {
        setTimePreset(preset);
        const now = new Date();

        switch (preset) {
            case 'today':
                setDateRange({
                    start: format(startOfDay(now), 'yyyy-MM-dd'),
                    end: format(endOfDay(now), 'yyyy-MM-dd')
                });
                break;
            case 'this_week':
                setDateRange({
                    start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
                    end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
                });
                break;
            case 'this_month':
                setDateRange({
                    start: format(startOfMonth(now), 'yyyy-MM-dd'),
                    end: format(endOfMonth(now), 'yyyy-MM-dd')
                });
                break;
            case 'last_3m':
                setDateRange({
                    start: format(subMonths(startOfMonth(now), 2), 'yyyy-MM-dd'),
                    end: format(endOfMonth(now), 'yyyy-MM-dd')
                });
                break;
            case 'last_6m':
                setDateRange({
                    start: format(subMonths(startOfMonth(now), 5), 'yyyy-MM-dd'),
                    end: format(endOfMonth(now), 'yyyy-MM-dd')
                });
                break;
            case 'this_year':
                setDateRange({
                    start: format(startOfYear(now), 'yyyy-MM-dd'),
                    end: format(endOfYear(now), 'yyyy-MM-dd')
                });
                break;
            case 'custom':
                // Don't clear dateRange if switching to custom, let user edit
                break;
            case 'all':
            default:
                setDateRange(null);
                setMonth('');
                break;
        }
    };

    const handleSelectAll = () => {
        if (selectedIds.size === transactions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(transactions.map(t => t.id)));
        }
    };

    const handleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} transactions?`)) return;
        const idsToDelete = Array.from(selectedIds);
        try {
            await TransactionService.bulkDelete(idsToDelete);

            showUndo(`${idsToDelete.length} transactions deleted`, async () => {
                await TransactionService.bulkRestore(idsToDelete);
                loadData();
            });

            setSelectedIds(new Set());
            loadData();
        } catch (e) {
            console.error(e);
            showToast('Failed to delete transactions', 'error');
        }
    };

    const handleBulkMove = async (accountId: string) => {
        try {
            await TransactionService.bulkUpdate(Array.from(selectedIds), { account_id: accountId });
            showToast('Transactions moved successfully');
            setSelectedIds(new Set());
            setIsBulkMoveOpen(false);
            loadData();
        } catch (e) {
            console.error(e);
            showToast('Failed to move transactions', 'error');
        }
    };

    const handleBulkStatus = async (status: 'posted' | 'pending' | 'ignored') => {
        try {
            await TransactionService.bulkUpdate(Array.from(selectedIds), { status });
            showToast('Transactions status updated');
            setSelectedIds(new Set());
            setIsBulkStatusOpen(false);
            loadData();
        } catch (e) {
            console.error(e);
            showToast('Failed to update status', 'error');
        }
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
        setCloningTx(null);
    };

    const handleClone = (tx: Transaction) => {
        setCloningTx(tx);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this transaction?')) return;

        try {
            await TransactionService.delete(id);

            showUndo('Transaction deleted', async () => {
                await TransactionService.restore(id);
                loadData();
            });

            loadData();
        } catch (e) {
            console.error(e);
            showToast('Failed to delete transaction', 'error');
        }
    };

    const formatMoney = (amount: number, currency: string = 'VND') => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Math.abs(amount));
    };

    const formatDate = (dateStr: string) => {
        return formatDisplayDate(dateStr);
    };

    const getSummaryBalances = () => {
        const byCurrency: Record<string, { posted: number, effective: number }> = {};
        Object.entries(balances).forEach(([accId, bal]) => {
            const acc = accounts[accId];
            if (!acc) return;
            if (filterAccountId && accId !== filterAccountId) return;
            if (!byCurrency[acc.currency]) {
                byCurrency[acc.currency] = { posted: 0, effective: 0 };
            }
            byCurrency[acc.currency].posted += bal.posted;
            byCurrency[acc.currency].effective += bal.effective;
        });
        return Object.entries(byCurrency);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        title="Go back"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold">Transactions</h2>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-blue-600 rounded text-sm text-white"
                >
                    <Plus size={16} /> New
                </button>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-3 bg-blue-900/20 border border-blue-900/50 p-3 rounded-lg z-50 relative">
                    <span className="text-sm font-bold text-blue-400 whitespace-nowrap">{selectedIds.size} Selected</span>

                    <div className="h-4 w-px bg-blue-900/50 mx-2 hidden md:block"></div>

                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsBulkMoveOpen(!isBulkMoveOpen); setIsBulkStatusOpen(false); }}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-white border border-gray-700 whitespace-nowrap flex items-center gap-1"
                        >
                            Move to Account <ArrowDown size={10} />
                        </button>
                        <div className={`absolute top-full left-0 mt-1 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-[100] max-h-60 overflow-y-auto transition-all duration-200 ease-out origin-top-left ${isBulkMoveOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}>
                            {Object.values(accounts).map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => handleBulkMove(a.id)}
                                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white truncate border-b border-gray-800 last:border-0"
                                >
                                    {a.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsBulkStatusOpen(!isBulkStatusOpen); setIsBulkMoveOpen(false); }}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-white border border-gray-700 whitespace-nowrap flex items-center gap-1"
                        >
                            Change Status <ArrowDown size={10} />
                        </button>
                        <div className={`absolute top-full left-0 mt-1 w-32 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-[100] transition-all duration-200 ease-out origin-top-left ${isBulkStatusOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}>
                            <button onClick={() => handleBulkStatus('posted')} className="w-full text-left px-3 py-2 text-xs text-emerald-500 hover:bg-gray-800 border-b border-gray-800">Posted</button>
                            <button onClick={() => handleBulkStatus('pending')} className="w-full text-left px-3 py-2 text-xs text-yellow-500 hover:bg-gray-800 border-b border-gray-800">Pending</button>
                            <button onClick={() => handleBulkStatus('ignored')} className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-800">Ignored</button>
                        </div>
                    </div>

                    <button
                        onClick={handleBulkDelete}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded text-xs whitespace-nowrap ml-auto"
                    >
                        Delete Selected
                    </button>
                </div>
            )}

            {/* Filters Bar */}
            <div className="flex flex-col gap-2 bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                    <select
                        value={timePreset}
                        onChange={e => handleTimePresetChange(e.target.value as TimePreset)}
                        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none"
                    >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="this_week">This Week</option>
                        <option value="this_month">This Month</option>
                        <option value="this_year">This Year</option>
                        <option value="last_3m">Last 3 Months</option>
                        <option value="last_6m">Last 6 Months</option>
                        <option value="custom">Custom Range...</option>
                    </select>

                    {timePreset === 'custom' ? (
                        <div className="md:col-span-2">
                            <DateRangePicker
                                range={dateRange}
                                onChange={setDateRange}
                                placeholder="Pick dates..."
                            />
                        </div>
                    ) : (
                        <input
                            type="text"
                            placeholder="Search notes..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                        />
                    )}

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
                        onChange={e => {
                            setFilterCategoryId(e.target.value);
                            setFilterSubCategoryId('');
                        }}
                        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                    >
                        <option value="">All Categories</option>
                        {Object.values(categories).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    {filterCategoryId ? (
                        <select
                            value={filterSubCategoryId}
                            onChange={e => setFilterSubCategoryId(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white animate-in slide-in-from-left-2 duration-200"
                        >
                            <option value="">All Sub-categories</option>
                            {Object.values(subCategories)
                                .filter(s => s.category_id === filterCategoryId)
                                .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    ) : (
                        <div className="hidden md:block"></div>
                    )}

                    <div className="flex gap-2">
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                        >
                            <option value="">All Status</option>
                            <option value="posted">Posted</option>
                            <option value="pending">Pending</option>
                            <option value="ignored">Ignored</option>
                        </select>
                        {(filterCategoryId || filterAccountId || search || filterSubCategoryId || filterStatus || timePreset !== 'all') && (
                            <button
                                onClick={() => {
                                    handleTimePresetChange('all');
                                    setSearch('');
                                    setFilterAccountId('');
                                    setFilterCategoryId('');
                                    setFilterSubCategoryId('');
                                    setFilterStatus('');
                                }}
                                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded border border-gray-700 transition-colors"
                                title="Clear all filters"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {timePreset !== 'all' && timePreset !== 'custom' && dateRange && (
                    <div className="text-[10px] text-gray-500 px-1 italic">
                        Showing data from {formatDisplayDate(dateRange.start)} to {formatDisplayDate(dateRange.end)}
                    </div>
                )}
                {timePreset === 'custom' && (
                    <div className="md:hidden">
                        <input
                            type="text"
                            placeholder="Search notes..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white mt-1"
                        />
                    </div>
                )}
            </div>

            {/* Summary & Balances */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex gap-4 text-sm bg-gray-900/40 p-3 rounded-lg border border-gray-800/50 items-center">
                    <div>Income: <span className="text-emerald-500 font-medium">+{formatMoney(summary.income)}</span></div>
                    <div>Expense: <span className="text-white font-medium">-{formatMoney(Math.abs(summary.expense))}</span></div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm bg-blue-900/10 p-3 rounded-lg border border-blue-900/20 items-center">
                    <span className="text-gray-400 font-medium">{filterAccountId ? 'Account Balance:' : 'Total Balances:'}</span>
                    {getSummaryBalances().map(([curr, bal]) => (
                        <div key={curr} className="flex gap-3 border-r border-blue-900/30 pr-3 last:border-0 last:pr-0">
                            {getSummaryBalances().length > 1 && <span className="text-gray-500">{curr}:</span>}
                            <div>Posted: <span className="text-white font-bold">{formatMoney(bal.posted, curr)}</span></div>
                            <div>Effective: <span className="text-blue-400 font-bold">{formatMoney(bal.effective, curr)}</span></div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl">
                {/* Table Header */}
                <div className="grid grid-cols-[auto_1fr] md:grid-cols-[auto_repeat(12,1fr)] gap-2 p-3 text-xs font-semibold text-gray-500 border-b border-gray-800 bg-gray-900/50 hidden md:grid rounded-t-xl items-center">
                    <div className="w-8 flex justify-center">
                        <input
                            type="checkbox"
                            className="rounded bg-gray-800 border-gray-700 text-primary focus:ring-0 cursor-pointer"
                            checked={transactions.length > 0 && selectedIds.size === transactions.length}
                            onChange={handleSelectAll}
                        />
                    </div>

                    <div
                        className="col-span-1 cursor-pointer flex items-center gap-1 hover:text-white"
                        onClick={() => handleSort('date')}
                    >
                        Date {sortBy === 'date' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                    <div className="col-span-3">Category</div>
                    <div className="col-span-2">Note</div>
                    <div className="col-span-2">Account</div>
                    <div
                        className="col-span-2 text-right cursor-pointer flex items-center justify-end gap-1 hover:text-white"
                        onClick={() => handleSort('amount')}
                    >
                        {sortBy === 'amount' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)} Amount
                    </div>
                    <div className="col-span-1 text-center">Status</div>
                    <div className="col-span-1"></div>
                </div>

                <div className="divide-y divide-gray-800">
                    {transactions.map(tx => {
                        const acc = accounts[tx.account_id]; // Source Account
                        const cat = categories[tx.category_id];
                        const subCat = subCategories[tx.sub_category_id || ''];

                        let isExpense = tx.amount < 0;
                        let displayAmount = tx.amount;
                        let description = tx.note || '';
                        let accountLabel = acc?.name || '';
                        let categoryLabel = cat?.name || 'Uncategorized';
                        if (subCat) categoryLabel += `: ${subCat.name}`;

                        const isSelected = selectedIds.has(tx.id);

                        // Handle Transfer Display Logic
                        if (tx.source === 'transfer') {
                            const toAcc = tx.to_account_id ? accounts[tx.to_account_id] : null;
                            const vSide = (tx as any).vSide;

                            if (filterAccountId || vSide) {
                                // Specific account side (either via filter or virtual expansion)
                                const isTargetSide = filterAccountId === tx.to_account_id || vSide === 'in';

                                if (isTargetSide) {
                                    // Incoming Transfer
                                    isExpense = false;
                                    displayAmount = Math.abs(tx.amount);
                                    if (!description) description = `Transfer from ${acc?.name}`;
                                    accountLabel = toAcc?.name || '';
                                    categoryLabel = 'Transfer In';
                                } else {
                                    // Outgoing Transfer
                                    isExpense = true;
                                    displayAmount = tx.amount; // negative
                                    if (!description) description = `Transfer to ${toAcc?.name}`;
                                    accountLabel = acc?.name || '';
                                    categoryLabel = 'Transfer Out';
                                }
                            } else {
                                // Fallback (should not happen with displayTxs expansion)
                                if (!description) description = `Transfer: ${acc?.name} → ${toAcc?.name}`;
                                categoryLabel = 'Transfer';
                                accountLabel = `${acc?.name} → ${toAcc?.name}`;
                            }
                        } else if (tx.is_split) {
                            categoryLabel = 'Split Transaction';
                            const lineCount = tx.splitLines?.length || 0;
                            if (!description) description = `${lineCount} split lines`;
                            else description = `${description} (${lineCount} splits)`;
                        }

                        return (
                            <div
                                key={`${tx.id}-${(tx as any).vSide || 'main'}`}
                                onClick={() => handleEdit(tx)}
                                className={`relative grid grid-cols-[auto_1fr] md:grid-cols-[auto_repeat(12,1fr)] gap-2 p-3 items-center cursor-pointer transition-colors last:rounded-b-xl ${isSelected ? 'bg-blue-900/20' : 'hover:bg-gray-800/50'}`}
                            >
                                <div className="w-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        className="rounded bg-gray-800 border-gray-700 text-primary focus:ring-0 cursor-pointer"
                                        checked={isSelected}
                                        onChange={() => handleSelect(tx.id)}
                                    />
                                </div>

                                <div className="col-span-2 md:col-span-1 text-sm text-gray-400 font-mono">{formatDate(tx.date)}</div>

                                {/* Category Column (Swapped) */}
                                <div className="col-span-6 md:col-span-3">
                                    <div className="text-sm text-white truncate flex items-center">
                                        {!!tx.is_split && <Layers size={12} className="inline mr-1 text-primary shrink-0" />}
                                        <span className="truncate" title={categoryLabel}>{categoryLabel}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 md:hidden">
                                        {accountLabel}
                                    </div>
                                </div>

                                {/* Note Column (Swapped) */}
                                <div className="col-span-3 md:col-span-2 text-sm text-gray-400 hidden md:block truncate" title={description}>
                                    {description}
                                </div>

                                <div className="col-span-2 text-xs text-gray-400 hidden md:block truncate">{accountLabel}</div>
                                <div className={`col-span-4 md:col-span-2 text-right font-medium text-sm ${isExpense ? 'text-white' : 'text-emerald-400'}`}>
                                    {isExpense ? '-' : '+'}{formatMoney(Math.abs(displayAmount), acc?.currency)}
                                </div>
                                <div className="col-span-2 md:col-span-1 flex justify-center items-center">
                                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${tx.status === 'posted' ? 'bg-emerald-500/10 text-emerald-500' :
                                        tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                            'bg-gray-500/10 text-gray-500'
                                        }`}>
                                        {tx.status}
                                    </span>
                                </div>
                                <div className="absolute md:relative top-2 right-1 md:top-auto md:right-auto md:col-span-1 flex justify-end">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDropdownId(activeDropdownId === tx.id ? null : tx.id);
                                        }}
                                        className="p-1 text-gray-500 hover:text-white rounded hover:bg-gray-800 transition-colors"
                                        title="More"
                                    >
                                        <MoreVertical size={16} />
                                    </button>

                                    <div
                                        className={`absolute right-0 top-8 w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-[100] overflow-hidden transition-all duration-200 ease-out origin-top-right ${activeDropdownId === tx.id ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleClone(tx);
                                                setActiveDropdownId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
                                        >
                                            <Copy size={14} /> Clone
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(tx.id);
                                                setActiveDropdownId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors text-left"
                                        >
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    </div>
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
                    defaultValues={cloningTx || (filterAccountId ? { account_id: filterAccountId } : undefined)}
                    onSuccess={loadData}
                />
            </div>
        </div >
    );
}
