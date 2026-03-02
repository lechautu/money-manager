import { useState, useEffect } from 'react';
import { PayeeService } from '../../services/PayeeService';
import type { Payee } from '../../services/PayeeService';
import { Plus, Archive, ArchiveRestore, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../common/Toast';

export function PayeeManager() {
    const [payees, setPayees] = useState<Payee[]>([]);
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        loadPayees();
    }, []);

    const loadPayees = async () => {
        const data = await PayeeService.getAll(true);
        setPayees(data);
    };

    const activePayees = payees.filter(p => !p.is_archived);
    const archivedPayees = payees.filter(p => p.is_archived);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        try {
            await PayeeService.create(newName.trim());
            showToast('Payee created successfully');
            setNewName('');
            loadPayees();
        } catch (err) {
            showToast('Failed to create payee', 'error');
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId || !editName.trim()) return;
        try {
            await PayeeService.update(editingId, editName.trim());
            showToast('Payee updated');
            setEditingId(null);
            setEditName('');
            loadPayees();
        } catch (err) {
            showToast('Failed to update payee', 'error');
        }
    };

    const handleArchive = async (id: string, archive: boolean) => {
        try {
            await PayeeService.archive(id, archive);
            showToast(archive ? 'Payee archived' : 'Payee restored');
            loadPayees();
        } catch (err) {
            showToast('Failed to update payee', 'error');
        }
    };

    const startEdit = (id: string, name: string) => {
        setEditingId(id);
        setEditName(name);
    };

    const renderPayeeRow = (payee: Payee) => (
        <div key={payee.id} className="flex items-center p-3 gap-2 group">
            {editingId === payee.id ? (
                <form onSubmit={handleUpdate} className="flex-1 flex gap-2">
                    <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-primary"
                    />
                    <button type="submit" className="text-xs text-emerald-500 hover:text-emerald-400">Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-400">Cancel</button>
                </form>
            ) : (
                <>
                    <span className="font-medium flex-1 text-sm">{payee.name}</span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => startEdit(payee.id, payee.name)}
                            className="text-xs text-gray-500 hover:text-blue-400"
                        >
                            Rename
                        </button>
                        {payee.is_archived ? (
                            <button
                                onClick={() => handleArchive(payee.id, false)}
                                className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1"
                            >
                                <ArchiveRestore size={12} /> Restore
                            </button>
                        ) : (
                            <button
                                onClick={() => handleArchive(payee.id, true)}
                                className="text-xs text-gray-500 hover:text-amber-400 flex items-center gap-1"
                            >
                                <Archive size={12} /> Archive
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Payees</h2>
                <span className="text-xs text-gray-500">{activePayees.length} active, {archivedPayees.length} archived</span>
            </div>

            <form onSubmit={handleAdd} className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="New Payee Name"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                />
                <button type="submit" className="bg-primary hover:bg-blue-600 text-white px-3 py-2 rounded transition-colors">
                    <Plus size={16} />
                </button>
            </form>

            {/* Active Payees */}
            <div className="space-y-1">
                {activePayees.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm italic">No payees yet. Add one above!</div>
                )}
                {activePayees.map(renderPayeeRow)}
            </div>

            {/* Archived Section */}
            {archivedPayees.length > 0 && (
                <div className="mt-6 border-t border-gray-800 pt-4">
                    <button
                        onClick={() => setShowArchived(!showArchived)}
                        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2"
                    >
                        {showArchived ? <EyeOff size={12} /> : <Eye size={12} />}
                        {showArchived ? 'Hide' : 'Show'} Archived ({archivedPayees.length})
                    </button>
                    {showArchived && (
                        <div className="space-y-1 opacity-60">
                            {archivedPayees.map(renderPayeeRow)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
