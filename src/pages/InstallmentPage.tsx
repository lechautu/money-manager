import { useState, useEffect } from 'react';
import { InstallmentService } from '../services/InstallmentService';
import type { InstallmentPlan, InstallmentPayment } from '../services/InstallmentService';
import { InstallmentForm } from '../components/installments/InstallmentForm';
import { TransactionForm } from '../components/transactions/TransactionForm';
import { Plus, Trash, Calendar, CreditCard, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { AccountService } from '../services/AccountService';
import { useToast } from '../components/common/Toast';
import { formatDisplayDate } from '../utils/dateUtils';

export default function InstallmentPage() {
    const [plans, setPlans] = useState<InstallmentPlan[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
    const [payments, setPayments] = useState<InstallmentPayment[]>([]);
    const [payingPayment, setPayingPayment] = useState<InstallmentPayment | null>(null);
    const [payingPlan, setPayingPlan] = useState<InstallmentPlan | null>(null);

    const [accNames, setAccNames] = useState<Record<string, string>>({});
    const [hasPendingCount, setHasPendingCount] = useState(0);
    const { showToast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);

        // Run check first to ensure latest statuses and auto-add expenses
        try {
            await InstallmentService.checkOverdue();
        } catch (e) {
            console.error('Check overdue failed', e);
        }

        const [ps, accs, pendingCount] = await Promise.all([
            InstallmentService.getAll(),
            AccountService.getAll(),
            InstallmentService.getPendingCount()
        ]);

        setPlans(ps);
        setHasPendingCount(pendingCount);

        const am: Record<string, string> = {};
        accs.forEach(acc => am[acc.id] = acc.name);
        setAccNames(am);

        setLoading(false);
        window.dispatchEvent(new CustomEvent('refresh-installment-count'));
    };

    const handleExpand = async (planId: string) => {
        if (expandedPlan === planId) {
            setExpandedPlan(null);
            setPayments([]);
        } else {
            setExpandedPlan(planId);
            const pays = await InstallmentService.getPaymentsByPlan(planId);
            setPayments(pays);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this installment plan AND all linked data? Transactions already paid will be kept.')) {
            try {
                await InstallmentService.delete(id);
                showToast('Installment plan deleted successfully');
                loadData();
            } catch (e) {
                console.error(e);
                showToast('Failed to delete installment plan', 'error');
            }
        }
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(amount);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <CreditCard className="text-primary" /> Installment Plans
                </h1>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-blue-600 rounded text-sm text-white"
                >
                    <Plus size={16} /> New Plan
                </button>
            </div>

            {
                hasPendingCount > 0 && (
                    <div className="bg-red-900/40 border border-red-900/60 p-4 rounded-lg flex items-center gap-4 text-red-200 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="bg-red-600 p-2 rounded-full">
                            <AlertTriangle className="text-white" size={20} />
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-sm">Action Required</p>
                            <p className="text-xs opacity-90">You have {hasPendingCount} installment payment(s) that are due or overdue. Please check and process them.</p>
                        </div>
                    </div>
                )
            }

            <div className="grid grid-cols-1 gap-4">
                {plans.map(plan => (
                    <div key={plan.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                        <div
                            className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                            onClick={() => handleExpand(plan.id)}
                        >
                            <button className="text-gray-400">
                                {expandedPlan === plan.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                            </button>

                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                                    <div className="text-right">
                                        <div className="font-bold text-white">{formatMoney(plan.total_amount)}</div>
                                        <div className="text-xs text-gray-500">{plan.tenor_months} months</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                                    <div className="flex items-center gap-1">
                                        <CreditCard size={14} /> {accNames[plan.credit_account_id]}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Calendar size={14} /> Start: {formatDisplayDate(plan.start_date)}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                        await InstallmentService.update(plan.id, { auto_add: plan.auto_add ? 0 : 1 });
                                        showToast(`Auto-Add ${plan.auto_add ? 'disabled' : 'enabled'}`);
                                        loadData();
                                    } catch (err) {
                                        showToast('Failed to update plan', 'error');
                                    }
                                }}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${plan.auto_add ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white'}`}
                                title={plan.auto_add ? "Click to disable Auto-Add" : "Click to enable Auto-Add"}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${plan.auto_add ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
                                {plan.auto_add ? 'Auto-Add: ON' : 'Auto-Add: OFF'}
                            </button>

                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(plan.id); }}
                                className="p-2 text-gray-500 hover:text-red-500 rounded hover:bg-red-500/10"
                            >
                                <Trash size={16} />
                            </button>
                        </div>

                        {expandedPlan === plan.id && (
                            <div className="bg-gray-900/50 border-t border-gray-800 p-4">
                                <h4 className="text-sm font-semibold text-gray-400 mb-3">Payment Schedule</h4>
                                <div className="space-y-2">
                                    {payments.map((pay, idx) => (
                                        <div key={pay.id} className="flex justify-between items-center text-sm border-b border-gray-800 pb-2 last:border-0 last:pb-0">
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-500 text-xs w-6">#{idx + 1}</span>
                                                <span className="text-white">{formatDisplayDate(pay.due_date)}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-medium text-white">{formatMoney(pay.amount)}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1.5 ${pay.status === 'paid' ? 'bg-emerald-500/20 text-emerald-500' :
                                                    pay.status === 'overdue' ? 'bg-red-500/20 text-red-500' :
                                                        pay.status === 'due' ? 'bg-amber-500/20 text-amber-500 font-medium' :
                                                            'bg-gray-700 text-gray-400'
                                                    }`}>
                                                    <div className={`w-1 h-1 rounded-full ${pay.status === 'paid' ? 'bg-emerald-500' :
                                                        pay.status === 'overdue' ? 'bg-red-500' :
                                                            pay.status === 'due' ? 'bg-amber-500 animate-pulse' :
                                                                'bg-gray-500'
                                                        }`} />
                                                    {pay.status === 'due' && pay.expense_transaction_id ? 'Debt Added -> Pay Now' : pay.status}
                                                </span>
                                                {pay.status !== 'paid' && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPayingPlan(plan);
                                                                setPayingPayment(pay);
                                                            }}
                                                            className="px-2 py-0.5 text-xs bg-primary hover:bg-blue-600 text-white rounded"
                                                        >
                                                            Pay
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {plans.length === 0 && !loading && (
                    <div className="py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                        No installment plans yet.
                    </div>
                )}
            </div>

            <InstallmentForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={loadData}
            />

            {payingPayment && payingPlan && (
                <TransactionForm
                    isOpen={!!payingPayment}
                    onClose={() => { setPayingPayment(null); setPayingPlan(null); }}
                    defaultValues={{
                        date: new Date().toISOString().split('T')[0],
                        amount: payingPayment.amount, // Payment amount for transfer
                        category_id: payingPlan.payment_category_id,
                        sub_category_id: payingPlan.payment_sub_category_id || undefined,
                        account_id: payingPlan.payment_source_account_id || undefined,
                        toAccountId: payingPlan.credit_account_id, // Transfer TO Credit Account
                        type: 'transfer',
                        note: `Payment for ${payingPlan.name} (${payments.indexOf(payingPayment) + 1}/${payingPlan.tenor_months})`
                    }}
                    readOnlyFields={['type', 'toAccountId', 'amount']}
                    onSuccess={async (tx) => {
                        if (tx) {
                            try {
                                await InstallmentService.markPaid(payingPayment.id, tx.id);
                                showToast('Payment recorded and linked successfully');
                                loadData();
                                if (expandedPlan) {
                                    const pays = await InstallmentService.getPaymentsByPlan(expandedPlan);
                                    setPayments(pays);
                                }
                            } catch (e) {
                                console.error(e);
                                showToast('Failed to link payment', 'error');
                            }
                        }
                        setPayingPayment(null);
                        setPayingPlan(null);
                    }}
                />
            )}
        </div>
    );
}
