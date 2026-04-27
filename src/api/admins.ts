/**
 * Admin User CRUD — list, update, delete admin accounts.
 */

import { apiFetch } from './client';
import { AdminListResponseSchema, parseApiResponse, type Admin, type AdminListResponse } from './types';

export async function listAdmins(): Promise<AdminListResponse> {
    const raw = await apiFetch<unknown>('/api/admin-auth/list-admins');
    return parseApiResponse(AdminListResponseSchema, raw);
}

export async function updateAdminEmail(adminId: number | string, email: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>('/api/admin-auth/update-email', {
        method: 'PUT',
        body: JSON.stringify({ adminId, email }),
    });
}

export async function createAdmin(data: {
    username: string;
    email: string;
    password: string;
    role?: 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'READ_ONLY';
}): Promise<{ success: boolean; admin?: Admin }> {
    return apiFetch<{ success: boolean; admin?: Admin }>('/api/admin-auth/create-admin', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function deleteAdmin(adminId: number | string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/admin-auth/admins/${adminId}`, {
        method: 'DELETE',
    });
}

export async function setAdminRole(
    adminId: number | string,
    role: 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'READ_ONLY'
): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/admin-auth/admins/${adminId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
    });
}
