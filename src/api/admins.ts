/**
 * Admin User CRUD.
 *
 * The bot-service exposes ONLY: GET /list-admins, PUT /update-email,
 * POST /change-password, POST /reset-password.
 * Create / Delete / Role-change endpoints don't exist server-side, so the
 * corresponding mutations throw a helpful error and the UI degrades.
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

export async function createAdmin(_data: {
    username: string;
    email: string;
    password: string;
    role?: 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'READ_ONLY';
}): Promise<{ success: boolean; admin?: Admin }> {
    throw new Error(
        'Admin-Anlegen wird vom Backend noch nicht unterstützt. Bitte direkt in der admin_users-Tabelle anlegen.'
    );
}

export async function deleteAdmin(_adminId: number | string): Promise<{ success: boolean }> {
    throw new Error(
        'Admin-Löschen wird vom Backend noch nicht unterstützt.'
    );
}

export async function setAdminRole(
    _adminId: number | string,
    _role: 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'READ_ONLY'
): Promise<{ success: boolean }> {
    throw new Error(
        'Rollen-Änderung wird vom Backend noch nicht unterstützt.'
    );
}
