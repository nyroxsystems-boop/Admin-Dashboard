/**
 * validateEmail — RFC 5322-simplified validation, returns error list.
 */
export interface EmailValidationResult {
    valid: boolean;
    errors: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): EmailValidationResult {
    const errors: string[] = [];
    const trimmed = email.trim();
    if (!trimmed) {
        errors.push('E-Mail ist erforderlich.');
    } else {
        if (trimmed.length > 254) errors.push('E-Mail ist zu lang.');
        if (!EMAIL_RE.test(trimmed)) errors.push('E-Mail-Format ist ungültig.');
        if (/\.\./.test(trimmed)) errors.push('Aufeinanderfolgende Punkte sind nicht erlaubt.');
    }
    return { valid: errors.length === 0, errors };
}

export const isValidEmail = (email: string): boolean => validateEmail(email).valid;
