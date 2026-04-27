/**
 * Intl-based number formatters.
 */

export const formatNumber = (
    value: number,
    locale = 'de-DE',
    options?: Intl.NumberFormatOptions,
): string => {
    try {
        return new Intl.NumberFormat(locale, options).format(value);
    } catch {
        return String(value);
    }
};

export const formatCurrency = (
    value: number,
    locale = 'de-DE',
    currency = 'EUR',
    fractionDigits = 2,
): string =>
    formatNumber(value, locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });

export const formatPercent = (value: number, locale = 'de-DE', fractionDigits = 1): string =>
    formatNumber(value, locale, {
        style: 'percent',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });

export const formatCompact = (value: number, locale = 'de-DE'): string => {
    if (Math.abs(value) >= 1_000_000) return formatNumber(value / 1_000_000, locale, { maximumFractionDigits: 1 }) + 'M';
    if (Math.abs(value) >= 1_000) return formatNumber(value / 1_000, locale, { maximumFractionDigits: 1 }) + 'k';
    return formatNumber(value, locale);
};
