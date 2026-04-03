/**
 * Admin API Client for Admin Dashboard
 * Handles all API communication with the backend
 */

/// <reference types="vite/client" />

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// Auth State Management
// ============================================================================

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
    authToken = token;
    if (token) {
        localStorage.setItem('admin_token', token);
    } else {
        localStorage.removeItem('admin_token');
    }
}

export function getAuthToken(): string | null {
    if (!authToken) {
        authToken = localStorage.getItem('admin_token');
    }
    return authToken;
}

export function clearAuth() {
    authToken = null;
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
}

// ============================================================================
// API Fetch Wrapper
// ============================================================================

async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const token = getAuthToken();

    // Read CSRF token from cookie for Double-Submit pattern
    const csrfToken = document.cookie.split('; ')
        .find(c => c.startsWith('csrf_token='))?.split('=')[1] || '';

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        ...options.headers as Record<string, string>,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (response.status === 401) {
            // Only force logout if the auth-validation endpoint itself returned 401
            // (i.e., the token is truly invalid). Don't logout for 401 on data endpoints.
            const isAuthEndpoint = endpoint.includes('/admin-auth/me') || endpoint.includes('/admin-auth/login');
            if (isAuthEndpoint) {
                clearAuth();
                window.dispatchEvent(new CustomEvent('auth:expired'));
            }
            throw new Error('Sitzung abgelaufen – bitte erneut anmelden');
        }

        // Retry on 5xx with exponential backoff
        if (response.status >= 500 && response.status < 600) {
            lastError = new Error(`Server error ${response.status} on ${endpoint}`);
            const waitMs = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, waitMs));
            continue;
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || 'API Error');
        }

        return response.json();
    }

    throw lastError || new Error(`Server error after ${MAX_RETRIES} retries: ${endpoint}`);
}

// ============================================================================
// Admin Authentication API
// ============================================================================

export interface AdminUser {
    id: number;
    username: string;
    email: string;
    must_change_password: boolean;
}

export interface LoginResponse {
    access: string;
    user: AdminUser;
}

export async function adminLogin(username: string, password: string): Promise<LoginResponse> {
    const response = await apiFetch('/api/admin-auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });

    if (response.access) {
        setAuthToken(response.access);
        localStorage.setItem('admin_user', JSON.stringify(response.user));
    }

    return response;
}

export async function adminLogout(): Promise<void> {
    try {
        await apiFetch('/api/admin-auth/logout', { method: 'POST' });
    } finally {
        clearAuth();
    }
}

export async function getAdminMe(): Promise<AdminUser> {
    return await apiFetch('/api/admin-auth/me');
}

export async function requestPasswordReset(username: string): Promise<{ success: boolean; message: string }> {
    return await apiFetch('/api/admin-auth/request-reset', {
        method: 'POST',
        body: JSON.stringify({ username })
    });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return await apiFetch('/api/admin-auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
    });
}

export async function updateSignature(signature: string): Promise<{ success: boolean }> {
    return await apiFetch('/api/admin-auth/update-signature', {
        method: 'PATCH',
        body: JSON.stringify({ signature })
    });
}

export async function listAdminUsers(): Promise<{ admins: AdminUser[] }> {
    return await apiFetch('/api/admin-auth/list-admins');
}

export async function updateAdminUserEmail(adminId: number, email: string): Promise<{ success: boolean }> {
    return await apiFetch('/api/admin-auth/update-email', {
        method: 'PUT',
        body: JSON.stringify({ adminId, email })
    });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return await apiFetch('/api/admin-auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword })
    });
}

// ============================================================================
// Activity Log API
// ============================================================================

export interface ActivityLogEntry {
    id: string;
    admin_username: string;
    action_type: string;
    entity_type: string;
    entity_id?: string;
    entity_name?: string;
    old_value?: string;
    new_value?: string;
    ip_address?: string;
    timestamp: string;
}

export async function getActivityLog(limit: number = 50): Promise<ActivityLogEntry[]> {
    return await apiFetch(`/api/admin/activity-log?limit=${limit}`);
}

// ============================================================================
// Email Templates API
// ============================================================================

export interface GeneratedEmail {
    subject: string;
    preview: string;
    htmlContent: string;
    plainText: string;
}

export interface EmailRecipient {
    email: string;
    name: string;
    id: string;
}

export async function generateEmailTemplate(prompt: string): Promise<{ success: boolean; email: GeneratedEmail }> {
    return await apiFetch('/api/admin/emails/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt })
    });
}

export async function improveEmailTemplate(prompt: string, existingContent: string): Promise<{ success: boolean; email: GeneratedEmail }> {
    return await apiFetch('/api/admin/emails/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt, improve: true, existingContent })
    });
}

