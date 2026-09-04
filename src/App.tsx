/**
 * App — Top-level shell.
 *
 * Wraps the Admin route-tree in:
 *   - QueryClientProvider (React Query — server state, mutations)
 *   - AuthProvider (user/session state)
 *   - Suspense (for lazy-loaded routes)
 *
 * Providers further outside (ThemeProvider, BrowserRouter, ErrorBoundary,
 * I18nProvider, Toaster) live in main.tsx.
 */
import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AdminRoutes } from './routes/adminRoutes';
import { AuthProvider } from './context/AuthContext';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary';
import { shouldRetryQuery } from '@/lib/queryRetry';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            /**
             * Wie lange Daten OHNE Betrachter im Zwischenspeicher bleiben.
             *
             * Ohne Angabe sind es fünf Minuten. Das war die Ursache dafür, dass
             * der Weg aus dem Mailprogramm zurück ins Dashboard "ewig" dauerte:
             * das Mailprogramm ist eine eigene Hülle, beim Wechsel wird der
             * ganze Dashboard-Baum abgebaut, und wer länger als fünf Minuten
             * Post bearbeitet, kommt mit einem LEEREN Zwischenspeicher zurück.
             * Dann greift `isLoading && !metrics`, die Seite wird weiss, und
             * man wartet auf zwei Abrufe.
             *
             * Die Abrufe selbst sind nicht langsam — gemessen rund 100 ms
             * Umlaufzeit, die Datenbankarbeit dahinter 5 ms. Es war die
             * Kombination aus geräumtem Speicher und einer Seite, die dabei
             * nichts anzeigt.
             *
             * Eine halbe Stunde deckt eine normale Sitzung im Postfach ab. Die
             * Daten sind klein (Kennzahlen, ein paar Listen), und `staleTime`
             * sorgt weiterhin dafür, dass im Hintergrund nachgeladen wird —
             * angezeigt wird sofort der letzte Stand, nicht ein Ladebalken.
             */
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: false,
            // apiFetch already owns the retry budget for network, timeout and
            // 5xx failures. Retrying its typed failures again here would turn
            // three attempts into as many as six and also repeat terminal 4xx
            // requests. Non-API errors still receive one defensive retry.
            retry: shouldRetryQuery,
        },
    },
});

export default function App(): JSX.Element {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <ChunkErrorBoundary>
                    <Suspense fallback={<LoadingState label="Lade Anwendung…" />}>
                        <AdminRoutes />
                    </Suspense>
                </ChunkErrorBoundary>
            </AuthProvider>
        </QueryClientProvider>
    );
}
