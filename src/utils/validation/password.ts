/**
 * validatePassword — Strong password rules used in TenantWizard / AdminCreate.
 *
 * Rules:
 *   - min 12 chars
 *   - upper- & lowercase letter
 *   - digit
 *   - special character
 *   - not in commonly-leaked list
 */
export interface PasswordValidationResult {
    valid: boolean;
    errors: string[];
    score: 0 | 1 | 2 | 3 | 4;
}

const COMMON_PASSWORDS = new Set([
    'password',
    'password1',
    '123456789',
    'qwertyuiop',
    'letmein',
    'admin1234',
    'welcome1',
    'partsunion',
]);

// Keep this character class byte-for-byte aligned with the tenant-create
// backend (`adminRoutes.ts`). A generic "non-alphanumeric" check accepted e.g.
// dots or spaces in the UI although the API rejected the same password.
const BACKEND_SPECIAL_CHARACTER_RE = /[!@#$%^&*()_+\-=]/;

export function validatePassword(pw: string): PasswordValidationResult {
    const errors: string[] = [];

    if (pw.length < 12) errors.push('Mindestens 12 Zeichen.');
    if (!/[a-z]/.test(pw)) errors.push('Mindestens ein Kleinbuchstabe.');
    if (!/[A-Z]/.test(pw)) errors.push('Mindestens ein Großbuchstabe.');
    if (!/\d/.test(pw)) errors.push('Mindestens eine Ziffer.');
    if (!BACKEND_SPECIAL_CHARACTER_RE.test(pw)) {
        errors.push('Mindestens eines dieser Sonderzeichen: ! @ # $ % ^ & * ( ) _ + - =');
    }
    if (COMMON_PASSWORDS.has(pw.toLowerCase())) errors.push('Passwort ist zu häufig verwendet.');

    let score: PasswordValidationResult['score'] = 0;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (BACKEND_SPECIAL_CHARACTER_RE.test(pw) && pw.length >= 16) score++;

    return {
        valid: errors.length === 0,
        errors,
        score: score as PasswordValidationResult['score'],
    };
}

/** Generate a random secure password (URL-safe, 16 chars). */
export function generateSecurePassword(length = 16): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digit = '23456789';
    const special = '!@#$%^&*-_=+';
    const all = upper + lower + digit + special;

    const required = [
        upper[secureInt(upper.length)],
        lower[secureInt(lower.length)],
        digit[secureInt(digit.length)],
        special[secureInt(special.length)],
    ].join('');

    let pw = required;
    for (let i = required.length; i < length; i++) {
        pw += all[secureInt(all.length)];
    }
    return pw
        .split('')
        .sort(() => secureInt(2) - 0.5)
        .join('');
}

function secureInt(max: number): number {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        return buf[0]! % max;
    }
    return Math.floor(Math.random() * max);
}