export async function getEmailRecipients(type: 'active' | 'cancelled' | 'trial' | 'all'): Promise<{ type: string; count: number; recipients: EmailRecipient[] }> {
    return await apiFetch(`/api/admin/emails/recipients/${type}`);
}

export async function sendMarketingEmail(
    subject: string,
    htmlContent: string,
    recipientType?: string,
    customEmails?: string[]
): Promise<{ success: boolean; sent: number; failed: number; total: number }> {
    return await apiFetch('/api/admin/emails/send', {
        method: 'POST',
        body: JSON.stringify({ subject, htmlContent, recipientType, customEmails })
    });
}

export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    html_content: string;
    prompt?: string;
    created_by?: string;
    created_at: string;
}

export async function getSavedTemplates(): Promise<EmailTemplate[]> {
    return await apiFetch('/api/admin/emails/templates');
}

export async function saveEmailTemplate(name: string, subject: string, htmlContent: string, prompt?: string): Promise<{ success: boolean; id: string }> {
    return await apiFetch('/api/admin/emails/templates', {
        method: 'POST',
        body: JSON.stringify({ name, subject, htmlContent, prompt })
    });
}

// ============================================================================
// Re-export existing API functions with token integration
// ============================================================================

export interface AdminStats {
    total_tenants: number;
    total_users: number;
    total_devices: number;
    tenants: Tenant[];
    history?: { name: string; orders: number; revenue: number }[];
    kpis?: {
        sales: { totalOrders: number; ordersToday: number; revenue: number; conversionRate: number };
        team: { activeUsers: number; tenantCount: number; messagesSent: number };
        oem: { resolvedCount: number; successRate: number };
    };
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

export async function getAdminStats(): Promise<AdminStats> {
    // Use the combined /stats endpoint — returns everything in one call
    const [stats, kpis] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/kpis').catch(() => null),
    ]);

    return {
        total_tenants: stats.total_tenants,
        total_users: stats.total_users,
        total_devices: stats.total_devices,
        tenants: stats.tenants,
        history: kpis?.history || [],
        kpis: kpis ? {
            sales: kpis.sales,
            team: kpis.team,
            oem: kpis.oem,
        } : undefined,
    };
}

export interface TenantDetail {
    id: string;
    users: Array<{
        id: string; name: string; email: string; username: string;
        role: string; is_active: boolean; created_at: string;
    }>;
    devices: Array<{
        device_id: string; user_agent: string; ip_address: string;
        created_at: string; last_seen_at: string;
    }>;
    orders: Array<{
        id: string; status: string; oem_number: string | null;
        part_name: string; customer: string; created_at: string;
        total: number | null; vehicle_brand: string | null;
        vehicle_model: string | null; vehicle_year: number | null;
    }>;
    settings: { max_users: number; max_devices: number; whatsapp_number?: string; onboarding_status?: string; payment_status?: string };
    stats: {
        total_orders: number; oem_resolved: number; oem_rate: number;
        total_messages: number; revenue: number;
        user_count: number; device_count: number;
    };
    audit: Array<{ id: number; admin_user: string; action: string; details: string | null; created_at: string }>;
}

export async function getTenantDetail(tenantId: number | string): Promise<{ tenant: TenantDetail }> {
    return apiFetch(`/api/admin/tenants/${tenantId}/detail`);
}

export async function deactivateTenant(tenantId: number | string): Promise<{ success: boolean }> {
    return apiFetch(`/api/admin/tenants/${tenantId}/deactivate`, { method: 'POST' });
}

export async function activateTenant(tenantId: number | string): Promise<{ success: boolean }> {
    return apiFetch(`/api/admin/tenants/${tenantId}/activate`, { method: 'POST' });
}

export interface AuditLogEntry {
    id: number;
    admin_user: string;
    action: string;
    details: string | null;
    ip_address: string;
    created_at: string;
}

export async function getAuditLog(): Promise<{ logs: AuditLogEntry[] }> {
    return apiFetch('/api/admin/audit-log');
}

export async function createTenant(data: {
    name: string;
    email: string;
    website?: string;
    phone?: string;
    password?: string;
    whatsapp_number?: string;
    logo_url?: string
}): Promise<any> {
    return apiFetch('/api/admin/tenants', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

export async function listActiveDevices(tenantId: number): Promise<ActiveDevice[]> {
    return await apiFetch(`/api/admin/tenants/${tenantId}/devices`);
}

export async function removeActiveDevice(tenantId: number, deviceId: string): Promise<void> {
    await apiFetch(`/api/admin/tenants/${tenantId}/remove-device`, {
        method: 'POST',
        body: JSON.stringify({ device_id: deviceId })
    });
}

export async function updateTenantLimits(
    tenantId: number,
    limits: { max_users: number; max_devices: number }
): Promise<void> {
    await apiFetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify(limits)
    });
}

