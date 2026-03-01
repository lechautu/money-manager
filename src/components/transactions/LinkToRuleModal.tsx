
import { useState, useEffect } from 'react';
import { RecurringService } from '../../services/RecurringService';
import type { RecurringRule } from '../../services/RecurringService';
import { InstallmentService } from '../../services/InstallmentService';
import type { InstallmentPlan, InstallmentPayment } from '../../services/InstallmentService';
import type { Transaction } from '../../services/TransactionService';
import { X, Calendar, Tag, Link } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction;
    onSuccess: () => void;
}

export function LinkToRuleModal({ isOpen, onClose, transaction, onSuccess }: Props) {
    const [mode, setMode] = useState<'recurring' | 'installment'>('recurring');
    const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
    const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
    const [selectedRuleId, setSelectedRuleId] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [schedule, setSchedule] = useState<InstallmentPayment[]>([]);
    const [recurringInstances, setRecurringInstances] = useState<any[]>([]);
    const [selectedPaymentId, setSelectedPaymentId] = useState('');
    const [instType, setInstType] = useState<'expense' | 'payment'>('payment');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadOptions();
        }
    }, [isOpen]);

    const loadOptions = async () => {
        const [rules, plans, instances] = await Promise.all([
            RecurringService.getAll(),
            InstallmentService.getAll(),
            RecurringService.getAllInstances()
        ]);
        setRecurringRules(rules);
        setInstallmentPlans(plans);
        setRecurringInstances(instances);
    };

    const handlePlanChange = async (planId: string) => {
        setSelectedPlanId(planId);
        setSelectedPaymentId('');
        if (planId) {
            const payments = await InstallmentService.getPaymentsByPlan(planId);
            setSchedule(payments);
        } else {
            setSchedule([]);
        }
    };

    const handleLink = async () => {
        setLoading(true);
        try {
            if (mode === 'recurring') {
                if (!selectedRuleId) throw new Error('Please select a rule');
                await RecurringService.linkTransaction(selectedRuleId, transaction.id);
            } else {
                if (!selectedPaymentId) throw new Error('Please select a payment period');
                await InstallmentService.linkTransaction(selectedPaymentId, transaction.id, instType);
            }
            onSuccess();
            onClose();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isIncome = transaction.amount > 0;
    const isTransfer = transaction.source === 'transfer';

    const filteredRules = recurringRules.filter(r => {
        // Match type
        if (isTransfer) return r.type === 'transfer';
        if (isIncome && r.type !== 'income') return false;
        if (!isIncome && r.type !== 'expense') return false;

        // Filter out if an instance for this month already has a transaction
        if (r.frequency === 'monthly') {
            const txMonth = transaction.date.substring(0, 7);
            const hasProcessedInstance = recurringInstances.find(i =>
                i.rule_id === r.id &&
                i.date.startsWith(txMonth) &&
                (i.generated_transaction_id || i.id)
            );
            return !hasProcessedInstance;
        }
        return true;
    });

    const filteredSchedule = schedule.filter(p => {
        if (instType === 'expense') {
            return !p.expense_transaction_id;
        } else {
            return p.status !== 'paid' && !p.generated_transaction_id && !p.linked_transaction_id;
        }
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-800">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Link size={20} className="text-primary" /> Link Transaction
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-full transition-colors text-gray-500 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Transaction Summary */}
                    <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 space-y-2">
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Transaction to link:</div>
                        <div className="flex justify-between items-center">
                            <div className="text-sm font-medium">{transaction.note || 'No note'}</div>
                            <div className={`text-sm font-bold ${transaction.amount < 0 ? 'text-white' : 'text-emerald-400'}`}>
                                {transaction.amount < 0 ? '-' : '+'}{new Intl.NumberFormat('en-US', { style: 'currency', currency: transaction.currency || 'VND' }).format(Math.abs(transaction.amount))}
                            </div>
                        </div>
                        <div className="flex gap-4 text-[10px] text-gray-400">
                            <span className="flex items-center gap-1"><Calendar size={10} /> {formatDisplayDate(transaction.date)}</span>
                            <span className="flex items-center gap-1"><Tag size={10} /> {transaction.category_name}</span>
                        </div>
                    </div>

                    <div className="flex p-1 bg-gray-800 rounded-lg">
                        <button
                            onClick={() => setMode('recurring')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'recurring' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Recurring Plan
                        </button>
                        <button
                            onClick={() => setMode('installment')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'installment' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Installment
                        </button>
                    </div>

                    {mode === 'recurring' ? (
                        <div className="space-y-3">
                            <label className="block text-xs font-medium text-gray-400">Select Recurring Rule</label>
                            <select
                                value={selectedRuleId}
                                onChange={(e) => setSelectedRuleId(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                            >
                                <option value="">-- Choose Plan --</option>
                                {filteredRules.map(r => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.amount < 0 ? '-' : '+'}{Math.abs(r.amount)})</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-gray-500 italic">
                                Linking will mark this transaction as a part of the selected plan.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-gray-400">Select Installment Plan</label>
                                <select
                                    value={selectedPlanId}
                                    onChange={(e) => handlePlanChange(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                                >
                                    <option value="">-- Choose Plan --</option>
                                    {installmentPlans.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedPlanId && (
                                <div className="space-y-4 animate-in slide-in-from-top-2">
                                    <div className="space-y-2">
                                        <label className="block text-xs font-medium text-gray-400">Link Type</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setInstType('expense')}
                                                className={`py-2 text-[10px] uppercase font-bold rounded border transition-all ${instType === 'expense' ? 'bg-primary/20 border-primary text-primary' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}
                                            >
                                                Initial Purchase
                                            </button>
                                            <button
                                                onClick={() => setInstType('payment')}
                                                className={`py-2 text-[10px] uppercase font-bold rounded border transition-all ${instType === 'payment' ? 'bg-primary/20 border-primary text-primary' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}
                                            >
                                                Monthly Payment
                                            </button>
                                        </div>
                                    </div>

                                    {instType === 'payment' && (
                                        <div className="space-y-2">
                                            <label className="block text-xs font-medium text-gray-400">Which period?</label>
                                            <select
                                                value={selectedPaymentId}
                                                onChange={(e) => setSelectedPaymentId(e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                                            >
                                                <option value="">-- Select Month --</option>
                                                {filteredSchedule.map(p => (
                                                    <option key={p.id} value={p.id}>{formatDisplayDate(p.due_date)} - ({p.due_month})</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-800/30 border-t border-gray-800 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleLink}
                        disabled={loading || (mode === 'recurring' && !selectedRuleId) || (mode === 'installment' && (!selectedPlanId || (instType === 'payment' && !selectedPaymentId)))}
                        className="flex-1 py-2 text-sm font-medium bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-all shadow-lg shadow-blue-900/20"
                    >
                        {loading ? 'Linking...' : 'Confirm Link'}
                    </button>
                </div>
            </div>
        </div>
    );
}
