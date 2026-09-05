import { describe, expect, it } from 'vitest';
import { TenantUserSchema } from '@/api/types';
import { checkPermission } from '@/auth/usePermissions';
import { uniqueTenantOwner, validTenantResetPassword } from './tenantOwner';
const user = (id: string, role: string) => TenantUserSchema.parse({ id, role, email: `${id}@example.invalid`, created_at: '2026-09-05' });
describe('Tenant owner and password reset safety', () => {
    it('never guesses a staff account or one of multiple owners', () => {
        expect(uniqueTenantOwner([user('staff', 'staff')])).toBeUndefined();
        expect(uniqueTenantOwner([user('a', 'owner'), user('b', 'merchant')])).toBeUndefined();
        expect(uniqueTenantOwner([user('staff', 'staff'), user('a', ' OWNER ')] )?.id).toBe('a');
    });
    it('matches the existing server reset length bounds', () => {
        expect(validTenantResetPassword('a'.repeat(11))).toBe(false);
        expect(validTenantResetPassword('a'.repeat(12))).toBe(true);
        expect(validTenantResetPassword('a'.repeat(128))).toBe(true);
        expect(validTenantResetPassword('a'.repeat(129))).toBe(false);
    });
    it('only exposes reset permission to superadmins', () => {
        expect(checkPermission('SUPER_ADMIN', 'users.resetPassword')).toBe(true);
        expect(checkPermission('SUPPORT_ADMIN', 'users.resetPassword')).toBe(false);
        expect(checkPermission('READ_ONLY', 'users.resetPassword')).toBe(false);
        expect(checkPermission(null, 'users.resetPassword')).toBe(false);
    });
});
