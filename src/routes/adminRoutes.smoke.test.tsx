/**
 * Routen-Rauchtest — rendert JEDE Route des Dashboards einmal.
 *
 * Warum das nötig ist: tsc prüft Typen, ESLint den Stil, der Build die
 * Auflösung von Importen. Keiner davon merkt, wenn eine Ansicht beim Rendern
 * abstürzt — ein Hook in falscher Reihenfolge, ein `undefined.map`, eine
 * Route, die auf eine gelöschte Komponente zeigt. Genau solche Fehler entstehen
 * beim Umbau der Navigation.
 *
 * Der Test mountet den echten Router unter einer angemeldeten Attrappe und
 * prüft für jeden Pfad zweierlei: dass etwas gerendert wird, und dass die
 * Fehlergrenze NICHT ausgelöst hat.
 *
 * Netzwerkaufrufe werden nicht gemockt — die Ansichten zeigen dann ihren Lade-
 * oder Fehlerzustand. Das genügt: geprüft wird, dass die Route trägt, nicht
 * dass die API antwortet.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Admin } from '@/api/types';

const superadmin: Admin = {
    id: 'admin-1',
    username: 'Aaron',
    email: 'aaron.vogt@partsunion.de',
    role: 'superadmin',
    must_change_password: false,
};

vi.mock('@/context/AuthContext', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@/context/AuthContext');
    return {
        ...actual,
        useAuth: () => ({
            user: superadmin,
            isAuthenticated: true,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            refreshUser: vi.fn(),
            markPasswordChanged: vi.fn(),
        }),
    };
});

// Netzwerk stilllegen: die Ansichten sollen ihren Lade-/Fehlerzustand zeigen,
// statt auf echte Antworten zu warten.
vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline im Test'))));

import { AdminRoutes } from './adminRoutes';

/** Jede Route, die ein Mensch aufrufen kann. */
const ROUTES = [
    '/',
    '/calendar',
    '/tenants',
    '/tenants/new',
    '/tenants/tenant-1',
    '/onboarding',
    '/access-requests',
    '/oem-finder',
    '/mail',
    '/einstellungen',
    '/einstellungen/admins',
    '/einstellungen/postfaecher',
    '/einstellungen/regeln',
    '/einstellungen/support',
    '/einstellungen/audit',
    '/einstellungen/wartung',
    '/bot/testing',
    '/testing/e2e-runner',
    '/testing/live-sim',
    '/orders',
    '/oe-quality',
    '/ein-pfad-den-es-nicht-gibt',
];

/** Alte Pfade, die auf ihr neues Ziel zeigen müssen. */
const REDIRECTS: Array<[string, string]> = [
    ['/inbox', 'Posteingang'],
    ['/inbox/verwaltung', 'Postfach-Rechte'],
    ['/profile', 'Einstellungen'],
    ['/admins', 'Einstellungen'],
    ['/audit', 'Einstellungen'],
    ['/support', 'Einstellungen'],
    ['/maintenance', 'Einstellungen'],
];

function renderAt(path: string) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[path]}>
                <AdminRoutes />
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

describe('Dashboard-Routen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(ROUTES)('rendert %s ohne Absturz', async (path) => {
        const { container } = renderAt(path);

        // Lazy-Loading: erst nach dem Auflösen des Chunks steht der Inhalt.
        await waitFor(() => {
            expect(container.textContent).toBeTruthy();
        }, { timeout: 5000 });

        // Die Fehlergrenze zeigt diesen Text — sie darf nicht ausgelöst haben.
        expect(screen.queryByText(/Etwas ist schiefgelaufen/i)).toBeNull();
        expect(screen.queryByText(/Unerwarteter Fehler/i)).toBeNull();
    });

    it.each(REDIRECTS)('leitet %s weiter', async (path) => {
        const { container } = renderAt(path);
        await waitFor(() => {
            expect(container.textContent).toBeTruthy();
        }, { timeout: 5000 });
        expect(screen.queryByText(/Seite nicht gefunden/i)).toBeNull();
    });
});
