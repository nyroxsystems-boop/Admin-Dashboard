/// <reference types="vite/client" />
/**
 * Admin Dashboard — API Client
 *
 * Zentraler Fetch-Wrapper für alle Admin-Backend-Calls.
 *
 * Garantien:
 *  - Base-URL kommt AUSSCHLIESSLICH aus VITE_API_BASE_URL.
 *    Fehlt sie → throw beim Modul-Load (fail loudly, kein Production-Fallback).
 *  - Bearer-Token aus In-Memory-Store (XSS-safe; gesetzt durch AuthContext).
 *  - JSON-Parsing inkl. 204 No Content Handling.
 *  - Auto-Retry mit Exponential Backoff bei 5xx (3 Versuche, 100/200/400 ms)
 *    NUR für idempotente Methoden (GET/HEAD).
 *  - Request-Deduplication via in-flight-Cache (gleiches GET → ein Fetch).
 *  - 401 → globales `auth:expired`-Event → AuthContext logged aus.
 *  - 30 s Request-Timeout via AbortController.
 *
 * Wer Fehler typsicher prüfen will: `err instanceof ApiError`.
 */

import { errorTracker } from '../services/errorTracker';

// ──────────────────────────────────────────────────────────────────────────
//  ENV
// ──────────────────────────────────────────────────────────────────────────

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!RAW_API_BASE_URL || typeof RAW_API_BASE_URL !== 'string') {
    throw new Error(
        '[api/client] VITE_API_BASE_URL is not set. Refusing to start with a hardcoded production fallback. Set VITE_API_BASE_URL in your .env file.'
    );
}

export const API_BASE_URL: string = RAW_API_BASE_URL.replace(/\/+$/, '');

// ──────────────────────────────────────────────────────────────────────────
//  Auth Token Store (In-Memory, XSS-safe)
// ──────────────────────────────────────────────────────────────────────────

let _accessToken: string | null = null;

export function getAuthToken(): string | null {
    return _accessToken;
}

export function setAccessToken(token: string | null): void {
    _accessToken = token;
}

/** Legacy alias used by older Admin-Code (wws.ts re-export). */
export function setAuthToken(token: string | null): void {
    _accessToken = token;
}

export function clearAuth(): void {
    _accessToken = null;
    try {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        localStorage.removeItem('pu.admin.session');
    } catch {
        /* localStorage unavailable */
    }
}

// ──────────────────────────────────────────────────────────────────────────
//  ApiError
// ──────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
    public readonly status: number;
    public readonly endpoint?: string;
    public readonly body?: unknown;

    constructor(message: string, status: number, endpoint?: string, body?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.endpoint = endpoint;
        this.body = body;
    }
}

export function isApiError(err: unknown): err is ApiError {
    return err instanceof ApiError;
}

export function parseError(err: unknown): { message: string; status?: number } {
    if (err instanceof ApiError) return { message: err.message, status: err.status };
    if (err instanceof Error) return { message: err.message };
    if (typeof err === 'string') return { message: err };
    return { message: 'Unknown error' };
}

// ──────────────────────────────────────────────────────────────────────────
//  Internals
// ──────────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [100, 200, 400];
const REQUEST_TIMEOUT_MS = 30_000;

/** In-flight cache for GET-Deduplication. Key = METHOD + URL + body-hash. */
const inFlightCache = new Map<string, Promise<unknown>>();

let _authExpiredFired = false;

function readCsrfToken(): string {
    if (typeof document === 'undefined') return '';
    return (
        document.cookie
            .split('; ')
            .find((c) => c.startsWith('csrf_token='))
            ?.split('=')[1] ?? ''
    );
}

function buildHeaders(extra?: HeadersInit): Record<string, string> {
    const token = getAuthToken();
    const csrf = readCsrfToken();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    if (csrf) headers['X-CSRF-Token'] = csrf;
    // Admin-session tokens (random hex from /api/admin-auth/login) MUST use
    // the "Token" auth prefix. The backend's authMiddleware only matches
    // admin_sessions under `Token <token>`; `Bearer <token>` is reserved for
    // JWT / service tokens and would 403. JWTs (3-segment dot-separated)
    // still go via Bearer.
    if (token) {
        const looksLikeJwt = token.split('.').length === 3;
        headers.Authorization = looksLikeJwt ? `Bearer ${token}` : `Token ${token}`;
    }

    if (extra) {
        const incoming = extra as Record<string, string>;
        for (const k of Object.keys(incoming)) {
            headers[k] = incoming[k];
        }
    }
    return headers;
}

function buildDedupKey(endpoint: string, options: RequestInit): string {
    const method = (options.method ?? 'GET').toUpperCase();
    const body = typeof options.body === 'string' ? options.body : '';
    return `${method} ${endpoint}::${body}`;
}

async function sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function fireAuthExpired(endpoint: string): void {
    if (_authExpiredFired) return;
    _authExpiredFired = true;
    clearAuth();
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:expired', { detail: { endpoint } }));
    }
    // Latch stays set until a successful login resets it. Without the latch,
    // 8 parallel 401 fetches would each fire `auth:expired`, each navigate
    // replaces history → Chrome's 100-replaceState/10s SecurityError.
}

