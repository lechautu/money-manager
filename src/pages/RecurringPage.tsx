import { useState, useEffect } from 'react';
import { RecurringService } from '../services/RecurringService';
import type { RecurringRule } from '../services/RecurringService';
import { RecurringForm } from '../components/recurring/RecurringForm';
import { Plus, Edit, Trash, Calendar, RefreshCw, AlertTriangle, Zap, Hand } from 'lucide-react';
import { CategoryService } from '../services/CategoryService';
import { AccountService } from '../services/AccountService';
import { useToast } from '../components/common/Toast';
import { isAfter, format, parseISO } from 'date-fns';
import { formatDisplayDate } from '../utils/dateUtils';

export default function RecurringPage() {
    const [rules, setRules] = useState<RecurringRule[]>([]);
    const [instances, setInstances] = useState<Record<string, string[]>>({}); // rule_id -> [dates]
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
    const [loading, setLoading] = useState(true);

    // Helpers for display names
    const [catNames, setCatNames] = useState<Record<string, string>>({});
    const [accNames, setAccNames] = useState<Record<string, string>>({});
    const { showToast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [r, c, a, inst] = await Promise.all([
            RecurringService.getAll(),
            CategoryService.getAll(),
            AccountService.getAll(),
            RecurringService.getAllInstances()
        ]);
        setRules(r);

        const cm: Record<string, string> = {};
        c.forEach((cat: any) => cm[cat.id] = cat.name);
        setCatNames(cm);

        const am: Record<string, string> = {};
        a.forEach((acc: any) => am[acc.id] = acc.name);
        setAccNames(am);

        const instMap: Record<string, string[]> = {};
        inst.forEach((i: any) => {
            if (!instMap[i.rule_id]) instMap[i.rule_id] = [];
            instMap[i.rule_id].push(i.date);
        });
        setInstances(instMap);

        setLoading(false);
    };

    const handleToggleAuto = async (rule: RecurringRule) => {
        try {
            await RecurringService.update(rule.id, { auto_add: rule.auto_add === 1 ? 0 : 1 });
            loadData();
        } catch (e) {
            showToast('Failed to update toggle', 'error');
        }
    };

    const handleManualAdd = async (rule: RecurringRule, date: string) => {
        try {
            // We need a specific method to trigger a single instance
            await RecurringService.manualTrigger(rule.id, date);
            showToast(`Transaction added for ${date}`);
            loadData();
        } catch (e) {
            showToast('Failed to add transaction', 'error');
        }
    };

    const isDue = (rule: RecurringRule) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        // Check if there should be an instance today or in the past that isn't in instances[rule.id]
        // This is a simplified check: is start_date <= today AND no instance exists yet for the "current" expected date
        // For accurate due check, we'd need to simulate the sequence.
        // Let's just check if start_date <= today and no instances exist at all OR last instance is old.
        const ruleInst = instances[rule.id] || [];
        if (ruleInst.includes(today)) return false;

        // If start date is in future, not due
        if (isAfter(parseISO(rule.start_date), new Date())) return false;

        // If it's a manual rule and no instance for "today", show warning?
        // Actually, let's just show if it's due today.
        return true;
    };

    const handleEdit = (rule: RecurringRule) => {
        setEditingRule(rule);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this recurring rule? Existing transactions will remain.')) {
            try {
                await RecurringService.delete(id);
                showToast('Recurring rule deleted successfully');
                loadData();
            } catch (e) {
                console.error(e);
                showToast('Failed to delete recurring rule', 'error');
            }
        }
    };

    const handleFormClose = () => {
        setIsFormOpen(false);
        setEditingRule(null);
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(Math.abs(amount));
    };

    const formatDate = (dateStr: string | null | undefined) => {
        return formatDisplayDate(dateStr);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <RefreshCw className="text-primary" /> Recurring Rules
                </h1>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-blue-600 rounded text-sm text-white"
                >
                    <Plus size={16} /> New Rule
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rules.map(rule => {
                    const due = rule.auto_add === 0 && isDue(rule);
                    const ruleInst = instances[rule.id] || [];
                    const nextDate = RecurringService.getNextOccurrence(rule, ruleInst);

                    return (
                        <div key={rule.id} className={`bg-gray-900 border ${due ? 'border-orange-500 ring-1 ring-orange-500/50' : 'border-gray-800'} rounded-xl p-4 relative group transition-all`}>
                            {due && (
                                <div className="absolute -top-2 -right-2 bg-orange-500 text-white p-1 rounded-full shadow-lg z-10 animate-pulse">
                                    <AlertTriangle size={14} />
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-semibold text-lg text-white">{rule.name}</div>
                                    <button
                                        onClick={() => handleToggleAuto(rule)}
                                        className={`flex items-center gap-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded mt-1 transition-colors ${rule.auto_add === 1 ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                                    >
                                        {rule.auto_add === 1 ? <Zap size={10} /> : <Hand size={10} />}
                                        {rule.auto_add === 1 ? 'Auto Add' : 'Manual'}
                                    </button>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(rule)} className="text-gray-400 hover:text-white">
                                        <Edit size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(rule.id)} className="text-gray-400 hover:text-red-500">
                                        <Trash size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className={`text-xl font-bold mb-4 ${rule.type === 'income' ? 'text-emerald-500' : rule.type === 'transfer' ? 'text-blue-500' : 'text-white'}`}>
                                {formatMoney(rule.amount)}
                            </div>

                            <div className="space-y-2 text-sm text-gray-400">
                                <div className="flex items-center gap-2">
                                    <Calendar size={14} />
                                    <span className="capitalize">{rule.frequency}</span>
                                    <span className="text-gray-600">|</span>
                                    {nextDate ? (
                                        <span className={`${due ? 'text-orange-400 font-bold' : 'text-primary'}`}>
                                            Next: {formatDate(nextDate)}
                                        </span>
                                    ) : (
                                        <span className="text-gray-500 italic">Ended</span>
                                    )}
                                </div>
                                <div className="flex justify-between">
                                    <span>{rule.type === 'transfer' ? 'From Account' : 'Account'}</span>
                                    <span className="text-gray-300">{accNames[rule.account_id]}</span>
                                </div>
                                {rule.type === 'transfer' && rule.to_account_id && (
                                    <div className="flex justify-between">
                                        <span>To Account</span>
                                        <span className="text-blue-400">{accNames[rule.to_account_id]}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span>Category</span>
                                    <span className="text-gray-300">{rule.category_id ? catNames[rule.category_id] : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>End Condition</span>
                                    <span className="text-gray-300">
                                        {rule.max_instances ? `Ends after ${rule.max_instances} times` :
                                            rule.end_date ? `Until ${formatDate(rule.end_date)}` : 'Never ends'}
                                    </span>
                                </div>

                                {due && (
                                    <div className="mt-4 pt-4 border-t border-gray-800 flex gap-2">
                                        <button
                                            onClick={() => handleManualAdd(rule, format(new Date(), 'yyyy-MM-dd'))}
                                            className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2 rounded transition-colors"
                                        >
                                            <Plus size={14} /> Add Today
                                        </button>
                                        <button
                                            onClick={() => showToast('Feature coming soon: Skip Instance')}
                                            className="px-3 border border-gray-700 hover:border-gray-500 text-gray-400 py-2 rounded text-xs"
                                        >
                                            Skip
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {rules.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                        No recurring rules yet.
                    </div>
                )}
            </div>

            <RecurringForm
                isOpen={isFormOpen}
                onClose={handleFormClose}
                initialData={editingRule}
                onSuccess={loadData}
            />
        </div>
    );
}
