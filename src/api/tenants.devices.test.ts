import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock } = vi.hoisted(() => ({
    apiFetchMock: vi.fn(),
}));

vi.mock('./client', () => ({
    apiFetch: apiFetchMock,
}));

import { listActiveDevices, removeActiveDevice } from './tenants';

describe('tenant device API', () => {
    beforeEach(() => {
        apiFetchMock.mockReset();
    });

    it('normalizes platform and legacy device fields at the API boundary', async () => {
        apiFetchMock.mockResolvedValueOnce([
            {
                id: 17,
                session_id: 17,
                user_id: 'user-9',
                device_id: 'device / one',
                user: null,
                last_seen: null,
                ip: null,
                ua: 'Mozilla/5.0 Test Browser',
            },
        ]);

        await expect(listActiveDevices('dealer / 42')).resolves.toEqual([
            {
                id: '17',
                session_id: '17',
                user_id: 'user-9',
                device_id: 'device / one',
                user: 'Unbekannter Benutzer',
                last_seen: null,
                ip: null,
                user_agent: 'Mozilla/5.0 Test Browser',
            },
        ]);
        expect(apiFetchMock).toHaveBeenCalledWith(
            '/api/admin/tenants/dealer%20%2F%2042/devices',
        );
    });

    it('rejects malformed session data instead of presenting an incomplete list', async () => {
        apiFetchMock.mockResolvedValueOnce([
            {
                id: 'session-1',
                device_id: '',
                user: 'Owner',
            },
        ]);

        await expect(listActiveDevices('tenant-1')).rejects.toThrow(
            'API response validation failed',
        );
    });

    it('uses the honest DELETE route and safely encodes opaque IDs', async () => {
        apiFetchMock.mockResolvedValueOnce({ success: true });

        await removeActiveDevice('dealer/42', 'browser / tablet', 'session / 17', 'user / 9');

        expect(apiFetchMock).toHaveBeenCalledWith(
            '/api/admin/tenants/dealer%2F42/devices/browser%20%2F%20tablet?session_id=session+%2F+17&user_id=user+%2F+9',
            { method: 'DELETE' },
        );
    });

    it('does not report a revocation without an explicit server confirmation', async () => {
        apiFetchMock.mockResolvedValueOnce({ success: false });

        await expect(removeActiveDevice('tenant-1', 'device-1', 'session-1', 'user-1')).rejects.toThrow(
            'Geräte-Session wurde vom Server nicht bestätigt.',
        );
    });
});
