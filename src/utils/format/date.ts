/**
 * Intl-based date formatters (locale-aware).
 *
 * For consistency with User-Dashboard. Default locale is `de-DE`.
 */

export const formatDate = (
    input: string | Date,
    locale = 'de-DE',
    options?: Intl.DateTimeFormatOptions,
): string => {
    try {
        const d = typeof input === 'string' ? new Date(input) : input;
        if (Number.isNaN(d.getTime())) return String(input);
        return d.toLocaleDateString(
            locale,
            options ?? { day: '2-digit', month: '2-digit', year: 'numeric' },
        );
    } catch {
        return String(input);
    }
};

export const formatDateTime = (input: string | Date, locale = 'de-DE'): string =>
    formatDate(input, locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

export const formatTime = (input: string | Date, locale = 'de-DE'): string =>
    formatDate(input, locale, { hour: '2-digit', minute: '2-digit' });

export const formatRelative = (input: string | Date, locale = 'de-DE'): string => {
    try {
        const d = typeof input === 'string' ? new Date(input) : input;
        const now = new Date();
        const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
        const abs = Math.abs(diffSec);
        if (abs < 60) return rtf.format(diffSec, 'second');
        if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
        if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), 'hour');
        if (abs < 86_400 * 30) return rtf.format(Math.round(diffSec / 86_400), 'day');
        if (abs < 86_400 * 365) return rtf.format(Math.round(diffSec / 86_400 / 30), 'month');
        return rtf.format(Math.round(diffSec / 86_400 / 365), 'year');
    } catch {
        return String(input);
    }
};
