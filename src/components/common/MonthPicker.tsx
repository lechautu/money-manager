
import { useState, useRef, useEffect } from "react";
import { format, subMonths, addMonths, setMonth, setYear, getYear, getMonth } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface MonthPickerProps {
    currentDate: Date;
    onChange: (date: Date) => void;
}

export function MonthPicker({ currentDate, onChange }: MonthPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(currentDate); // Used for navigating years
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        // Reset view date when closed or when current date changes externally
        if (isOpen) {
            setViewDate(currentDate);
        }
    }, [isOpen, currentDate]);

    const handleMonthSelect = (monthIndex: number) => {
        const newDate = setMonth(setYear(currentDate, getYear(viewDate)), monthIndex);
        onChange(newDate);
        setIsOpen(false);
    };

    const nextYear = () => setViewDate(addMonths(viewDate, 12));
    const prevYear = () => setViewDate(subMonths(viewDate, 12));

    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    return (
        <div className="relative" ref={containerRef}>
            <div className="flex items-center gap-2 bg-gray-800/50 p-1 rounded-lg border border-gray-700">
                <button
                    onClick={() => onChange(subMonths(currentDate, 1))}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                >
                    <ChevronLeft size={18} />
                </button>

                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="font-bold text-sm min-w-32 text-center text-white capitalize hover:bg-gray-700/50 rounded px-2 py-1 transition-colors flex items-center justify-center gap-2"
                >
                    <CalendarIcon size={14} className="text-gray-400" />
                    {format(currentDate, "MMMM yyyy")}
                </button>

                <button
                    onClick={() => onChange(addMonths(currentDate, 1))}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                >
                    <ChevronRight size={18} />
                </button>
            </div>

            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-200 w-64">
                    <div className="flex justify-between items-center mb-4">
                        <button
                            onClick={prevYear}
                            className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="font-bold text-white">{format(viewDate, "yyyy")}</span>
                        <button
                            onClick={nextYear}
                            className="p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {months.map((month, index) => {
                            const isSelected = getMonth(currentDate) === index && getYear(currentDate) === getYear(viewDate);
                            const isCurrentMonth = getMonth(new Date()) === index && getYear(new Date()) === getYear(viewDate);

                            return (
                                <button
                                    key={month}
                                    onClick={() => handleMonthSelect(index)}
                                    className={`
                                        py-2 rounded text-sm font-medium transition-colors
                                        ${isSelected
                                            ? "bg-primary text-white"
                                            : isCurrentMonth
                                                ? "bg-gray-800 text-primary border border-primary/30"
                                                : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                        }
                                    `}
                                >
                                    {month}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
