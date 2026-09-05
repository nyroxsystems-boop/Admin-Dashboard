import { describe, expect, it } from 'vitest';

import { invalidEmailAddresses, parseEmailAddresses } from './emailAddresses';

describe('email address input', () => {
    it('accepts pasted display names, quoted commas and line-separated recipients', () => {
        expect(parseEmailAddresses('"Müller, Anna" <ANNA@example.test>; Einkauf <team@example.test>\nanna@example.test')).toEqual(['anna@example.test', 'team@example.test']);
        expect(invalidEmailAddresses('Name <wrong@@example.test>')).toEqual(['wrong@@example.test']);
    });
    it('normalizes semicolon-separated recipients and removes duplicates', () => {
        expect(parseEmailAddresses(' Info@Partsunion.de; kunde@example.com, info@partsunion.de ')).toEqual([
            'info@partsunion.de',
            'kunde@example.com',
        ]);
    });

    it('catches accidental double-at addresses before the API request', () => {
        expect(invalidEmailAddresses('alexanderblawat@@mail.com')).toEqual([
            'alexanderblawat@@mail.com',
        ]);
    });
});
