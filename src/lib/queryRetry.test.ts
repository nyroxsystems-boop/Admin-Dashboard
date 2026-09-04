import { describe, expect, it } from 'vitest';
import { shouldRetryQuery } from './queryRetry';

describe('shouldRetryQuery', () => {
    it.each([0, 401, 403, 404, 408, 429, 500, 503])(
        'does not duplicate apiFetch retries for status %i',
        (status) => {
            expect(shouldRetryQuery(0, { status })).toBe(false);
        },
    );

    it('retries an unknown transient error once', () => {
        expect(shouldRetryQuery(0, new Error('transient'))).toBe(true);
        expect(shouldRetryQuery(1, new Error('transient'))).toBe(false);
    });
});
