import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock } = vi.hoisted(() => ({
    apiFetchMock: vi.fn(),
}));

vi.mock('./client', () => ({
    apiFetch: apiFetchMock,
}));

import { activateTenant, createTenant, deactivateTenant } from './tenants';

describe('tenant provisioning and lifecycle API', () => {
    beforeEach(() => {
        apiFetchMock.mockReset();
    });

    it('rejects a malformed create response instead of showing false success', async () => {
        apiFetchMock.mockResolvedValueOnce({
            success: true,
            name: 'Fehlerhafter Händler',
            email: 'owner@example.test',
        });

        await expect(
            createTenant({ name: 'Fehlerhafter Händler', email: 'owner@example.test' }),
        ).rejects.toThrow('API response validation failed');
    });

    it('normalizes a valid create response at the strict API boundary', async () => {
        apiFetchMock.mockResolvedValueOnce({
            id: 42,
            name: 'Teilehandel Nord',
            email: 'owner@example.test',
            wawi_synced: true,
            welcome_email_sent: false,
        });

        await expect(
            createTenant({ name: 'Teilehandel Nord', email: 'owner@example.test' }),
        ).resolves.toMatchObject({ id: '42', wawi_synced: true });
    });

    it.each([
        ['activate', activateTenant, 'Aktivierung'],
        ['deactivate', deactivateTenant, 'Deaktivierung'],
    ] as const)('requires explicit server confirmation for %s', async (_name, action, label) => {
        apiFetchMock.mockResolvedValueOnce({ success: false });

        await expect(action('tenant/42')).rejects.toThrow(
            `${label} wurde vom Server nicht bestätigt.`,
        );
    });
});
