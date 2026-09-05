import type { TenantUser } from '@/api/types';

/** Never substitute a staff account for an owner, or guess between multiple owners. */
export function uniqueTenantOwner(users: TenantUser[]): TenantUser | undefined {
    const owners = users.filter(user => ['merchant', 'owner'].includes(user.role.trim().toLowerCase()));
    return owners.length === 1 ? owners[0] : undefined;
}

/** Mirrors resetUserPasswordSchema, not the separate tenant-create policy. */
export function validTenantResetPassword(password: string): boolean {
    return password.length >= 12 && password.length <= 128;
}
