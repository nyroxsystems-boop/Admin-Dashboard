/**
 * adminRoutes — alle Routen des Admin-Dashboards mit Lazy-Loading.
 *
 * Aufbau:
 *   - Öffentlich (/login, /reset-password) ohne Layout.
 *   - /mail läuft in einer EIGENEN Hülle (MailLayout) ohne Seitenleiste —
 *     das Mailprogramm braucht den ganzen Bildschirm.
 *   - Alles Übrige im AdminLayout.
 *
 * Verwaltungsbereiche (Admins, Audit, Support, Postfach-Rechte, Wartung) liegen
 * gebündelt unter /einstellungen statt einzeln in der Seitenleiste. Die alten
 * Pfade bleiben als Weiterleitung bestehen, damit gespeicherte Links und
 * Lesezeichen weiter funktionieren.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { MailLayout } from '@/components/layout/MailLayout';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';

const OverviewView = lazy(() => import('@/views/dashboard/OverviewView'));
const NotesView = lazy(() => import('@/views/dashboard/NotesView'));
const FeedbackView = lazy(() => import('@/views/dashboard/FeedbackView'));
const TenantsListView = lazy(() => import('@/views/tenants/TenantsListView'));
const TenantDetailView = lazy(() => import('@/views/tenants/TenantDetailView'));
const TenantWizard = lazy(() => import('@/views/tenants/TenantWizard'));
const OnboardingPipelineView = lazy(() => import('@/views/onboarding/OnboardingPipelineView'));
const AccessRequestsView = lazy(() => import('@/views/access/AccessRequestsView'));
const CalendarView = lazy(() => import('@/views/calendar/CalendarView'));
const OemFinderView = lazy(() => import('@/views/operations/OemFinderView'));
const OutreachView = lazy(() => import('@/views/operations/OutreachView'));
const MarketingView = lazy(() => import('@/views/marketing/MarketingView'));

// ── Einstellungen ──────────────────────────────────────────────────────────
const SettingsLayout = lazy(() => import('@/views/settings/SettingsLayout'));
const ProfileView = lazy(() => import('@/views/settings/ProfileView'));
const AdminsListView = lazy(() => import('@/views/admins/AdminsListView'));
const MailboxAdminView = lazy(() => import('@/views/operations/MailboxAdminView'));
const MailRulesView = lazy(() => import('@/views/settings/MailRulesView'));
const SupportConsoleView = lazy(() => import('@/views/support/SupportConsoleView'));
const AuditLogView = lazy(() => import('@/views/audit/AuditLogView'));
const MaintenanceView = lazy(() => import('@/views/maintenance/MaintenanceView'));

// ── Mail (eigene Hülle) ────────────────────────────────────────────────────
const InboxView = lazy(() => import('@/views/operations/InboxView'));

/**
 * Nicht mehr in der Navigation, aber weiterhin per Adresse erreichbar.
 * Bewusst nicht gelöscht: die Ansichten funktionieren, sie werden nur selten
 * gebraucht. Wer einen Link darauf gespeichert hat, soll ihn behalten können.
 */
const BotTestingView = lazy(() => import('@/views/operations/BotTestingView'));
const E2EFlowRunnerView = lazy(() => import('@/views/testing/E2EFlowRunnerView'));
const LiveSimulationView = lazy(() => import('@/views/testing/LiveSimulationView'));
const OrdersView = lazy(() => import('@/views/operations/OrdersView'));
const OeQualityView = lazy(() => import('@/views/operations/OeQualityView'));

const LoginView = lazy(() => import('@/views/auth/LoginView'));
const PasswordResetView = lazy(() => import('@/views/auth/PasswordResetView'));
const ForcePasswordChangeView = lazy(() => import('@/views/auth/ForcePasswordChangeView'));
const NotFoundView = lazy(() => import('./NotFoundView'));
const DesignSystemView = lazy(() => import('@/views/dev/DesignSystemView'));

function withSuspense(node: JSX.Element): JSX.Element {
    return <Suspense fallback={<LoadingState label="Lade…" />}>{node}</Suspense>;
}

function superAdminOnly(node: JSX.Element): JSX.Element {
    return <ProtectedRoute requiredRole="SUPER_ADMIN">{node}</ProtectedRoute>;
}

/**
 * RequirePasswordChanged — blockt ALLE geschützten Routen, solange der
 * eingeloggte Admin noch sein Initial-Passwort verwendet
 * (user.must_change_password === true). Das Backend antwortet in diesem
 * Zustand ohnehin auf jeden /api/admin/*-Call mit 403 PASSWORD_CHANGE_REQUIRED
 * — hier wird stattdessen sauber auf /change-password umgeleitet.
 * /change-password selbst liegt AUSSERHALB dieses Guards (ruft nur die
 * ungegateten /api/admin-auth/*-Endpoints).
 */
