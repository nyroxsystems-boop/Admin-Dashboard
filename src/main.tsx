/**
 * Admin Dashboard — Entry Point
 *
 * Provider order (outer → inner):
 *   StrictMode
 *     ThemeProvider (next-themes)         — Light/Dark + persist
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
import { ThemeProvider, useTheme } from 'next-themes';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nProvider } from './i18n';
import { initSentry } from './services/sentry';
import App from './App';
import './index.css';

// Init Sentry before React mounts so boot-time errors are captured.
initSentry();

/**
 * ThemedToaster — Sonner Toaster that follows the active next-themes theme.
 *
 * Lives inside <ThemeProvider> so `useTheme()` resolves correctly.
 */
function ThemedToaster(): JSX.Element {
    const { resolvedTheme } = useTheme();
    return (
        <Toaster
            position="top-right"
            theme={(resolvedTheme as 'light' | 'dark') ?? 'dark'}
            richColors
            closeButton
            toastOptions={{
                style: {
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                },
            }}
        />
    );
}

const rootEl = document.getElementById('root');
if (!rootEl) {
    throw new Error('Root element #root not found in index.html');
}

createRoot(rootEl).render(
    <StrictMode>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <BrowserRouter>
                <ErrorBoundary>
                    <I18nProvider>
                        <App />
                        <ThemedToaster />
                    </I18nProvider>
                </ErrorBoundary>
            </BrowserRouter>
        </ThemeProvider>
    </StrictMode>
);
