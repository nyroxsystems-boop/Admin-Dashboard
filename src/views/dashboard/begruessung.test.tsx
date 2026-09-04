/**
 * Die Begrüßung nennt den ANGEMELDETEN Benutzer — nicht immer denselben.
 *
 * ─── Warum es diese Prüfung gibt ───────────────────────────────────────────
 *
 * Im Entwurf steht „Gute Nacht, Aaron." Dieser Name ist Beispieltext, und der
 * naheliegende Fehler beim Übernehmen eines Entwurfs ist, ihn stehen zu lassen:
 * es sieht auf jedem Bildschirmfoto richtig aus, solange der eigene Name
 * zufällig danebensteht. Auffallen würde es erst, wenn sich ein Kollege
 * anmeldet und fremd begrüßt wird.
 *
 * Die vorhandene Bildprobe (`src/test/redesignAbbild.test.tsx`) kann das NICHT
 * zeigen: sie stellt genau einen Benutzer und rendert einmal. Ein fest
 * verdrahteter Name und ein richtig verdrahteter sehen dort identisch aus.
 * Deshalb rendert diese Datei MEHRMALS mit verschiedenen Anmeldungen — nur der
 * Wechsel beweist, dass der Name wirklich von der Anmeldung kommt.
 *
 * ─── Was zusätzlich geprüft wird ───────────────────────────────────────────
 *
 * Die Rückfallregeln in `anzeigeName`. Heute stehen in `admin_users` saubere
 * Vornamen, aber Konten überleben Jahre. Wird eines später als `aaron.vogt`
 * oder mit E-Mail als Kennung angelegt, darf da nicht
 * „Gute Nacht, aaron.vogt@partsunion.de." stehen.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `vi.hoisted`, damit die Anmeldung zwischen den Fällen umgestellt werden kann.
 *
 * `vi.mock` wird über die Importe gezogen; eine gewöhnliche Variable wäre zum
 * Zeitpunkt des Mock-Aufrufs noch nicht angelegt. `vi.hoisted` läuft davor und
 * gibt ein Objekt zurück, dessen Feld ich später beschreiben kann — die
 * Fabrik liest es erst beim Rendern.
 */
const sitzung = vi.hoisted(() => ({
    benutzer: null as { id: string; username?: string | null; email?: string | null; role: string } | null,
}));

vi.mock('@/context/AuthContext', () => ({
    useAuth: () => ({ user: sitzung.benutzer, logout: async () => {} }),
}));

vi.mock('@/auth/usePermissions', () => ({
    usePermissions: () => ({ isSuperAdmin: true, can: () => true, role: 'SUPER_ADMIN' }),
}));
vi.mock('@/hooks/useDashboardMetrics', () => ({
    useDashboardMetrics: () => ({
        metrics: {
            activeTenants: 4, totalUsers: 27, ordersToday: 12, revenueMtd: 48_320,
            seriesOrders7d: [8, 11, 7, 14, 9, 15, 12],
            seriesRevenue7d: [4100, 5300, 3900, 6800, 5200, 7400, 6100],
        },
        isLoading: false, error: null, refetch: () => {},
    }),
}));
vi.mock('@/hooks/useSystemHealth', () => ({
    useSystemHealth: () => ({
        health: { db: 'ok', redis: 'ok', botApi: 'ok' },
        isLoading: false, error: null, refetch: () => {},
    }),
}));
vi.mock('@/hooks/useInbox', () => ({
    useMailboxes: () => ({
        mailboxes: [{ id: 'all', label: 'Alle', unread: 9 }],
        sendingAddresses: [], transport: 'resend',
        isLoading: false, error: null, refetch: () => {},
    }),
}));
vi.mock('@/hooks/useAuditLogs', () => ({
    useAuditLogs: () => ({
        entries: [], isLoading: false, isFetchingNextPage: false,
        hasNextPage: false, fetchNextPage: () => {}, refetch: () => {},
    }),
}));
// Ohne Browser läuft keine Animation; der Hochzähler bliebe sonst auf 0.
vi.mock('framer-motion', async () => {
    const echt = await vi.importActual<typeof import('framer-motion')>('framer-motion');
    return { ...echt, useReducedMotion: () => true };
});
vi.mock('@/api/appointments', () => ({
    listAppointments: () => Promise.resolve({ appointments: [] }),
}));
vi.mock('@/api/onboarding', () => ({
    getOnboardingPipeline: () => Promise.resolve({
        summary: { total: 0, live: 0, configured: 0, setup: 0, atRisk: 0 }, tenants: [],
    }),
}));
vi.mock('@/hooks/useTenants', () => {
    const stumpf = () => ({ mutateAsync: async () => {}, mutate: () => {}, isPending: false });
    return {
        useTenants: () => ({ tenants: [], isLoading: false, error: null, refetch: () => {} }),
        useDeactivateTenant: stumpf, useActivateTenant: stumpf, useSuspendTenant: stumpf,
        useUnsuspendTenant: stumpf, useDeleteTenant: stumpf, useRestoreTenant: stumpf,
        usePurgeTenant: stumpf,
    };
});
vi.mock('@/hooks/useImpersonate', () => ({
    useImpersonate: () => ({ start: async () => {}, isPending: false }),
}));
vi.mock('@/hooks/useNotifications', () => ({ useNotifications: () => ({ unread: 2 }) }));
vi.mock('@/hooks/useActiveImpersonation', () => ({ useActiveImpersonation: () => null }));

