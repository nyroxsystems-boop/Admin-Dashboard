/**
 * Admin Auth API — login, logout, session, password management.
 */

import { apiFetch, setAccessToken, clearAuth } from './client';
import {
    AdminSchema,
    LoginResponseSchema,
    PasswordResetResponseSchema,
    parseApiResponse,
    type Admin,
    type LoginResponse,
    type PasswordResetResponse,
} from './types';

export async function adminLogin(username: string, password: string): Promise<LoginResponse> {
    const raw = await apiFetch<unknown>('/api/admin-auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
    const parsed = parseApiResponse(LoginResponseSchema, raw);
    if (parsed.access) {
        setAccessToken(parsed.access);
    }
    return parsed;
}

export async function adminLogout(): Promise<void> {
    try {
        await apiFetch<unknown>('/api/admin-auth/logout', { method: 'POST' });
    } finally {
        clearAuth();
    }
}

export async function getAdminMe(): Promise<Admin> {
    const raw = await apiFetch<unknown>('/api/admin-auth/me');
    return parseApiResponse(AdminSchema, raw);
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
        body: JSON.stringify({ username }),
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