function RequirePasswordChanged({ children }: { children: ReactNode }): JSX.Element {
    const { user } = useAuth();
    if (user?.must_change_password === true) {
        return <Navigate to="/change-password" replace />;
    }
    return <>{children}</>;
}

function guarded(node: ReactNode): JSX.Element {
    return (
        <ProtectedRoute>
            <RequirePasswordChanged>{node}</RequirePasswordChanged>
        </ProtectedRoute>
    );
}

export function AdminRoutes(): JSX.Element {
    return (
        <Routes>
            <Route path="/login" element={withSuspense(<LoginView />)} />
            <Route path="/reset-password" element={withSuspense(<PasswordResetView />)} />
            {/* P5.1: Design-System-Showcase — NUR im Dev-Build, ohne Login. */}
            {import.meta.env.DEV && (
                <Route path="/design-system" element={withSuspense(<DesignSystemView />)} />
            )}
            {/* Befund B3: liegt bewusst AUSSERHALB von RequirePasswordChanged —
                sonst könnte ein Admin mit Pflicht-Passwortwechsel die Wechsel-
                Seite selbst nie erreichen (Deadlock). */}
            <Route
                path="/change-password"
                element={<ProtectedRoute>{withSuspense(<ForcePasswordChangeView />)}</ProtectedRoute>}
            />

            {/* ── Mailsystem: eigene Hülle, kein Dashboard-Rahmen ── */}
            <Route path="/mail" element={guarded(<MailLayout />)}>
                <Route index element={withSuspense(<InboxView />)} />
            </Route>

            {/* ── Dashboard ── */}
            <Route element={guarded(<AdminLayout />)}>
                <Route index element={withSuspense(<OverviewView />)} />
                <Route path="calendar" element={withSuspense(<CalendarView />)} />
                <Route path="notizen" element={withSuspense(<NotesView />)} />
                <Route path="feedback" element={withSuspense(<FeedbackView />)} />

                <Route path="tenants" element={withSuspense(<TenantsListView />)} />
                <Route path="tenants/new" element={withSuspense(<TenantWizard />)} />
                <Route path="tenants/:id" element={withSuspense(<TenantDetailView />)} />
                <Route path="onboarding" element={withSuspense(<OnboardingPipelineView />)} />
                <Route path="access-requests" element={withSuspense(<AccessRequestsView />)} />
                <Route path="oem-finder" element={withSuspense(<OemFinderView />)} />
                <Route path="outreach" element={withSuspense(<OutreachView />)} />
                <Route path="marketing" element={withSuspense(<MarketingView />)} />

                {/* ── Einstellungen mit Unterbereichen ── */}
                <Route path="einstellungen" element={withSuspense(<SettingsLayout />)}>
                    <Route index element={withSuspense(<ProfileView />)} />
                    <Route path="admins" element={superAdminOnly(withSuspense(<AdminsListView />))} />
                    <Route
                        path="postfaecher"
                        element={superAdminOnly(withSuspense(<MailboxAdminView />))}
                    />
                    <Route path="regeln" element={withSuspense(<MailRulesView />)} />
                    <Route path="support" element={withSuspense(<SupportConsoleView />)} />
                    <Route path="audit" element={withSuspense(<AuditLogView />)} />
                    <Route path="wartung" element={superAdminOnly(withSuspense(<MaintenanceView />))} />
                </Route>

                {/* Alte Pfade — Lesezeichen sollen weiter funktionieren. */}
                <Route path="inbox" element={<Navigate to="/mail" replace />} />
                <Route path="inbox/verwaltung" element={<Navigate to="/einstellungen/postfaecher" replace />} />
                <Route path="profile" element={<Navigate to="/einstellungen" replace />} />
                <Route path="admins" element={<Navigate to="/einstellungen/admins" replace />} />
                <Route path="audit" element={<Navigate to="/einstellungen/audit" replace />} />
                <Route path="support" element={<Navigate to="/einstellungen/support" replace />} />
                <Route path="maintenance" element={<Navigate to="/einstellungen/wartung" replace />} />

                {/* Nicht mehr in der Navigation, weiterhin per Adresse erreichbar. */}
                <Route path="bot/testing" element={withSuspense(<BotTestingView />)} />
                <Route path="testing/e2e-runner" element={withSuspense(<E2EFlowRunnerView />)} />
                <Route path="testing/live-sim" element={withSuspense(<LiveSimulationView />)} />
                <Route path="orders" element={withSuspense(<OrdersView />)} />
                <Route path="oe-quality" element={withSuspense(<OeQualityView />)} />

                <Route path="*" element={withSuspense(<NotFoundView />)} />
            </Route>
        </Routes>
    );
}

export default AdminRoutes;
