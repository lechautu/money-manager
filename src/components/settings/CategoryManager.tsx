import { useState, useEffect } from 'react';
import { CategoryService } from '../../services/CategoryService';
import type { Category, SubCategory } from '../../services/CategoryService';
import { Plus, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import { useToast } from '../common/Toast';


export function CategoryManager() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<Record<string, SubCategory[]>>({});

    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [newCatName, setNewCatName] = useState('');
    const [newSubCatName, setNewSubCatName] = useState('');
    const [selectedCatId, setSelectedCatId] = useState<string | null>(null); // For adding subcat
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [movingSubId, setMovingSubId] = useState<string | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        const cats = await CategoryService.getAll();
        setCategories(cats);
        const subs: Record<string, SubCategory[]> = {};
        for (const cat of cats) {
            const sub = await CategoryService.getSubCategories(cat.id);
            subs[cat.id] = sub;
        }
        setSubCategories(subs);
    };

    const toggleExpand = (id: string) => {
        const next = new Set(expanded);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpanded(next);
    };

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCatName.trim()) return;
        try {
            await CategoryService.createCategory(newCatName.trim());
            showToast('Category created successfully');
            setNewCatName('');
            loadCategories();
        } catch (e) {
            showToast('Failed to create category', 'error');
        }
    };

    const handleAddSubCategory = async (e: React.FormEvent, categoryId: string) => {
        e.preventDefault();
        if (!newSubCatName.trim()) return;
        try {
            await CategoryService.createSubCategory(categoryId, newSubCatName.trim());
            showToast('Sub-category created successfully');
            setNewSubCatName('');
            setSelectedCatId(null);
            loadCategories();
        } catch (e) {
            showToast('Failed to create sub-category', 'error');
        }
    };

    const startEdit = (id: string, currentName: string) => {
        setEditingId(id);
        setEditName(currentName);
    };

    const handleUpdate = async (e: React.FormEvent, type: 'category' | 'subcategory') => {
        e.preventDefault();
        if (!editingId || !editName.trim()) return;

        try {
            if (type === 'category') {
                await CategoryService.updateCategory(editingId, editName.trim());
            } else {
                await CategoryService.updateSubCategory(editingId, editName.trim());
            }
            showToast('Updated successfully');
            setEditingId(null);
            setEditName('');
            loadCategories();
        } catch (error) {
            console.error(error);
            showToast('Failed to update', 'error');
        }
    };

    const handleDelete = async (id: string, name: string, type: 'category' | 'subcategory') => {
        if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;

        try {
            if (type === 'category') {
                await CategoryService.deleteCategory(id);
            } else {
                await CategoryService.deleteSubCategory(id);
            }
            showToast('Deleted successfully');
            loadCategories();
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Failed to delete', 'error');
        }
    };

    const handleMoveSubCategory = async (subId: string, newCatId: string) => {
        try {
            await CategoryService.moveSubCategory(subId, newCatId);
            showToast('Moved sub-category successfully');
            setMovingSubId(null);
            loadCategories();
        } catch (error) {
            console.error(error);
            showToast('Failed to move sub-category', 'error');
        }
    };

    return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Categories</h2>
            </div>

            <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="New Category Name"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                />
                <button type="submit" className="bg-primary hover:bg-blue-600 text-white px-3 py-2 rounded">
                    <Plus size={16} />
                </button>
            </form>

            <div className="space-y-2">
                {categories.map(cat => (
                    <div key={cat.id} className="bg-gray-800/50 rounded border border-gray-700 overflow-hidden">
                        <div className="flex items-center p-3 gap-2 group">
                            <button onClick={() => toggleExpand(cat.id)} className="text-gray-400 hover:text-white">
                                {expanded.has(cat.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>

                            {editingId === cat.id ? (
                                <form onSubmit={(e) => handleUpdate(e, 'category')} className="flex-1 flex gap-2">
                                    <input
                                        autoFocus
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-0.5 text-sm text-white"
                                    />
                                    <button type="submit" className="text-xs text-emerald-500 hover:text-emerald-400">Save</button>
                                    <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-400">Cancel</button>
                                </form>
                            ) : (
                                <>
                                    <span className="font-medium flex-1 cursor-pointer" onClick={() => toggleExpand(cat.id)}>{cat.name}</span>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => startEdit(cat.id, cat.name)}
                                            className="text-xs text-gray-500 hover:text-blue-400"
                                        >
                                            Rename
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat.id, cat.name, 'category')}
                                            className="text-xs text-red-500 hover:text-red-400"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {expanded.has(cat.id) && (
                            <div className="pl-9 pr-3 pb-3">
                                {/* Subcategories */}
                                <div className="space-y-1 mb-2">
                                    {subCategories[cat.id]?.map(sub => (
                                        <div key={sub.id}>
                                            <div className="text-sm text-gray-400 flex items-center gap-2 py-1 group/sub">
                                                <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                                                {editingId === sub.id ? (
                                                    <form onSubmit={(e) => handleUpdate(e, 'subcategory')} className="flex-1 flex gap-2">
                                                        <input
                                                            autoFocus
                                                            value={editName}
                                                            onChange={e => setEditName(e.target.value)}
                                                            className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-0.5 text-xs text-white"
                                                        />
                                                        <button type="submit" className="text-xs text-emerald-500 hover:text-emerald-400">Save</button>
                                                        <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-400">Cancel</button>
                                                    </form>
                                                ) : (
                                                    <>
                                                        <span className="flex-1">{sub.name}</span>
                                                        <div className="flex gap-3 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => setMovingSubId(movingSubId === sub.id ? null : sub.id)}
                                                                className={`text-xs transition-colors ${movingSubId === sub.id ? 'text-amber-500 font-bold' : 'text-gray-600 hover:text-amber-400'}`}
                                                            >
                                                                Move
                                                            </button>
                                                            <button
                                                                onClick={() => startEdit(sub.id, sub.name)}
                                                                className="text-xs text-gray-600 hover:text-blue-400"
                                                            >
                                                                Rename
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(sub.id, sub.name, 'subcategory')}
                                                                className="text-xs text-red-500 hover:text-red-400"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            {movingSubId === sub.id && (
                                                <div className="ml-4 mb-3 p-2 bg-gray-800/50 rounded border border-gray-700/50 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <div className="text-[10px] text-gray-500 mb-2 uppercase font-bold tracking-wider">Move to category:</div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                        {categories.filter(c => c.id !== cat.id).map(c => (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => handleMoveSubCategory(sub.id, c.id)}
                                                                className="text-left px-2 py-1 text-[10px] bg-gray-900 hover:bg-primary/20 hover:text-primary rounded truncate border border-gray-700 transition-colors text-gray-300"
                                                            >
                                                                {c.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={() => setMovingSubId(null)}
                                                        className="w-full mt-2 py-1 text-[10px] text-gray-500 hover:text-white transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {subCategories[cat.id]?.length === 0 && <div className="text-xs text-gray-500 italic">No sub-categories</div>}
                                </div>

                                {/* Add Sub Form */}
                                {selectedCatId === cat.id ? (
                                    <form onSubmit={(e) => handleAddSubCategory(e, cat.id)} className="flex gap-2 mt-2">
                                        <input
                                            type="text"
                                            value={newSubCatName}
                                            onChange={e => setNewSubCatName(e.target.value)}
                                            placeholder="Sub-category name"
                                            className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                            autoFocus
                                        />
                                        <button type="submit" className="text-primary hover:text-white"><Plus size={16} /></button>
                                        <button type="button" onClick={() => setSelectedCatId(null)} className="text-gray-500 hover:text-white text-xs">Cancel</button>
                                    </form>
                                ) : (
                                    <button
                                        onClick={() => setSelectedCatId(cat.id)}
                                        className="text-xs text-primary hover:text-blue-400 flex items-center gap-1 mt-1"
                                    >
                                        <Plus size={12} /> Add Sub-category
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div >
    );
}
