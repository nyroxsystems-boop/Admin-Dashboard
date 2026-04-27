/**
 * PermissionGate — conditional render based on a permission or role.
 *
 *   <PermissionGate permission="tenants.delete">
 *     <DeleteButton />
 *   </PermissionGate>
 *
 *   <PermissionGate role="SUPER_ADMIN" fallback={<DisabledHint />}>
 *     <AdminCreateButton />
 *   </PermissionGate>
 */

import type { ReactNode } from 'react';
import { usePermissions, type Permission } from './usePermissions';
import type { AdminRole } from '../api/types';

interface PermissionGateProps {
    children: ReactNode;
    permission?: Permission;
    role?: AdminRole;
    /** Rendered when the gate is closed. Defaults to nothing. */
    fallback?: ReactNode;
}

export function PermissionGate({
    children,
    permission,
    role,
    fallback = null,
}: PermissionGateProps): JSX.Element {
    const { can, hasRole } = usePermissions();

    const allowed =
        (permission ? can(permission) : true) && (role ? hasRole(role) : true);

    if (!allowed) return <>{fallback}</>;
    return <>{children}</>;
}
