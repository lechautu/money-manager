import { useState, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { format as dfFormat } from 'date-fns';
import { SettingsService } from '../../services/SettingsService';
import { useDateFormat } from '../common/DateProvider';
import { useToast } from '../common/Toast';

const FORMAT_OPTIONS = [
    { label: 'DD/MM/YYYY (Standard)', value: 'dd/MM/yyyy' },
    { label: 'MM/DD/YYYY (US)', value: 'MM/dd/yyyy' },
    { label: 'YYYY-MM-DD (ISO)', value: 'yyyy-MM-dd' },
    { label: 'DD.MM.YYYY (European)', value: 'dd.MM.yyyy' },
    { label: 'YYYY/MM/DD', value: 'yyyy/MM/dd' },
    { label: 'MMM d, yyyy (Short Month)', value: 'MMM d, yyyy' },
    { label: 'MMMM d, yyyy (Full Month)', value: 'MMMM d, yyyy' },
    { label: 'd MMM yyyy', value: 'd MMM yyyy' },
];

export function DateFormatSettings() {
    const { dateFormat, refreshFormat } = useDateFormat();
    const { showToast } = useToast();
    const [selected, setSelected] = useState(dateFormat);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setSelected(dateFormat);
    }, [dateFormat]);

    const handleSave = async (format: string) => {
        setSaving(true);
        try {
            await SettingsService.setDateFormat(format);
            await refreshFormat();
            setSelected(format);
            showToast('Date format updated');
        } catch (e) {
            console.error(e);
            showToast('Failed to update format', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-sm transition-all hover:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white leading-tight">Date Format</h2>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Display preferences</p>
                    </div>
                </div>

                <div className="relative min-w-[200px]">
                    <select
                        value={selected}
                        onChange={(e) => handleSave(e.target.value)}
                        disabled={saving}
                        className="w-full appearance-none bg-gray-800 border border-gray-700 text-gray-200 text-xs font-bold py-2 pl-3 pr-10 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all cursor-pointer disabled:opacity-50"
                    >
                        {FORMAT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                        <ChevronDown size={14} />
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-800/50 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-600 uppercase">Live Preview</span>
                    <span className="text-[10px] text-gray-500 italic mt-0.5">Based on today's date</span>
                </div>
                <div className="px-3 py-1.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-sm font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {dfFormat(new Date(), selected)}
                    </span>
                </div>
            </div>
        </div>
    );
}