// Steht bewusst NACH den vi.mock-Aufrufen: der Baustein zieht beim Laden seine
// Abhängigkeiten, und die sollen bereits ersetzt sein.
import OverviewView from './OverviewView';

function rendern(): string {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['admin', 'appointments', 'uebersicht'], { appointments: [] });
    const leer = { summary: { total: 0, live: 0, configured: 0, setup: 0, atRisk: 0 }, tenants: [] };
    qc.setQueryData(['admin', 'onboarding', 'pipeline'], leer);
    qc.setQueryData(['admin', 'onboarding-pipeline'], leer);
    return renderToStaticMarkup(
        <QueryClientProvider client={qc}>
            <MemoryRouter initialEntries={['/']}><OverviewView /></MemoryRouter>
        </QueryClientProvider>,
    );
}

/** Die Überschrift aus dem gerenderten Markup, ohne Auszeichnung. */
function ueberschrift(markup: string): string {
    const m = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(markup);
    if (!m) throw new Error('Keine Überschrift im gerenderten Bild gefunden');
    return m[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&#x27;|&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

/** Die vier Grußformeln aus `greeting()` — welche gilt, hängt an der Uhrzeit. */
const GRUSS = /^(Gute Nacht|Guten Morgen|Guten Tag|Guten Abend)/;

beforeEach(() => {
    sitzung.benutzer = null;
});

describe('Begrüßung auf der Übersicht', () => {
    it.each([
        ['Aaron', 'aaron.vogt@partsunion.de', 'superadmin'],
        ['Elias', 'elias.zafar@partsunion.de', 'admin'],
        ['Bardia', 'bardia.bagherian@partsunion.de', 'admin'],
        ['Fecat', 'fecat.blawat@partsunion.de', 'superadmin'],
    ])('nennt %s, wenn %s angemeldet ist', (username, email, role) => {
        sitzung.benutzer = { id: '1', username, email, role };
        const titel = ueberschrift(rendern());

        expect(titel).toMatch(GRUSS);
        expect(titel, 'der angemeldete Name muss dastehen').toContain(username);
    });

    it('wechselt wirklich — zwei Anmeldungen, zwei Namen', () => {
        /**
         * Der eigentliche Beweis. Die vier Fälle oben liefen einzeln auch dann
         * grün, wenn jeder Name zufällig irgendwo im Markup steht. Hier wird
         * derselbe Baustein zweimal gerendert und die ÜBERSCHRIFTEN werden
         * verglichen: ein fest verdrahteter Name ergäbe zweimal dasselbe.
         */
        sitzung.benutzer = { id: '1', username: 'Aaron', email: 'aaron.vogt@partsunion.de', role: 'superadmin' };
        const ersteAnmeldung = ueberschrift(rendern());

        sitzung.benutzer = { id: '2', username: 'Elias', email: 'elias.zafar@partsunion.de', role: 'admin' };
        const zweiteAnmeldung = ueberschrift(rendern());

        expect(ersteAnmeldung).toContain('Aaron');
        expect(zweiteAnmeldung).toContain('Elias');
        expect(zweiteAnmeldung, 'die Begrüßung hängt fest').not.toBe(ersteAnmeldung);
        expect(zweiteAnmeldung, 'der vorige Name steht noch da').not.toContain('Aaron');
    });

    it('nennt niemanden, wenn keine Anmeldung vorliegt', () => {
        // Kein „Gute Nacht, null." und kein „Gute Nacht, ." — der Gruß steht
        // dann allein. Dieser Zustand kommt beim ersten Rendern vor, bevor das
        // Profil geladen ist.
        sitzung.benutzer = null;
        const titel = ueberschrift(rendern());

        expect(titel).toMatch(GRUSS);
        expect(titel).not.toMatch(/null|undefined/);
        expect(titel, 'kein Komma ohne Namen dahinter').not.toMatch(/,\s*\.$/);
    });

    describe('Rückfallregeln für später angelegte Konten', () => {
        it.each([
            // Kennung, erwarteter Name
            ['aaron.vogt', 'Aaron'],
            ['elias_zafar', 'Elias'],
            ['bardia-bagherian', 'Bardia'],
            ['fecat', 'Fecat'],
            // Kleingeschrieben angelegt — der Gruß schreibt trotzdem gross.
            ['elias', 'Elias'],
        ])('macht aus der Kennung "%s" den Namen "%s"', (username, erwartet) => {
            sitzung.benutzer = { id: '9', username, email: null, role: 'admin' };
            expect(ueberschrift(rendern())).toContain(erwartet);
        });

        it('nimmt die E-Mail, wenn keine Kennung da ist — aber nur den Vornamen', () => {
            sitzung.benutzer = { id: '9', username: null, email: 'elias.zafar@partsunion.de', role: 'admin' };
            const titel = ueberschrift(rendern());

            expect(titel).toContain('Elias');
            expect(titel, 'die ganze Adresse gehört nicht in eine Begrüßung').not.toContain('@');
        });
    });
});
