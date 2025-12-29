// Admin Dashboard API Module
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_TOKEN = import.meta.env.VITE_WAWI_API_TOKEN || 'api_dev_secret';

export interface AdminStats {
    total_tenants: number;
    total_users: number;
    total_devices: number;
    tenants: Tenant[];
}

export interface Tenant {
    id: number;
    name: string;
    slug: string;
    user_count: number;
    max_users: number;
    device_count: number;
    max_devices: number;
    is_active: boolean;
}

export interface ActiveDevice {
    id: string;
    device_id: string;
    user: string;
    last_seen: string;
    ip: string;
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Token ${API_TOKEN}`,
        ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
}

// Real API Implementation
export async function getAdminStats(): Promise<AdminStats> {
    // 1. Get KPIs
    const kpis = await apiFetch('/api/admin/kpis');
    // 2. Get Tenants (Dealers)
    const tenants = await apiFetch('/api/admin/tenants');

    return {
        total_tenants: tenants.length,
        total_users: kpis.team.activeUsers, // using KPI data
        total_devices: 0, // Not tracked yet
        tenants: tenants
    };
}

export async function createTenant(data: { name: string, email: string, website?: string, phone?: string }): Promise<void> {
    await apiFetch('/api/admin/tenants', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

export async function listActiveDevices(tenantId: number): Promise<ActiveDevice[]> {
    return []; // Not implemented yet
}

export async function removeActiveDevice(tenantId: number, deviceId: string): Promise<void> {
    // Not implemented yet
}

export async function updateTenantLimits(
    tenantId: number,
    limits: { max_users: number; max_devices: number }
): Promise<void> {
    // Not implemented yet
}

export async function createTenantUser(
    tenantId: number,
    user: { email: string; username: string; password: string; role: string }
): Promise<void> {
    await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...user, tenant_id: tenantId })
    });
}

export async function getTeam(): Promise<any[]> {
    return await apiFetch('/api/admin/users');
}
