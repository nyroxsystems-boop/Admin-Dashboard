/**
 * Admin Dashboard Entry Point
 * With authentication routing
 */

import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'

import { AuthProvider, useAuth } from './context/AuthContext'
import { AdminDashboardView } from './views/AdminDashboardView'
import { LoginView } from './views/LoginView'
import { PasswordResetView } from './views/PasswordResetView'

type View = 'login' | 'reset' | 'dashboard';

function AppRouter() {
    const { isAuthenticated, isLoading, user } = useAuth();
    const [view, setView] = useState<View>('login');
    const [resetToken, setResetToken] = useState<string | undefined>();

    // Check URL for password reset token
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (token) {
            setResetToken(token);
            setView('reset');
        }
    }, []);

    // Redirect based on auth state
    useEffect(() => {
        if (!isLoading) {
            if (isAuthenticated) {
                // Clear URL params after login
                window.history.replaceState({}, '', window.location.pathname);
                setView('dashboard');
            } else if (view === 'dashboard') {
                setView('login');
            }
        }
    }, [isAuthenticated, isLoading, view]);

    // Show loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    <span className="text-white/60 text-sm">Wird geladen...</span>
                </div>
            </div>
        );
    }

    // Password reset flow
    if (view === 'reset') {
        return (
            <PasswordResetView
                onBack={() => {
                    setResetToken(undefined);
                    setView('login');
                    window.history.replaceState({}, '', window.location.pathname);
                }}
                resetToken={resetToken}
            />
        );
    }

    // Not authenticated - show login
    if (!isAuthenticated || view === 'login') {
        return (
            <LoginView
                onForgotPassword={() => setView('reset')}
            />
        );
    }

    // Authenticated - show dashboard (password change is in Settings)
    return <AdminDashboardView />;
}

function App() {
    return (
        <AuthProvider>
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: 'rgba(30, 41, 59, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#fff',
                        backdropFilter: 'blur(16px)',
                    },
                }}
            />
            <AppRouter />
        </AuthProvider>
    );
}

import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </StrictMode>
)
