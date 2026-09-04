/**
 * Admin Dashboard — Entry Point
 *
 * Provider order (outer → inner):
 *   StrictMode
 *     ThemeProvider (next-themes)         — hell/dunkel, Vorgabe dunkel
 *       BrowserRouter                     — URL state, bookmarkable views
 *         ErrorBoundary                   — Sentry-ready fallback
 *           I18nProvider                  — locale loading + t()
 *             <App />                     — owns QueryClient + AuthProvider + Routes
 *             <Toaster />                 — Sonner global toast stack
 *
 * Wired here:
 *   - initSentry() runs first; no-op if VITE_SENTRY_DSN is missing.
 *
 * Note: QueryClientProvider and AuthProvider live INSIDE <App /> (see App.tsx),
 * because AuthProvider needs useNavigate (so it must be under BrowserRouter)
 * but it's also coupled to the route tree it guards via ProtectedRoute.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nProvider } from './i18n';
import { initSentry } from './services/sentry';
import { serviceWorkerRegistrieren } from './lib/push';
import App from './App';
// Selbst gehostete Marken-Schriften (DSGVO: kein CDN). VOR index.css, damit
// die font-family-Stacks aus tokens.css auf geladene Schriften treffen.
//
// Redesign vom 2026-07-30: Space Grotesk fuer Ueberschriften, Manrope fuer
// Text, JetBrains Mono fuer Marken und Zahlen. Die Vorlage laedt sie von
// Google Fonts — hier selbst gehostet, damit kein Abruf zu einem Dritten geht.
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/manrope';
import '@fontsource-variable/jetbrains-mono';
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

createRoot(rootEl).render(
    <StrictMode>
        {/* Hell und dunkel, Vorgabe dunkel — der Entwurf ist dunkel gezeichnet,
            und wer nichts wählt, soll ihn so sehen. `enableSystem` bleibt aus:
            wer umschaltet, will es nicht beim nächsten Sonnenuntergang wieder
            anders. next-themes setzt `class="light"/"dark"` auf <html>; die
            Tokens hängen an `html.light` (design-system/tokens.css) und
            verhindern über ein eingespritztes Skript, dass beim Laden einmal
            die falsche Fassung aufblitzt. */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
            <BrowserRouter>
                <ErrorBoundary>
                    <I18nProvider>
                        <App />
                        <Toaster
                            position="top-right"
                            theme="dark"
                            richColors
                            closeButton
                            toastOptions={{
                                style: {
                                    background: 'hsl(var(--bg-elevated))',
                                    border: '1px solid hsl(var(--border))',
                                    color: 'hsl(var(--text-primary))',
                                },
                            }}
                        />
                    </I18nProvider>
                </ErrorBoundary>
            </BrowserRouter>
        </ThemeProvider>
    </StrictMode>
);
