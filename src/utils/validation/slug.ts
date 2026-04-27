/**
 * Slug helpers — used in TenantWizard for live-as-you-type slug suggestions.
 */

const DIACRITICS_RE = /[\u0300-\u036f]/g;

export function nameToSlug(name: string): string {
    return name
        .normalize('NFKD')
        .replace(DIACRITICS_RE, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

const RESERVED = new Set(['admin', 'api', 'auth', 'login', 'logout', 'system', 'support', 'partsunion']);

export interface SlugValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateSlug(slug: string): SlugValidationResult {
    const errors: string[] = [];
    if (!slug) errors.push('Slug darf nicht leer sein.');
    if (slug.length < 3) errors.push('Slug muss mindestens 3 Zeichen haben.');
    if (slug.length > 60) errors.push('Slug ist zu lang (max. 60 Zeichen).');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) errors.push('Nur Kleinbuchstaben, Zahlen und Bindestriche.');
    if (RESERVED.has(slug)) errors.push('Slug ist reserviert.');
    return { valid: errors.length === 0, errors };
}