/** Call after a successful login to re-arm fireAuthExpired. */
export function resetAuthExpired(): void {
    _authExpiredFired = false;
}

// ──────────────────────────────────────────────────────────────────────────
//  Public API: apiFetch<T>
// ──────────────────────────────────────────────────────────────────────────

export interface ApiFetchOptions extends RequestInit {
    /** Disable in-flight deduplication for this call. */
    dedupe?: boolean;
    /** Override retry count. */
    maxRetries?: number;
    /** If true, do not throw on 401 — let caller handle it. */
    silentAuth?: boolean;
}

async function executeRequest<T>(endpoint: string, options: ApiFetchOptions): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const method = (options.method ?? 'GET').toUpperCase();
    const isIdempotent = method === 'GET' || method === 'HEAD';
    const maxRetries = options.maxRetries ?? MAX_RETRIES;

    const headers = buildHeaders(options.headers);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        let response: Response;
        try {
            response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include',
                signal: controller.signal,
            });
        } catch (err: unknown) {
            clearTimeout(timeoutId);
            if (err instanceof DOMException && err.name === 'AbortError') {
                lastError = new ApiError(`Request timeout after ${REQUEST_TIMEOUT_MS / 1000}s: ${endpoint}`, 408, endpoint);
                if (isIdempotent && attempt < maxRetries - 1) {
                    await sleep(RETRY_DELAYS_MS[attempt] ?? 400);
                    continue;
                }
                throw lastError;
            }
            // Network error
            lastError = new ApiError(`Network error: ${endpoint}`, 0, endpoint);
            if (isIdempotent && attempt < maxRetries - 1) {
                await sleep(RETRY_DELAYS_MS[attempt] ?? 400);
                continue;
            }
            throw lastError;
        } finally {
            clearTimeout(timeoutId);
        }

        // 429 — Rate limited
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : RETRY_DELAYS_MS[attempt] ?? 400;
            lastError = new ApiError(`Rate limited on ${endpoint}`, 429, endpoint);
            if (attempt < maxRetries - 1) {
                await sleep(waitMs);
                continue;
            }
            throw lastError;
        }

        // 5xx — Server error: retry on idempotent only
        if (response.status >= 500 && response.status < 600) {
            lastError = new ApiError(`Server error ${response.status} on ${endpoint}`, response.status, endpoint);
            if (isIdempotent && attempt < maxRetries - 1) {
                await sleep(RETRY_DELAYS_MS[attempt] ?? 400);
                continue;
            }
            throw lastError;
        }

        // 401 — Session expired
        if (response.status === 401) {
            if (!options.silentAuth) {
                fireAuthExpired(endpoint);
            }
            throw new ApiError('Sitzung abgelaufen – bitte erneut anmelden', 401, endpoint);
        }

        // 4xx (other) — never retry
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const msg =
                body?.detail ||
                body?.message ||
                body?.error ||
                response.statusText ||
                `Request failed with status ${response.status}`;
            const apiErr = new ApiError(msg, response.status, endpoint, body);
            // Track non-auth client/server errors
            if (response.status >= 500) {
                errorTracker.captureException(apiErr, { endpoint, method, status: response.status });
            }
            throw apiErr;
        }

        if (response.status === 204) {
            return {} as T;
        }

        const ct = response.headers.get('content-type') ?? '';
        if (ct.includes('application/json')) {
            return (await response.json()) as T;
        }
        // Fallback for non-JSON responses
        return (await response.text()) as unknown as T;
    }

    throw lastError ?? new ApiError(`Failed after ${maxRetries} retries: ${endpoint}`, 500, endpoint);
}

export async function apiFetch<T>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase();
    const dedupe = options.dedupe ?? method === 'GET';

    if (!dedupe) {
        return executeRequest<T>(endpoint, options);
    }

    const key = buildDedupKey(endpoint, options);
    const cached = inFlightCache.get(key) as Promise<T> | undefined;
    if (cached) return cached;

    const promise = executeRequest<T>(endpoint, options).finally(() => {
        inFlightCache.delete(key);
    });
    inFlightCache.set(key, promise);
    return promise;
}

// ──────────────────────────────────────────────────────────────────────────
//  apiFetchBlob — for binary downloads (CSV, PDF, etc.)
// ──────────────────────────────────────────────────────────────────────────

export async function apiFetchBlob(endpoint: string, options: RequestInit = {}): Promise<Blob> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = buildHeaders(options.headers);
    delete (headers as Record<string, string>)['Content-Type'];

    const res = await fetch(url, { ...options, headers, credentials: 'include' });

    if (res.status === 401) {
        fireAuthExpired(endpoint);
        throw new ApiError('Sitzung abgelaufen – bitte erneut anmelden', 401, endpoint);
    }
    if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
            const ct = res.headers.get('content-type') ?? '';
            if (ct.includes('application/json')) {
                const body = await res.json();
                detail = body?.message ?? body?.error ?? detail;
            }
        } catch {
            /* ignore */
        }
        throw new ApiError(detail, res.status, endpoint);
    }
    const blob = await res.blob();
    if (blob.size === 0) {
        throw new ApiError('Server returned empty response', 200, endpoint);
    }
    return blob;
}