export async function createTenantUser(
    tenantId: number,
    user: { email: string; username: string; password: string; role: string }
): Promise<void> {
    await apiFetch(`/api/admin/tenants/${tenantId}/users`, {
        method: 'POST',
        body: JSON.stringify(user)
    });
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

export async function getOemDatabaseStats(): Promise<OemDatabaseStats> {
    return await apiFetch('/api/admin/oem-database/stats');
}

export async function triggerOemSeeder(script: 'massive' | 'remaining' | 'standalone' = 'massive'): Promise<{ success: boolean; jobId: string; message: string }> {
    return await apiFetch('/api/admin/oem-database/seed', {
        method: 'POST',
        body: JSON.stringify({ script })
    });
}

// OEM Registry CRUD
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

// ============================================================================
// Accuracy Analytics API
// ============================================================================

export interface AccuracyStats {
    totalResolutions: number;
    withOem: number;
    withoutOem: number;
    confirmed: number;
    rejected: number;
    pending: number;
    resolutionRate: number;
    accuracyRate: number;
    avgConfidence: number;
    avgDurationMs: number;
    sourceStats: Record<string, { contributed: number; confirmed: number; rejected: number }>;
    brandStats: Record<string, { total: number; resolved: number; confirmed: number }>;
}

export async function fetchAccuracyStats(): Promise<AccuracyStats> {
    const res = await apiFetch('/api/v1/admin/accuracy/stats');
    return res.data;
}

// ============================================================================
// OEM Lookup Tester
// ============================================================================

export interface OemLookupResult {
    oem: string;
    existsInRegistry: boolean;
    registryRecord: {
        id: number;
        oem: string;
        brand: string;
        part_category: string;
        part_description: string;
        model: string;
        confidence: number;
    } | null;
    aiResult: {
        partName: string;
        brand: string;
        part_category: string;
        part_description: string;
        model: string;
        vehicles: string;
        manufacturer: string;
        confidence: number;
        notes: string;
    };
}

export async function lookupOem(oem: string): Promise<OemLookupResult> {
    return apiFetch('/api/admin/oem-lookup', {
        method: 'POST',
        body: JSON.stringify({ oem })
    });
}

export async function approveOemResult(data: {
    oem: string;
    brand: string;
    part_category: string;
    part_description: string;
    model: string;
    confidence: number;
}): Promise<{ success: boolean; action: string; id: number }> {
    return apiFetch('/api/admin/oem-lookup/approve', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

/** Forward OEM Resolution: Vehicle + Part → OEM via Hydra v2 engine */
export async function resolveOemForward(params: {
    vehicle: { vin?: string; hsn?: string; tsn?: string; make?: string; model?: string; year?: string; engine?: string };
    part: string;
}): Promise<{
    success: boolean;
    oem: string | null;
    candidates: Array<{ oem: string; brand: string; confidence: number; source: string; note?: string }>;
    notes: string | null;
    confidence: number;
}> {
    return apiFetch('/api/demo/oem-resolve', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

/** Reverse OEM Lookup via bot-testing endpoint */
export async function reverseOemLookup(oem: string): Promise<{
    success: boolean;
    oem: string;
    partName?: string;
    partCategory?: string;
    vehicles?: string;
    manufacturer?: string;
    confidence?: number;
    notes?: string;
}> {
    return apiFetch('/api/bot-testing/oem-reverse-lookup', {
        method: 'POST',
        body: JSON.stringify({ oem }),
    });
}

// ============================================================================
// PartsLink24 Catalog Scraper (standalone service on port 4100)
// ============================================================================

const CATALOG_SCRAPER_URL = 'https://oemdetectservice-production.up.railway.app';

export interface PartslinkResult {
    success: boolean;
    vin: string;
    part: string;
    brand?: string | null;
    results: Array<{
        oem: string;
        description: string;
        bildtafel?: string;
        hg?: string;
        fg?: string;
    }>;
    fromCache: boolean;
    elapsedMs?: number;
    cachedAt?: string;
    error?: string;
}

export async function lookupPartslink24(params: {
    vin: string;
    part: string;
    brand?: string;
}): Promise<PartslinkResult> {
    const res = await fetch(`${CATALOG_SCRAPER_URL}/api/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Catalog Scraper Error: ${res.status}`);
    }

    return res.json();
}

export async function getPartslinkHealth(): Promise<{ status: string; service: string }> {
    const res = await fetch(`${CATALOG_SCRAPER_URL}/api/health`);
    if (!res.ok) throw new Error('Catalog Scraper not reachable');
    return res.json();
}
