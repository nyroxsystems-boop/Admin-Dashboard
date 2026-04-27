/**
 * adminRoutes — All Admin-Dashboard routes with lazy-loading.
 *
 * Layout-Strategy:
 *   - Public routes (/login, /reset-password) render WITHOUT AdminLayout.
 *   - All other routes are wrapped in <ProtectedRoute><AdminLayout/></ProtectedRoute>.
 */
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ProtectedRoute } from '@/auth/ProtectedRoute';

const OverviewView = lazy(() => import('@/views/dashboard/OverviewView'));
const TenantsListView = lazy(() => import('@/views/tenants/TenantsListView'));
const TenantDetailView = lazy(() => import('@/views/tenants/TenantDetailView'));
const TenantWizard = lazy(() => import('@/views/tenants/TenantWizard'));
const AdminsListView = lazy(() => import('@/views/admins/AdminsListView'));
const AuditLogView = lazy(() => import('@/views/audit/AuditLogView'));
const MaintenanceView = lazy(() => import('@/views/maintenance/MaintenanceView'));

const RegistryView = lazy(() => import('@/views/oem/RegistryView'));
const LookupView = lazy(() => import('@/views/oem/LookupView'));
const BatchTestView = lazy(() => import('@/views/oem/BatchTestView'));
const ErrorReviewView = lazy(() => import('@/views/oem/ErrorReviewView'));
const AccuracyView = lazy(() => import('@/views/oem/AccuracyView'));

const BotTestingView = lazy(() => import('@/views/operations/BotTestingView'));
const InboxView = lazy(() => import('@/views/operations/InboxView'));
const OrdersView = lazy(() => import('@/views/operations/OrdersView'));
const BulkScraperView = lazy(() => import('@/views/operations/BulkScraperView'));

const LoginView = lazy(() => import('@/views/auth/LoginView'));
const PasswordResetView = lazy(() => import('@/views/auth/PasswordResetView'));
const NotFoundView = lazy(() => import('./NotFoundView'));

function withSuspense(node: JSX.Element): JSX.Element {
    return <Suspense fallback={<LoadingState label="Lade…" />}>{node}</Suspense>;
}

function superAdminOnly(node: JSX.Element): JSX.Element {
    return <ProtectedRoute requiredRole="SUPER_ADMIN">{node}</ProtectedRoute>;
}

export function AdminRoutes(): JSX.Element {
    return (
        <Routes>
            <Route path="/login" element={withSuspense(<LoginView />)} />
            <Route path="/reset-password" element={withSuspense(<PasswordResetView />)} />

            <Route
                element={
                    <ProtectedRoute>
                        <AdminLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={withSuspense(<OverviewView />)} />
                <Route path="tenants" element={withSuspense(<TenantsListView />)} />
                <Route path="tenants/new" element={withSuspense(<TenantWizard />)} />
                <Route path="tenants/:id" element={withSuspense(<TenantDetailView />)} />
                <Route path="admins" element={superAdminOnly(withSuspense(<AdminsListView />))} />
                <Route path="audit" element={withSuspense(<AuditLogView />)} />
                <Route
                    path="maintenance"
                    element={superAdminOnly(withSuspense(<MaintenanceView />))}
                />

                <Route path="oem/registry" element={withSuspense(<RegistryView />)} />
                <Route path="oem/lookup" element={withSuspense(<LookupView />)} />
                <Route path="oem/batch" element={withSuspense(<BatchTestView />)} />
                <Route path="oem/errors" element={withSuspense(<ErrorReviewView />)} />
                <Route path="oem/accuracy" element={withSuspense(<AccuracyView />)} />

                <Route path="bot/testing" element={withSuspense(<BotTestingView />)} />
                <Route path="inbox" element={withSuspense(<InboxView />)} />
                <Route path="orders" element={withSuspense(<OrdersView />)} />
                <Route path="scraper" element={withSuspense(<BulkScraperView />)} />

                <Route path="*" element={withSuspense(<NotFoundView />)} />
            </Route>
        </Routes>
    );
}

export default AdminRoutes;
