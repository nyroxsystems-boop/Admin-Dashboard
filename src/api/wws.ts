/// <reference types="vite/client" />
// Admin Dashboard API Module
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://whatsapp-bot-oem-ermittlung.onrender.com';
const API_TOKEN = import.meta.env.VITE_WAWI_API_TOKEN;

export interface AdminStats {
    total_tenants: number;
    total_users: number;
    total_devices: number;
    tenants: Tenant[];
    history?: { name: string; orders: number; revenue: number }[];
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
    onboarding_status?: 'pending' | 'completed';

    payment_status?: 'paid' | 'trial' | 'overdue';
    whatsapp_number?: string;
    logo_url?: string;
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
        tenants: tenants,
        history: kpis.history || []
    };
}

export async function createTenant(data: { name: string, email: string, website?: string, phone?: string, password?: string, whatsapp_number?: string, logo_url?: string }): Promise<void> {
    await apiFetch('/api/admin/tenants', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

export async function listActiveDevices(tenantId: number): Promise<ActiveDevice[]> {
    return await apiFetch(`/api/admin/tenants/${tenantId}/devices`);
}

export async function removeActiveDevice(tenantId: number, deviceId: string): Promise<void> {
    await apiFetch(`/api/admin/tenants/${tenantId}/devices/${deviceId}`, {
        method: 'DELETE'
    });
}

export async function updateTenantLimits(
    tenantId: number,
    limits: { max_users: number; max_devices: number }
): Promise<void> {
    await apiFetch(`/api/admin/tenants/${tenantId}/limits`, {
        method: 'PATCH',
        body: JSON.stringify(limits)
    });
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

// ============================================================================
// OEM Database API
// ============================================================================

export interface OemDatabaseStats {
    exists: boolean;
    totalRecords: number;
    sizeBytes: number;
    sizeMB: string;
    brands: { brand: string; count: number }[];
    categories: { part_category: string; count: number }[];
}

export interface OemSeederJob {
    jobId: string;
    status: 'running' | 'completed' | 'failed';
    pid: number;
    startTime: string;
    output: string[];
}

export async function getOemDatabaseStats(): Promise<OemDatabaseStats> {
    return await apiFetch('/api/admin/oem-database/stats');
}

export async function triggerOemSeeder(script: 'massive' | 'remaining' | 'standalone' = 'massive'): Promise<{ success: boolean; jobId: string; message: string }> {
    return await apiFetch('/api/admin/oem-database/seed', {
        method: 'POST',
        body: JSON.stringify({ script })
    });
}

export async function getSeederJobStatus(jobId: string): Promise<OemSeederJob> {
    return await apiFetch(`/api/admin/oem-database/seed/${jobId}`);
}

export async function quickSeedOem(brand: string = 'VOLKSWAGEN', count: number = 1000): Promise<{ success: boolean; added: number; totalRecords: number }> {
    return await apiFetch('/api/admin/oem-database/quick-seed', {
        method: 'POST',
        body: JSON.stringify({ brand, count })
    });
}

// ============================================================================
// OEM Registry CRUD API
// ============================================================================

export interface OemRecord {
    id: number;
    oem: string;
    brand: string;
    part_category: string;
    part_description: string;
    model: string;
    confidence: number;
    sources: string;
    created_at: string;
}

export interface OemRecordsResponse {
    records: OemRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    filters: {
        brands: string[];
        categories: string[];
    };
}

export interface OemSearchParams {
    page?: number;
    limit?: number;
    search?: string;
    brand?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export async function getOemRecords(params: OemSearchParams = {}): Promise<OemRecordsResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.brand) query.set('brand', params.brand);
    if (params.category) query.set('category', params.category);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    return await apiFetch(`/api/admin/oem-records?${query.toString()}`);
}

export async function getOemRecord(id: number): Promise<OemRecord> {
    return await apiFetch(`/api/admin/oem-records/${id}`);
}

export async function updateOemRecord(id: number, data: Partial<OemRecord>): Promise<{ success: boolean }> {
    return await apiFetch(`/api/admin/oem-records/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

export async function createOemRecord(data: Omit<OemRecord, 'id' | 'created_at' | 'sources'>): Promise<{ success: boolean; id: number }> {
    return await apiFetch('/api/admin/oem-records', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

export async function deleteOemRecord(id: number): Promise<{ success: boolean }> {
    return await apiFetch(`/api/admin/oem-records/${id}`, {
        method: 'DELETE'
    });
}

export async function bulkDeleteOemRecords(ids: number[]): Promise<{ success: boolean; deleted: number }> {
    return await apiFetch('/api/admin/oem-records/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids })
    });
}

export async function runOemValidator(fix: boolean = false): Promise<{ success: boolean; jobId: string; message: string }> {
    return await apiFetch('/api/admin/oem-database/validate', {
        method: 'POST',
        body: JSON.stringify({ fix })
    });
}


