/**
 * Tenant Management API — list, get, create, update, deactivate, delete.
 */

import { apiFetch } from './client';
import {
    AdminStatsSchema,
    TenantArraySchema,
    TenantDetailSchema,
    parseApiResponse,
    type AdminStats,
    type Tenant,
    type TenantDetail,
} from './types';

export async function listTenants(): Promise<Tenant[]> {
    const raw = await apiFetch<unknown>('/api/admin/tenants');
    return parseApiResponse(TenantArraySchema, raw);
}

export async function getAdminStats(): Promise<AdminStats> {
    const [stats, kpis] = await Promise.all([
        apiFetch<unknown>('/api/admin/stats'),
        apiFetch<{ history?: AdminStats['history']; sales?: unknown; team?: unknown; oem?: unknown }>(
            '/api/admin/kpis'
        ).catch(() => null),
    ]);
    const merged = {
        ...(stats as Record<string, unknown>),
        history: kpis?.history ?? [],
        kpis: kpis ? { sales: kpis.sales, team: kpis.team, oem: kpis.oem } : undefined,
    };
    return parseApiResponse(AdminStatsSchema, merged);
}

export async function getTenant(tenantId: number | string): Promise<TenantDetail> {
    const raw = await apiFetch<{ tenant: unknown }>(`/api/admin/tenants/${tenantId}/detail`);
    return parseApiResponse(TenantDetailSchema, raw.tenant);
}

export async function createTenant(data: {
    name: string;
    email: string;
    website?: string;
    phone?: string;
    password?: string;
    whatsapp_number?: string;
    logo_url?: string;
}): Promise<{ success: boolean; tenant?: Tenant }> {
    return apiFetch<{ success: boolean; tenant?: Tenant }>('/api/admin/tenants', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateTenant(
    tenantId: number | string,
    data: Partial<{ name: string; whatsapp_number: string; logo_url: string }>
): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/admin/tenants/${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

export async function updateTenantLimits(
    tenantId: number | string,
    limits: { max_users: number; max_devices: number }
): Promise<void> {
    await apiFetch<unknown>(`/api/admin/tenants/${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify(limits),
    });
}

export async function deactivateTenant(tenantId: number | string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/admin/tenants/${tenantId}/deactivate`, {
        method: 'POST',
    });
}

export async function activateTenant(tenantId: number | string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/admin/tenants/${tenantId}/activate`, {
        method: 'POST',
    });
}

export async function deleteTenant(tenantId: number | string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/admin/tenants/${tenantId}`, { method: 'DELETE' });
}

export async function listActiveDevices(tenantId: number | string): Promise<
    Array<{ id: string; device_id: string; user: string; last_seen: string; ip: string }>
> {
    return apiFetch(`/api/admin/tenants/${tenantId}/devices`);
}

export async function removeActiveDevice(tenantId: number | string, deviceId: string): Promise<void> {
    await apiFetch<unknown>(`/api/admin/tenants/${tenantId}/remove-device`, {
        method: 'POST',
        body: JSON.stringify({ device_id: deviceId }),
    });
}

export async function createTenantUser(
    tenantId: number | string,
    user: { email: string; username: string; password: string; role: string }
): Promise<void> {
    await apiFetch<unknown>(`/api/admin/tenants/${tenantId}/users`, {
        method: 'POST',
        body: JSON.stringify(user),
    });
}
