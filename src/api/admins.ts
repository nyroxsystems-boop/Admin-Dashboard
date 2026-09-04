/**
 * Admin User API (read + self-service email).
 *
 * The bot-service exposes ONLY these admin-user endpoints:
 *   GET /api/admin-auth/list-admins   → { admins: [{ id, username, email, full_name, created_at }] }
 *   PUT /api/admin-auth/update-email  → self-only (server rejects editing another admin)
 *
 * There is NO create / delete / role-change endpoint. New admins are
 * provisioned directly in the admin_users table on the server, so this
 * module deliberately exposes no such mutations (they would be phantom).
 */

import { apiFetch } from './client';
import { AdminListResponseSchema, parseApiResponse, type AdminListResponse } from './types';

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
