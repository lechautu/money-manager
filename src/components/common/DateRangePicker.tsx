import { useState, useRef, useEffect } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { format, subMonths } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';
import 'react-day-picker/dist/style.css';

interface DateRangePickerProps {
    range: { start: string; end: string } | null;
    onChange: (range: { start: string; end: string } | null) => void;
    placeholder?: string;
}

export function DateRangePicker({ range, onChange, placeholder = "Select date range" }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selected: DateRange | undefined = range ? {
        from: new Date(range.start),
        to: new Date(range.end)
    } : undefined;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (newRange: DateRange | undefined) => {
        if (!newRange) {
            onChange(null);
            return;
        }

        if (newRange.from && newRange.to) {
            onChange({
                start: format(newRange.from, 'yyyy-MM-dd'),
                end: format(newRange.to, 'yyyy-MM-dd')
            });
            // Don't close immediately to let them see the selection
        } else if (newRange.from) {
            onChange({
                start: format(newRange.from, 'yyyy-MM-dd'),
                end: format(newRange.from, 'yyyy-MM-dd')
            });
        }
    };

    const displayText = range
        ? `${formatDisplayDate(range.start)} - ${formatDisplayDate(range.end)}`
        : placeholder;

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white hover:border-primary/50 transition-colors"
            >
                <div className="flex items-center gap-2 truncate">
                    <CalendarIcon size={14} className="text-gray-400" />
                    <span className={range ? 'text-white' : 'text-gray-500'}>{displayText}</span>
                </div>
                {range && (
                    <X
                        size={14}
                        className="text-gray-500 hover:text-white"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange(null);
                        }}
                    />
                )}
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200 origin-top-left">
                    <style>{`
                        .rdp {
                            --rdp-cell-size: 32px;
                            --rdp-accent-color: var(--color-primary, #3b82f6);
                            --rdp-background-color: #1e293b;
                            --rdp-outline: 2px solid var(--rdp-accent-color);
                            --rdp-outline-prefix: 2px solid var(--rdp-accent-color);
                            margin: 0;
                        }
                        .rdp-day_selected {
                            background-color: var(--rdp-accent-color) !important;
                            color: white !important;
                        }
                        .rdp-day_range_middle {
                            background-color: rgba(59, 130, 246, 0.2) !important;
                            color: #60a5fa !important;
                        }
                        .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                            background-color: #334155 !important;
                        }
                        .rdp-head_cell {
                            font-size: 0.75rem;
                            font-weight: 600;
                            color: #64748b;
                        }
                        .rdp-nav_button {
                            color: #94a3b8;
                        }
                        .rdp-caption_label {
                            font-size: 0.875rem;
                            font-weight: 600;
                            color: #f1f5f9;
                        }
                    `}</style>
                    <DayPicker
                        mode="range"
                        selected={selected}
                        onSelect={handleSelect}
                        numberOfMonths={3}
                        defaultMonth={subMonths(new Date(), 1)}
                        className="text-white"
                    />
                    <div className="mt-2 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="text-xs text-primary font-semibold hover:underline px-2 py-1"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
