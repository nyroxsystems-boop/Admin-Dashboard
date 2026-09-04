import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetch, setAccessToken } = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    setAccessToken: vi.fn(),
}));

vi.mock('./client', () => ({
    apiFetch,
    setAccessToken,
}));

import { adminLogin, adminLogout, getAdminMe } from './auth';

describe('admin auth API contracts', () => {
    beforeEach(() => {
        apiFetch.mockReset();
        setAccessToken.mockReset();
    });

    it('rejects malformed login responses instead of authenticating raw data', async () => {
        apiFetch.mockResolvedValue({ access: '', user: { username: 'broken' } });

        await expect(adminLogin('admin', 'secret')).rejects.toThrow(/validation failed/i);
        expect(setAccessToken).not.toHaveBeenCalled();
    });

    it('accepts a valid login response and installs its access token', async () => {
        apiFetch.mockResolvedValue({
            access: 'session-token',
            user: { id: 'admin-1', username: 'admin', email: 'admin@example.com', role: 'SUPER_ADMIN' },
        });

        await expect(adminLogin('admin', 'secret')).resolves.toMatchObject({ access: 'session-token' });
        expect(setAccessToken).toHaveBeenCalledWith('session-token');
    });

    it('akzeptiert eine Cookie-Anmeldung OHNE access im Koerper', async () => {
        /**
         * Der Fehler, den das hier verhindert.
         *
         * Das Backend liefert das Sitzungstoken in Produktion nur noch als
         * httpOnly-Cookie; `access` steht dann NICHT im Antwortkoerper:
         *
         *   const exposeLegacyToken = process.env.NODE_ENV !== 'production'
         *       || process.env.ADMIN_ALLOW_LEGACY_TOKEN_RESPONSE === 'true';
         *
         * Solange das Schema `access` als Pflicht fuehrte, scheiterte die
         * strenge Pruefung mit "access: Required" — und der Anmeldebildschirm
         * zeigte dafuer "Unguel­tige Anmeldedaten". Serverseitig war die
         * Anmeldung dabei ERFOLGREICH: Cookie gesetzt, Login im Protokoll.
         *
         * Das ist die gemeinste Sorte Fehler: die Meldung zeigt auf die
         * Zugangsdaten, die Protokolle zeigen Erfolge, und beides ist wahr.
         * Ich habe die Anmeldung deswegen zweimal falsch fuer "funktioniert"
         * erklaert.
         */
        apiFetch.mockResolvedValue({
            expiresIn: 86_400,
            user: { id: 'admin-1', username: 'Aaron', email: 'aaron.vogt@partsunion.de', role: 'superadmin' },
        });

        const res = await adminLogin('Aaron', 'secret');

        expect(res.user.username).toBe('Aaron');
        expect(res.access, 'ohne Cookie-Token gibt es hier nichts').toBeUndefined();
        expect(
            setAccessToken,
            'ohne Token darf keiner gesetzt werden — die Anfragen tragen ueber das Cookie',
        ).not.toHaveBeenCalled();
    });

    it('validates /me as a security-critical response', async () => {
        apiFetch.mockResolvedValue({ id: 'admin-1', username: 42, email: 'admin@example.com' });

        await expect(getAdminMe()).rejects.toThrow(/validation failed/i);
    });

    it('sends the captured authorization value when revoking a session', async () => {
        apiFetch.mockResolvedValue({ success: true });

        await adminLogout('Token captured-session');

        expect(apiFetch).toHaveBeenCalledWith('/api/admin-auth/logout', {
            method: 'POST',
            headers: { Authorization: 'Token captured-session' },
        });
    });
});
