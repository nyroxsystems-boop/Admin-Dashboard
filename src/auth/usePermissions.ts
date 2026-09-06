/**
 * usePermissions — RBAC for the Admin Dashboard.
 *
 * Roles (canonical):
 *   SUPER_ADMIN    — full access
 *   SUPPORT_ADMIN  — read + non-destructive actions
 *   READ_ONLY      — read-only
 *
 * Legacy backend roles (`superadmin`, `admin`, `viewer`) are normalized
 * here so the UI can rely on a single enum.
 */

import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import type { AdminRole } from '../api/types';

export type Permission =
    // Tenants
    | 'tenants.read'
    | 'tenants.create'
    | 'tenants.update'
    | 'tenants.delete'
    | 'tenants.activate'
    | 'tenants.deactivate'
    | 'tenants.impersonate'
    | 'users.resetPassword'
    | 'billing.manage'
    // Marketing
    | 'marketing.read'
    | 'marketing.manage'
    // Admins (read-only + self-service email; no create/delete/role server endpoints)
    | 'admins.read'
    | 'admins.update'
    // Audit
    | 'audit.read'
    | 'audit.export'
    // OEM
    | 'oem.read'
    | 'oem.create'
    | 'oem.update'
    | 'oem.delete'
    | 'oem.bulkDelete'
    | 'oem.seed'
    | 'oem.validate'
    // Maintenance
    | 'maintenance.read'
    | 'maintenance.toggle'
    // Bot Testing
    | 'bot.test'
    // Inbox
    | 'inbox.read'
    | 'inbox.reply'
    // Orders
    | 'orders.read'
    | 'orders.update'
    // Emails
    | 'emails.send'
    | 'emails.template.create';

const READ_ONLY_PERMISSIONS: ReadonlySet<Permission> = new Set([
    'tenants.read',
    'admins.read',
    'audit.read',
    'oem.read',
    'maintenance.read',
    'inbox.read',
    'orders.read',
    'marketing.read',
]);

const SUPPORT_ADMIN_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
    ...READ_ONLY_PERMISSIONS,
    'tenants.update',
    'tenants.activate',
    'tenants.deactivate',
    'audit.export',
    'oem.create',
    'oem.update',
    'oem.seed',
    'oem.validate',
    'inbox.reply',
    'orders.update',
    'bot.test',
]);

// Super admin — anything. Implemented via a wildcard branch.

/** Map any backend role string (legacy or new) to canonical AdminRole. */
export function normalizeRole(raw: string | undefined | null): AdminRole | null {
    if (!raw) return null;
    const r = raw.toUpperCase();
    if (r === 'SUPER_ADMIN' || r === 'SUPERADMIN') return 'SUPER_ADMIN';
    if (r === 'SUPPORT_ADMIN' || r === 'ADMIN') return 'SUPPORT_ADMIN';
    if (r === 'READ_ONLY' || r === 'VIEWER' || r === 'READONLY') return 'READ_ONLY';
    return null;
}

/**
 * Pure permission check — usable outside React (e.g. command registry).
 */
export function checkPermission(role: AdminRole | null, permission: Permission): boolean {
    if (!role) return false;
    if (role === 'SUPER_ADMIN') return true;
    if (role === 'SUPPORT_ADMIN') return SUPPORT_ADMIN_PERMISSIONS.has(permission);
    if (role === 'READ_ONLY') return READ_ONLY_PERMISSIONS.has(permission);
    return false;
}

export function checkRole(role: AdminRole | null, required: AdminRole): boolean {
    if (!role) return false;
    if (required === 'READ_ONLY') return true; // any role satisfies READ_ONLY
    if (required === 'SUPPORT_ADMIN') return role === 'SUPPORT_ADMIN' || role === 'SUPER_ADMIN';
    if (required === 'SUPER_ADMIN') return role === 'SUPER_ADMIN';
    return false;
}

export interface UsePermissionsResult {
    role: AdminRole | null;
    can: (permission: Permission) => boolean;
    hasRole: (required: AdminRole) => boolean;
    isSuperAdmin: boolean;
    isReadOnly: boolean;
}

export function usePermissions(): UsePermissionsResult {
    const { user } = useAuth();

    return useMemo(() => {
        const role = normalizeRole(typeof user?.role === 'string' ? user.role : null);
        return {
            role,
            can: (permission: Permission) => checkPermission(role, permission),
            hasRole: (required: AdminRole) => checkRole(role, required),
            isSuperAdmin: role === 'SUPER_ADMIN',
            isReadOnly: role === 'READ_ONLY',
        };
    }, [user?.role]);
}
