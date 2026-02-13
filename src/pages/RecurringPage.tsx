import { useState, useEffect } from 'react';
import { RecurringService } from '../services/RecurringService';
import type { RecurringRule } from '../services/RecurringService';
import { RecurringForm } from '../components/recurring/RecurringForm';
import { Plus, Edit, Trash, Calendar, RefreshCw } from 'lucide-react';
import { CategoryService } from '../services/CategoryService';
import { AccountService } from '../services/AccountService';
import { useToast } from '../components/common/Toast';

export default function RecurringPage() {
    const [rules, setRules] = useState<RecurringRule[]>([]);
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
        const [r, c, a] = await Promise.all([
            RecurringService.getAll(),
            CategoryService.getAll(),
            AccountService.getAll()
        ]);
        setRules(r);

        const cm: Record<string, string> = {};
        c.forEach(cat => cm[cat.id] = cat.name);
        setCatNames(cm);

        const am: Record<string, string> = {};
        a.forEach(acc => am[acc.id] = acc.name);
        setAccNames(am);

        setLoading(false);
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
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Math.abs(amount));
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
                {rules.map(rule => (
                    <div key={rule.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 relative group">
                        <div className="flex justify-between items-start mb-2">
                            <div className="font-semibold text-lg text-white">{rule.name}</div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(rule)} className="text-gray-400 hover:text-white">
                                    <Edit size={16} />
                                </button>
                                <button onClick={() => handleDelete(rule.id)} className="text-gray-400 hover:text-red-500">
                                    <Trash size={16} />
                                </button>
                            </div>
                        </div>

                        <div className={`text-xl font-bold mb-4 ${rule.amount >= 0 ? 'text-green-500' : 'text-white'}`}>
                            {formatMoney(rule.amount)}
                        </div>

                        <div className="space-y-2 text-sm text-gray-400">
                            <div className="flex items-center gap-2">
                                <Calendar size={14} />
                                <span>Day {rule.day_of_month} of month</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Account</span>
                                <span className="text-gray-300">{accNames[rule.account_id]}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Category</span>
                                <span className="text-gray-300">{catNames[rule.category_id]}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Period</span>
                                <span className="text-gray-300">
                                    {rule.start_month} {rule.end_month ? `to ${rule.end_month}` : '➔ ∞'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Status</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${rule.default_status === 'posted' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                    {rule.default_status}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

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
