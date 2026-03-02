import { useState, useEffect, useRef } from 'react';
import { PayeeService } from '../../services/PayeeService';
import type { Payee } from '../../services/PayeeService';
import { Search, ChevronDown, Plus, X, Check } from 'lucide-react';

interface PayeePickerProps {
    value: string | null;
    onChange: (payeeId: string | null) => void;
    payees?: Payee[];
}

export function PayeePicker({ value, onChange, payees: externalPayees }: PayeePickerProps) {
    const [payees, setPayees] = useState<Payee[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (externalPayees) {
            setPayees(externalPayees);
        } else {
            loadPayees();
        }
    }, [externalPayees]);

    const loadPayees = async () => {
        const all = await PayeeService.getAll(true);
        setPayees(all);
    };

    const activePayees = payees.filter(p => !p.is_archived);
    const selectedPayee = payees.find(p => p.id === value);

    const filtered = search.trim()
        ? activePayees.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()))
        : activePayees;

    const normalizedSearch = search.trim().toLowerCase();
    const exactMatch = activePayees.some(p => p.normalized_name === normalizedSearch);
    const showAddOption = search.trim().length > 0 && !exactMatch;

    const totalOptions = filtered.length + (showAddOption ? 1 : 0);

    useEffect(() => {
        setHighlightIndex(0);
    }, [search, isOpen]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (payeeId: string) => {
        onChange(payeeId);
        setIsOpen(false);
        setSearch('');
    };

    const handleCreate = async () => {
        if (!search.trim()) return;
        try {
            const created = await PayeeService.create(search.trim());
            await loadPayees();
            onChange(created.id);
            setIsOpen(false);
            setSearch('');
        } catch (err) {
            console.error('Failed to create payee', err);
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        setSearch('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(prev => Math.min(prev + 1, totalOptions - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightIndex < filtered.length) {
                handleSelect(filtered[highlightIndex].id);
            } else if (showAddOption) {
                handleCreate();
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setSearch('');
        } else if (e.key === 'Tab') {
            if (highlightIndex < filtered.length) {
                handleSelect(filtered[highlightIndex].id);
            }
            setIsOpen(false);
            setSearch('');
        }
    };

    return (
        <div ref={dropdownRef} className="relative">
            <label className="block text-xs font-medium text-gray-400 mb-1">Payee</label>

            {/* Trigger */}
            <div
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white cursor-pointer flex items-center justify-between hover:border-gray-500 transition-colors"
                onClick={() => {
                    setIsOpen(!isOpen);
                    setTimeout(() => inputRef.current?.focus(), 50);
                }}
            >
                <span className={selectedPayee ? 'text-white' : 'text-gray-500'}>
                    {selectedPayee ? (
                        <>
                            {selectedPayee.name}
                            {selectedPayee.is_archived ? (
                                <span className="ml-2 text-[10px] text-amber-500">(Archived)</span>
                            ) : null}
                        </>
                    ) : 'Select payee...'}
                </span>
                <div className="flex items-center gap-1">
                    {value && (
                        <button
                            onClick={handleClear}
                            className="text-gray-500 hover:text-white p-0.5 rounded transition-colors"
                        >
                            <X size={12} />
                        </button>
                    )}
                    <ChevronDown size={14} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-700">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-500" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search or add payee..."
                                className="w-full bg-gray-900 border border-gray-700 rounded pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary placeholder-gray-600"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.length === 0 && !showAddOption && (
                            <div className="px-3 py-4 text-center text-xs text-gray-500">No matching payees</div>
                        )}

                        {filtered.map((p, i) => (
                            <button
                                key={p.id}
                                onClick={() => handleSelect(p.id)}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${i === highlightIndex ? 'bg-primary/20 text-white' : 'text-gray-300 hover:bg-gray-700/50'
                                    }`}
                            >
                                <span>{p.name}</span>
                                {p.id === value && <Check size={14} className="text-primary" />}
                            </button>
                        ))}

                        {/* Inline Add Option */}
                        {showAddOption && (
                            <button
                                onClick={handleCreate}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors border-t border-gray-700 ${highlightIndex === filtered.length ? 'bg-emerald-900/20 text-emerald-400' : 'text-emerald-500 hover:bg-emerald-900/10'
                                    }`}
                            >
                                <Plus size={14} />
                                <span>Add "{search.trim()}"</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
