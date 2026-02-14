import React, { createContext, useContext, useEffect, useState } from 'react';
import { SettingsService } from '../../services/SettingsService';
import { setGlobalDateFormat } from '../../utils/dateUtils';

interface DateContextType {
    dateFormat: string;
    refreshFormat: () => Promise<void>;
}

const DateContext = createContext<DateContextType | undefined>(undefined);

export const DateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [dateFormat, setDateFormat] = useState('dd/MM/yyyy');
    const [loading, setLoading] = useState(true);

    const refreshFormat = async () => {
        try {
            const settings = await SettingsService.getSettings();
            setDateFormat(settings.date_format);
            setGlobalDateFormat(settings.date_format);
        } catch (e) {
            console.error('Failed to load date format:', e);
        }
    };

    useEffect(() => {
        refreshFormat().then(() => setLoading(false));
    }, []);

    if (loading) return null; // Or a loading spinner

    return (
        <DateContext.Provider value={{ dateFormat, refreshFormat }}>
            {children}
        </DateContext.Provider>
    );
};

export const useDateFormat = () => {
    const context = useContext(DateContext);
    if (!context) throw new Error('useDateFormat must be used within DateProvider');
    return context;
};
