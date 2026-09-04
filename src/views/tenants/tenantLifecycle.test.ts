import { describe, expect, it, vi } from 'vitest';

import {
    removeSuccessfulTenantSelections,
    settleTenantLifecycleBatch,
} from './tenantLifecycle';

describe('tenant lifecycle batch execution', () => {
    it('waits for all tenants and reports partial failures by ID', async () => {
        const action = vi.fn(async (id: string) => {
            if (id === 'tenant-2') throw new Error('backend unavailable');
        });

        const result = await settleTenantLifecycleBatch(
            ['tenant-1', 'tenant-2', 'tenant-3'],
            action,
        );

        expect(action).toHaveBeenCalledTimes(3);
        expect(result.successfulIds).toEqual(['tenant-1', 'tenant-3']);
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0]).toMatchObject({ id: 'tenant-2' });
    });

    it('clears only successful tenants from the current selection', () => {
        const next = removeSuccessfulTenantSelections(
            new Set(['tenant-1', 'tenant-2', 'unrelated']),
            ['tenant-1'],
        );

        expect(Array.from(next)).toEqual(['tenant-2', 'unrelated']);
    });
});
