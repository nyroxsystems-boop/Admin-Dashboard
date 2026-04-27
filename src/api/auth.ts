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

export async function refreshAccessToken(): Promise<{ access: string; expiresIn?: number }> {
    const raw = await apiFetch<{ access: string; accessToken?: string; expiresIn?: number; expires_in?: number }>(
        '/api/admin-auth/refresh',
        { method: 'POST', body: JSON.stringify({}) }
    );
    const access = raw.access ?? raw.accessToken;
    if (!access) throw new Error('Refresh response missing access token');
    setAccessToken(access);
    return { access, expiresIn: raw.expiresIn ?? raw.expires_in };
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
