import { describe, it, expect } from 'vitest';
import { hasPermission, hasAnyPermission } from './roles';

describe('RBAC — hasPermission', () => {
  // ── superadmin ──────────────────────────────────────────────
  it('superadmin can manage admin users', () => {
    expect(hasPermission('superadmin', 'admin_users.manage')).toBe(true);
  });

  it('superadmin can create tenants', () => {
    expect(hasPermission('superadmin', 'tenants.create')).toBe(true);
  });

  it('superadmin can access maintenance settings', () => {
    expect(hasPermission('superadmin', 'settings.maintenance')).toBe(true);
  });

  // ── admin ───────────────────────────────────────────────────
  it('admin can create tenants', () => {
    expect(hasPermission('admin', 'tenants.create')).toBe(true);
  });

  it('admin cannot manage admin users', () => {
    expect(hasPermission('admin', 'admin_users.manage')).toBe(false);
  });

  it('admin cannot deactivate tenants', () => {
    expect(hasPermission('admin', 'tenants.deactivate')).toBe(false);
  });

  it('admin cannot access maintenance settings', () => {
    expect(hasPermission('admin', 'settings.maintenance')).toBe(false);
  });

  // ── viewer ──────────────────────────────────────────────────
  it('viewer can view tenants', () => {
    expect(hasPermission('viewer', 'tenants.view')).toBe(true);
  });

  it('viewer can view audit logs', () => {
    expect(hasPermission('viewer', 'audit.view')).toBe(true);
  });

  it('viewer cannot manage admin users', () => {
    expect(hasPermission('viewer', 'admin_users.manage')).toBe(false);
  });

  it('viewer cannot create tenants', () => {
    expect(hasPermission('viewer', 'tenants.create')).toBe(false);
  });

  it('viewer cannot edit users', () => {
    expect(hasPermission('viewer', 'users.edit')).toBe(false);
  });

  // ── undefined role ─────────────────────────────────────────
  it('undefined role has no permissions', () => {
    expect(hasPermission(undefined, 'tenants.view')).toBe(false);
  });
});

describe('RBAC — hasAnyPermission', () => {
  it('returns true when at least one permission matches', () => {
    expect(hasAnyPermission('viewer', ['admin_users.manage', 'tenants.view'])).toBe(true);
  });

  it('returns false when no permissions match', () => {
    expect(hasAnyPermission('viewer', ['admin_users.manage', 'tenants.create'])).toBe(false);
  });

  it('returns false for undefined role', () => {
    expect(hasAnyPermission(undefined, ['tenants.view'])).toBe(false);
  });
});
