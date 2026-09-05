/**
 * Admin Dashboard — Entry Point
 *
 * Provider order (outer → inner):
 *   StrictMode
 *     ThemeProvider (next-themes)         — hell/dunkel, Vorgabe hell
 *       RouterProvider                    — URL state + protected draft navigation
 *         ErrorBoundary                   — Sentry-ready fallback
 *           I18nProvider                  — locale loading + t()
 *             <App />                     — owns QueryClient + AuthProvider + Routes
 *             <Toaster />                 — Sonner global toast stack
 *
 * Wired here:
 *   - initSentry() runs first; no-op if VITE_SENTRY_DSN is missing.
 *
 * Note: QueryClientProvider and AuthProvider live INSIDE <App /> (see App.tsx),
 * because AuthProvider needs useNavigate (so it must be under RouterProvider)
 * but it's also coupled to the route tree it guards via ProtectedRoute.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';

import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nProvider } from './i18n';
import { initSentry } from './services/sentry';
import { serviceWorkerRegistrieren } from './lib/push';
import App from './App';
// Inter lokal laden: einheitliche Arbeitstypografie ohne externen Font-Abruf.
import '@fontsource-variable/inter';
import './index.css';

// Init Sentry before React mounts so boot-time errors are captured.
initSentry();

/**
 * Service Worker beim Start registrieren — NICHT erst im Postfach.
 *
 * Vorher hing die Registrierung an der Glocke in der Mail-Kopfzeile. Damit war
 * sie erst vorhanden, wenn jemand angemeldet war UND /mail geöffnet hatte. Auf
 * der Anmeldeseite und im ganzen übrigen Dashboard lief kein Service Worker,
 * und genau dort versucht man, eine Anwendung zum Homescreen hinzuzufügen.
 * Nachgemessen an der laufenden Fassung: null Registrierungen.
 *
 * Die Registrierung ist unabhängig von Benachrichtigungen und fragt nichts —
 * sie macht die Anwendung installierbar. Ob es klingelt, entscheidet weiterhin
 * allein die Glocke.
 *
 * Bewusst ohne await und ohne Fehlerbehandlung nach aussen: schlägt sie fehl,
 * gibt es eben keine Installation. Die Anwendung selbst läuft weiter.
 */
void serviceWorkerRegistrieren();

const rootEl = document.getElementById('root');
if (!rootEl) {
    throw new Error('Root element #root not found in index.html');
}

const router = createBrowserRouter([{ path: '*', element: (
    <ErrorBoundary>
        <I18nProvider>
            <App />
            <Toaster position="top-right" theme="system" richColors closeButton toastOptions={{
                style: { background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--text-primary))' },
            }} />
        </I18nProvider>
    </ErrorBoundary>
) }]);

createRoot(rootEl).render(
    <StrictMode>
        {/* Helle Vorgabe; eine bewusst gewählte dunkle Ansicht bleibt erhalten. */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
            <RouterProvider router={router} />
        </ThemeProvider>
    </StrictMode>
);
