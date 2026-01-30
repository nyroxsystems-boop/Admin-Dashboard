/**
 * Admin API Client for Admin Dashboard
 * Handles all API communication with the backend
 */

/// <reference types="vite/client" />

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://whatsapp-bot-oem-ermittlung.onrender.com';

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

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
    };

    if (token) {
        headers['Authorization'] = `Token ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // Token expired or invalid
        clearAuth();
        window.location.href = '/login';
        throw new Error('Session abgelaufen');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || 'API Error');
    }

    return response.json();
}

// ============================================================================
// Admin Authentication API
// ============================================================================

export interface AdminUser {
    id: string;
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
    const kpis = await apiFetch('/api/admin/kpis');
    const tenants = await apiFetch('/api/admin/tenants');

    return {
        total_tenants: tenants.length,
        total_users: kpis.team?.activeUsers || 0,
        total_devices: 0,
        tenants: tenants,
        history: kpis.history || []
    };
}

export async function createTenant(data: {
    name: string;
    email: string;
    website?: string;
    phone?: string;
    password?: string;
    whatsapp_number?: string;
    logo_url?: string
}): Promise<void> {
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
