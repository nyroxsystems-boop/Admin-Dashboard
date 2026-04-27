/**
 * Admin RBAC — Role-Based Access Control
 *
 * Roles are returned by the backend in the AdminUser object.
 * The frontend uses hasPermission() to gate UI elements.
 */

export type AdminRole = 'superadmin' | 'admin' | 'viewer';

export type Permission =
    | 'tenants.create'
    | 'tenants.edit'
    | 'tenants.deactivate'
    | 'tenants.view'
    | 'users.create'
    | 'users.edit'
    | 'users.view'
    | 'admin_users.manage'
    | 'oem.registry'
    | 'oem.seed'
    | 'oem.lookup'
    | 'settings.view'
    | 'settings.maintenance'
    | 'audit.view';

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
    superadmin: [
        'tenants.create', 'tenants.edit', 'tenants.deactivate', 'tenants.view',
        'users.create', 'users.edit', 'users.view',
        'admin_users.manage',
        'oem.registry', 'oem.seed', 'oem.lookup',
        'settings.view', 'settings.maintenance',
        'audit.view',
    ],
    admin: [
        'tenants.create', 'tenants.edit', 'tenants.view',
        'users.create', 'users.edit', 'users.view',
        'oem.registry', 'oem.lookup',
        'settings.view',
        'audit.view',
    ],
    viewer: [
        'tenants.view',
        'users.view',
        'oem.lookup',
        'audit.view',
    ],
};

export function hasPermission(role: AdminRole | undefined, permission: Permission): boolean {
    if (!role) return false;
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: AdminRole | undefined, permissions: Permission[]): boolean {
    if (!role) return false;
    return permissions.some(p => hasPermission(role, p));
}
