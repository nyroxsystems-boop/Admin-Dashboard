/**
 * ProtectedRoute — gate a route by authentication and (optionally) role.
 *
 *   <ProtectedRoute>{children}</ProtectedRoute>                   // any authed admin
 *   <ProtectedRoute requiredRole="SUPER_ADMIN">{children}</...>   // role required
 *
 * Loading: renders a small spinner placeholder.
 * Unauthenticated: redirects to /login with `?redirect=<path>`.
 * Wrong role: renders a 403 view (EmptyState-look).
 */

import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { usePermissions, type Permission } from './usePermissions';
import type { AdminRole } from '../api/types';

interface ProtectedRouteProps {
    children: ReactNode;
    requiredRole?: AdminRole;
    requiredPermission?: Permission;
    fallback?: ReactNode;
}

export function ProtectedRoute({
    children,
    requiredRole,
    requiredPermission,
    fallback,
}: ProtectedRouteProps): JSX.Element {
    const { isAuthenticated, isLoading, user } = useAuth();
    const { hasRole, can } = usePermissions();
    const location = useLocation();

    if (isLoading) {
        return <ProtectedRouteLoading />;
    }

    if (!isAuthenticated) {
        const redirect = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/login?redirect=${redirect}`} replace />;
    }

    if (user?.app_access?.admin === false) {
        return <ForbiddenView />;
    }
    if (requiredRole && !hasRole(requiredRole)) {
        return <>{fallback ?? <ForbiddenView />}</>;
    }
    if (requiredPermission && !can(requiredPermission)) {
        return <>{fallback ?? <ForbiddenView />}</>;
    }

    return <>{children}</>;
}

// ──────────────────────────────────────────────────────────────────────────

function ProtectedRouteLoading(): JSX.Element {
    return (
        <div
            role="status"
            aria-live="polite"
            className="min-h-screen flex items-center justify-center bg-canvas"
        >
            <div className="flex flex-col items-center gap-3 text-text-secondary">
                <div className="w-8 h-8 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
                <span className="text-xs uppercase tracking-widest font-mono">Authenticating</span>
            </div>
        </div>
    );
}

function ForbiddenView(): JSX.Element {
    const { t } = useI18n();
    return (
        <main
            role="main"
            className="min-h-screen flex items-center justify-center bg-canvas px-6"
        >
            <div className="max-w-md text-center surface-card px-8 py-10">
                <div className="text-xs uppercase tracking-widest font-mono text-text-muted mb-3">
                    HTTP 403
                </div>
                <h1 className="text-xl font-display font-semibold mb-2 text-text-primary">
                    {t('errors.forbiddenTitle')}
                </h1>
                <p className="text-sm text-text-secondary leading-relaxed">
                    {t('errors.forbiddenDescription')}
                </p>
            </div>
        </main>
    );
}
