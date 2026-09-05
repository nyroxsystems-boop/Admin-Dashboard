/**
 * Admin Auth API — login, logout, session, password management.
 */

import { apiFetch, setAccessToken } from './client';
import {
    AdminSchema,
    LoginResponseSchema,
    PasswordResetResponseSchema,
    parseApiResponse,
    parseApiResponseStrict,
    type Admin,
    type LoginResponse,
    type PasswordResetResponse,
} from './types';

export async function adminLogin(username: string, password: string, totpCode?: string): Promise<LoginResponse> {
    const raw = await apiFetch<unknown>('/api/admin-auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, app: 'admin', ...(totpCode ? { totp_code: totpCode } : {}) }),
        silentAuth: true,
    });
    const parsed = parseApiResponseStrict(LoginResponseSchema, raw);
    if (parsed.access) {
        setAccessToken(parsed.access);
    }
    return parsed;
}

export async function adminLogout(authorization?: string | null): Promise<void> {
    await apiFetch<unknown>('/api/admin-auth/logout', {
        method: 'POST',
        ...(authorization ? { headers: { Authorization: authorization } } : {}),
    });
}

export async function getAdminMe(): Promise<Admin> {
    const raw = await apiFetch<unknown>('/api/admin-auth/me?app=admin');
    return parseApiResponseStrict(AdminSchema, raw);
}

/**
 * @deprecated The bot-service backend does NOT implement /admin-auth/refresh.
 * Admin sessions live 24h; on expiry the user must re-login. This export
 * exists only for backwards compatibility — calling it throws.
 */
export async function refreshAccessToken(): Promise<{ access: string; expiresIn?: number }> {
    throw new Error('Admin sessions cannot be refreshed; please re-login.');
}

export async function requestPasswordReset(username: string): Promise<PasswordResetResponse> {
    const raw = await apiFetch<unknown>('/api/admin-auth/request-reset', {
        method: 'POST',
        body: JSON.stringify({ username, app: 'admin' }),
    });
    return parseApiResponse(PasswordResetResponseSchema, raw);
}

export async function resetPassword(token: string, newPassword: string): Promise<PasswordResetResponse> {
    const raw = await apiFetch<unknown>('/api/admin-auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
    });
    return parseApiResponse(PasswordResetResponseSchema, raw);
}

export async function changePassword(
    currentPassword: string,
    newPassword: string
): Promise<PasswordResetResponse> {
    const raw = await apiFetch<unknown>('/api/admin-auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
    });
    return parseApiResponse(PasswordResetResponseSchema, raw);
}

export async function updateSignature(signature: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>('/api/admin-auth/update-signature', {
        method: 'PATCH',
        body: JSON.stringify({ signature }),
    });
}

export interface AdminProfile {
    id: string;
    username: string;
    email: string;
    full_name: string | null;
    signature: string | null;
    has_imap_setup?: boolean;
    created_at?: string;
    last_login?: string | null;
}

/**
 * Vollständiges Admin-Profil inkl. Signatur (das schlanke /me liefert keine
 * Signatur, /profile schon).
 */
export async function getAdminProfile(): Promise<AdminProfile> {
    return apiFetch<AdminProfile>('/api/admin-auth/profile');
}
