import { parseISO, isValid, format as dfFormat } from 'date-fns';

let currentDateFormat = 'dd/MM/yyyy';

/**
 * Sets the global date format to be used by formatDisplayDate.
 */
export const setGlobalDateFormat = (format: string) => {
    if (format && typeof format === 'string') {
        currentDateFormat = format;
    }
};

/**
 * Formats a date string or Date object.
 * Defaults to the global format for consistent display.
 * @param date The date to format (Date object or YYYY-MM-DD string)
 * @param options Optional Intl.DateTimeFormatOptions for customized display (e.g. only day/month)
 */
export const formatDisplayDate = (date: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions): string => {
    if (!date) return 'N/A';

    let d: Date;
    if (typeof date === 'string') {
        if (date.includes('T')) {
            d = new Date(date);
        } else {
            // Check if it's YYYY-MM
            if (date.length === 7 && date.includes('-')) {
                d = parseISO(date + '-01');
            } else {
                d = parseISO(date);
            }
        }
    } else {
        d = date;
    }

    if (!isValid(d)) return typeof date === 'string' ? date : 'Invalid Date';

    // If options are provided (like {day: '2-digit', month: '2-digit'} for TransactionList),
    // we use en-GB as it defaults to dd/MM order which matches the user's base preference.
    if (options) {
        try {
            return d.toLocaleDateString('en-GB', options);
        } catch (e) {
            // Fallback to date-fns if Intl fails
            return dfFormat(d, currentDateFormat || 'dd/MM/yyyy');
        }
    }

    // Standard format
    return dfFormat(d, currentDateFormat || 'dd/MM/yyyy');
};

/**
 * Formats a date into a Month Year string (e.g. "February 2026")
 */
export const formatMonthYear = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    let d = typeof date === 'string' ? (date.includes('T') ? new Date(date) : parseISO(date.length === 7 ? date + '-01' : date)) : date;
    if (!isValid(d)) return 'Invalid Date';

    try {
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch (e) {
        return dfFormat(d, 'MMMM yyyy');
    }
};

/**
 * Formats a date into a short Month Year string (e.g. "02/2026")
 */
export const formatShortMonthYear = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    let d = typeof date === 'string' ? (date.includes('T') ? new Date(date) : parseISO(date.length === 7 ? date + '-01' : date)) : date;
    if (!isValid(d)) return 'Invalid Date';

    if (currentDateFormat && currentDateFormat.startsWith('yyyy')) {
        return dfFormat(d, 'yyyy-MM');
    }
    return dfFormat(d, 'MM/yyyy');
};

/**
 * Formats a date into a full timestamp using English standard
 */
export const formatFullDateTime = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    let d = typeof date === 'string' ? (date.includes('T') ? new Date(date) : parseISO(date)) : date;
    if (!isValid(d)) return 'Invalid Date';

    // Full date format can also be influenced by preference
    const timePart = ' HH:mm:ss';
    return dfFormat(d, (currentDateFormat || 'dd/MM/yyyy') + timePart);
};
