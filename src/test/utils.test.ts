/**
 * Smoke unit tests covering the validation utilities used in TenantWizard
 * and AdminCreate flows. These guard against regressions in the rules that
 * gate operator account creation.
 */
import { describe, it, expect } from 'vitest';
import { validateEmail } from '@/utils/validation/email';
import { nameToSlug } from '@/utils/validation/slug';
import { validatePassword } from '@/utils/validation/password';

describe('validateEmail', () => {
    it('accepts a valid email', () => {
        expect(validateEmail('test@example.com').valid).toBe(true);
    });

    it('rejects an empty input', () => {
        expect(validateEmail('').valid).toBe(false);
    });

    it('rejects a value without @', () => {
        expect(validateEmail('foo.bar').valid).toBe(false);
    });
});

describe('nameToSlug', () => {
    it('lowercases simple names with spaces', () => {
        expect(nameToSlug('Acme Corp')).toBe('acme-corp');
    });

    it('strips umlauts to their base letter', () => {
        // NFKD-normalized "Müller GmbH" -> diacritic stripped -> "muller-gmbh"
        expect(nameToSlug('Müller GmbH')).toMatch(/m(u|ue)ller-gmbh/);
    });
});

describe('validatePassword', () => {
    it('rejects a short password', () => {
        expect(validatePassword('Aa1!').valid).toBe(false);
    });

    it('accepts a strong password', () => {
        expect(validatePassword('SecurePass123!@#').valid).toBe(true);
    });

    it('uses exactly the special-character set accepted by tenant provisioning', () => {
        expect(validatePassword('SecurePass123.').valid).toBe(false);
        expect(validatePassword('SecurePass123=').valid).toBe(true);
    });
});
