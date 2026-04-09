/**
 * Formats a number as a currency string.
 * Uses strict formatting for values over 1000 (e.g. $1.5k, $2.4M) to save space in UI components.
 * 
 * @param value - The numeric value to format
 * @param currency - The currency code (default: 'USD')
 * @param locale - The locale to use for formatting (default: 'en-US')
 * @returns The formatted currency string
 */
export function formatCurrency(value: number, currency: string = 'USD', locale: string = 'en-US'): string {
    if (value === null || value === undefined || isNaN(value)) {
        return '—';
    }

    const symbol = currency === 'EUR' ? '€' : '$'; // Simple symbol mapping for now

    // Compact formatting for large numbers
    if (value >= 1000000) {
        return `${symbol}${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 10000) {
        return `${symbol}${Math.round(value / 1000)}k`;
    }

    // Standard formatting for smaller numbers
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

/**
 * Formats a value as a percentage.
 * 
 * @param value - The numeric value (e.g. 0.125 for 12.5%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercent(value: number, decimals: number = 1): string {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Formats a date string into a localized readable format.
 * 
 * @param dateStr - ISO date string
 * @param formatType - 'short', 'medium', or 'long'
 * @returns Formatted date string
 */
export function formatDate(dateStr: string, formatType: 'short' | 'medium' | 'long' = 'medium'): string {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '—';

        const options: Intl.DateTimeFormatOptions = {};
        if (formatType === 'short') {
            options.month = 'numeric';
            options.day = 'numeric';
            options.year = '2-digit';
        } else if (formatType === 'medium') {
            options.month = 'short';
            options.day = 'numeric';
            options.year = 'numeric';
        } else {
            options.month = 'long';
            options.day = 'numeric';
            options.year = 'numeric';
            options.hour = '2-digit';
            options.minute = '2-digit';
        }

        return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch (e) {
        return '—';
    }
}
