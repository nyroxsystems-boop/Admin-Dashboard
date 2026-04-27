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

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

export default function App(): JSX.Element {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <Suspense fallback={<LoadingState label="Lade Anwendung…" />}>
                    <AdminRoutes />
                </Suspense>
            </AuthProvider>
        </QueryClientProvider>
    );
}
