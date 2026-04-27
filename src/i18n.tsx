/**
 * Admin Dashboard — i18n Provider (React-i18next-compatible).
 *
 * Implementation notes:
 *  - We ship a tiny in-house translator instead of pulling react-i18next.
 *    The Admin-Dashboard's translation needs are simple key-lookups; the
 *    library's overhead (~60 KB) isn't justified.
 *  - Default locale: `de` (loaded eagerly).
 *  - Fallback chain: requested → en → de → key.
 *  - Locale detection: localStorage(`pu.admin.lang`) → navigator → default.
 *  - Lazy-loading via dynamic import for non-default locales.
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import deTranslations from './locales/de.json';

export type LanguageCode = 'de' | 'en' | 'fr' | 'es' | 'it' | 'pl' | 'tr';

interface LanguageOption {
    code: LanguageCode;
    label: string;
}

// eslint-disable-next-line react-refresh/only-export-components -- static config
export const languageOptions: LanguageOption[] = [
    { code: 'de', label: 'Deutsch' },
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'es', label: 'Español' },
    { code: 'it', label: 'Italiano' },
    { code: 'pl', label: 'Polski' },
    { code: 'tr', label: 'Türkçe' },
];

const DEFAULT_LOCALE: LanguageCode =
    (import.meta.env.VITE_DEFAULT_LOCALE as LanguageCode | undefined) ?? 'de';
const FALLBACK_LOCALE: LanguageCode = 'en';
const STORAGE_KEY = 'pu.admin.lang';

type Translations = Record<string, unknown>;

interface I18nContextValue {
    lang: LanguageCode;
    setLang: (lang: LanguageCode) => void;
    t: (key: string, vars?: Record<string, string | number>) => string;
    isLoading: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const loadedTranslations: Partial<Record<LanguageCode, Translations>> = {
    de: deTranslations as Translations,
};

// ──────────────────────────────────────────────────────────────────────────
//  Detection
// ──────────────────────────────────────────────────────────────────────────

function detectInitialLanguage(): LanguageCode {
    if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && languageOptions.some((o) => o.code === stored)) {
            return stored as LanguageCode;
        }
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
        const short = navigator.language.slice(0, 2).toLowerCase();
        if (languageOptions.some((o) => o.code === short)) return short as LanguageCode;
    }
    return DEFAULT_LOCALE;
}

// ──────────────────────────────────────────────────────────────────────────
//  Lookup helpers
// ──────────────────────────────────────────────────────────────────────────

function getNested(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== 'object') return undefined;
    const parts = path.split('.');
    let cursor: unknown = obj;
    for (const part of parts) {
        if (cursor && typeof cursor === 'object' && part in (cursor as Record<string, unknown>)) {
            cursor = (cursor as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }
    return cursor;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
    if (!vars) return template;
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
        Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{{${key}}}`
    );
}

function lookupTranslation(
    lang: LanguageCode,
    key: string
): string | undefined {
    // Try requested → fallback → default
    const sources: LanguageCode[] = [lang];
    if (!sources.includes(FALLBACK_LOCALE)) sources.push(FALLBACK_LOCALE);
    if (!sources.includes(DEFAULT_LOCALE)) sources.push(DEFAULT_LOCALE);

    for (const src of sources) {
        const dict = loadedTranslations[src];
        if (!dict) continue;
        const value = getNested(dict, key);
        if (typeof value === 'string') return value;
    }
    return undefined;
}

// ──────────────────────────────────────────────────────────────────────────
//  Provider
// ──────────────────────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
    const [lang, setLangState] = useState<LanguageCode>(() => detectInitialLanguage());
    const [isLoading, setIsLoading] = useState(false);
    const [version, setVersion] = useState(0); // bump after lazy-load to re-render

    useEffect(() => {
        if (lang === DEFAULT_LOCALE || loadedTranslations[lang]) return;
        let cancelled = false;
        // Defer state-update so React doesn't see a synchronous setState
        // inside the effect body (compiler/strict-mode warning).
        queueMicrotask(() => {
            if (!cancelled) setIsLoading(true);
        });

        // Use a switch so Vite can statically resolve glob entries.
        const importer = (): Promise<{ default: Translations }> => {
            switch (lang) {
                case 'en':
                    return import('./locales/en.json') as Promise<{ default: Translations }>;
                case 'fr':
                    return import('./locales/fr.json') as Promise<{ default: Translations }>;
                case 'es':
                    return import('./locales/es.json') as Promise<{ default: Translations }>;
                case 'it':
                    return import('./locales/it.json') as Promise<{ default: Translations }>;
                case 'pl':
                    return import('./locales/pl.json') as Promise<{ default: Translations }>;
                case 'tr':
                    return import('./locales/tr.json') as Promise<{ default: Translations }>;
                default:
                    return Promise.resolve({ default: {} });
            }
        };

        importer()
            .then((mod) => {
                if (cancelled) return;
                loadedTranslations[lang] = mod.default;
                setVersion((v) => v + 1);
                setIsLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [lang]);

    // Always make sure fallback English is loaded so that missing keys in
    // niche locales fall back to English instead of the raw key.
    useEffect(() => {
        if (loadedTranslations[FALLBACK_LOCALE]) return;
        let cancelled = false;
        import('./locales/en.json')
            .then((mod) => {
                if (cancelled) return;
                loadedTranslations[FALLBACK_LOCALE] = mod.default as Translations;
                setVersion((v) => v + 1);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    const setLang = useCallback((next: LanguageCode) => {
        setLangState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            /* ignore */
        }
        if (typeof document !== 'undefined') {
            document.documentElement.lang = next;
        }
    }, []);

    const t = useCallback(
        (key: string, vars?: Record<string, string | number>): string => {
            const found = lookupTranslation(lang, key);
            return interpolate(found ?? key, vars);
        },
        // version dep ensures re-render after lazy load
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [lang, version]
    );

    const value = useMemo<I18nContextValue>(
        () => ({ lang, setLang, t, isLoading }),
        [lang, setLang, t, isLoading]
    );

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- co-located with provider
export function useI18n(): I18nContextValue {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
    return ctx;
}

/** Convenience: format dates with the active locale via Intl. */
// eslint-disable-next-line react-refresh/only-export-components -- helper export
export function formatDate(date: Date | string | number, lang: LanguageCode, opts?: Intl.DateTimeFormatOptions): string {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(lang, opts ?? { dateStyle: 'medium' }).format(d);
}

// eslint-disable-next-line react-refresh/only-export-components -- helper export
export function formatNumber(value: number, lang: LanguageCode, opts?: Intl.NumberFormatOptions): string {
    if (!Number.isFinite(value)) return '—';
    return new Intl.NumberFormat(lang, opts).format(value);
}
