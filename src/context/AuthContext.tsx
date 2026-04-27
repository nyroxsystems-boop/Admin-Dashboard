/**
 * Admin Auth Context — single source of truth for admin authentication.
 *
 * Token storage:
 *   - access token: in-memory only (XSS-safe)
 *   - session blob: localStorage key `pu.admin.session`
 *     { user, expiresAt, tenantId? }
 *   - refresh token: httpOnly cookie set by the backend
 *
 * Lifecycle:
 *   - Pre-Expiry Auto-Refresh (5 min before `expiresAt`)
 *   - Auto-Logout on refresh failure when expiresAt is in the past
 *   - Cross-tab logout sync via BroadcastChannel
 *   - Listens for `auth:expired` event from `api/client.ts`
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';

import {
    adminLogin as apiAdminLogin,
    adminLogout as apiAdminLogout,
    refreshAccessToken as apiRefresh,
    getAdminMe as apiGetMe,
} from '../api/auth';
import { setAccessToken, clearAuth, getAuthToken } from '../api/client';
import type { Admin, AdminRole } from '../api/types';
import { errorTracker } from '../services/errorTracker';

// ──────────────────────────────────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────────────────────────────────

interface Session {
    user: Admin;
    expiresAt: number; // epoch ms
    tenantId?: number | null;
}

interface AuthState {
    user: Admin | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    /** Tenant the admin is impersonating (null = global view). */
    tenantId: number | null;
}

interface AuthContextValue extends AuthState {
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
    setImpersonatedTenant: (tenantId: number | null) => void;
}

// ──────────────────────────────────────────────────────────────────────────
//  Constants
// ──────────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'pu.admin.session';
const TENANT_KEY = 'pu.admin.tenantId';
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry
const DEFAULT_EXPIRY_SEC = 60 * 60 * 8; // 8h default if backend omits expiresIn

const AuthContext = createContext<AuthContextValue | null>(null);

// ──────────────────────────────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────────────────────────────

function loadSession(): Session | null {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Session;
        if (!parsed?.user || typeof parsed.expiresAt !== 'number') return null;
        return parsed;
    } catch {
        return null;
    }
}

function saveSession(session: Session): void {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
        /* localStorage unavailable */
    }
}

function clearAllAuth(): void {
    try {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(TENANT_KEY);
        sessionStorage.clear();
    } catch {
        /* ignore */
    }
    clearAuth();
    try {
        new BroadcastChannel('pu.admin.auth').postMessage({ type: 'logout' });
    } catch {
        /* unsupported */
    }
}

// ──────────────────────────────────────────────────────────────────────────
//  Provider
// ──────────────────────────────────────────────────────────────────────────

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
    const [user, setUser] = useState<Admin | null>(null);
    const [tenantId, setTenantId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const navigate = useNavigate();
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const refreshInFlightRef = useRef(false);

    // Forward refs let callbacks reference each other without circular
    // declaration order. Each callback reads the current implementation
    // through the ref at call-time.
    const performRefreshRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
    const handleForcedLogoutRef = useRef<() => void>(() => {});

    // ── Forced Logout ────────────────────────────────────────────────────

    const handleForcedLogout = useCallback(() => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        clearAllAuth();
        setUser(null);
        setTenantId(null);
        errorTracker.setUser(null);
    }, []);

    // ── Refresh scheduler ────────────────────────────────────────────────

    const scheduleRefresh = useCallback((expiresAt: number) => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        const delay = Math.max(0, expiresAt - Date.now() - REFRESH_BUFFER_MS);
        refreshTimerRef.current = setTimeout(() => {
            void performRefreshRef.current();
        }, delay);
    }, []);

    const performRefresh = useCallback(async (): Promise<boolean> => {
        if (refreshInFlightRef.current) return false;
        refreshInFlightRef.current = true;
        try {
            const { expiresIn } = await apiRefresh();
            const newExpiresAt = Date.now() + (expiresIn ?? DEFAULT_EXPIRY_SEC) * 1000;
            const current = loadSession();
            if (current) {
                const next: Session = { ...current, expiresAt: newExpiresAt };
                saveSession(next);
                scheduleRefresh(newExpiresAt);
            }
            return true;
        } catch (err) {
            errorTracker.captureMessage('Admin token refresh failed', 'warning', {
                error: err instanceof Error ? err.message : String(err),
            });
            // Only force logout if we are actually past expiry — refresh
            // hiccups while the access token is still valid should not kick
            // the user out of the chair.
            const current = loadSession();
            if (!current || Date.now() >= current.expiresAt) {
                handleForcedLogoutRef.current();
            } else {
                if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = setTimeout(
                    () => void performRefreshRef.current(),
                    60_000
                );
            }
            return false;
        } finally {
            refreshInFlightRef.current = false;
        }
    }, [scheduleRefresh]);

    // Keep the forward refs in sync — done in an effect so we don't write
    // to refs during render.
    useEffect(() => {
        performRefreshRef.current = performRefresh;
        handleForcedLogoutRef.current = handleForcedLogout;
    }, [performRefresh, handleForcedLogout]);

    // ── Public Methods ───────────────────────────────────────────────────

    const login = useCallback(
        async (username: string, password: string): Promise<void> => {
            const res = await apiAdminLogin(username, password);
            const expiresIn = res.expiresIn ?? res.expires_in ?? DEFAULT_EXPIRY_SEC;
            const expiresAt = Date.now() + expiresIn * 1000;

            setAccessToken(res.access);
            const session: Session = { user: res.user, expiresAt, tenantId: null };
            saveSession(session);

            setUser(res.user);
            setTenantId(null);
            scheduleRefresh(expiresAt);

            errorTracker.setUser({
                id: String(res.user.id),
                email: res.user.email,
                role: typeof res.user.role === 'string' ? res.user.role : undefined,
            });
        },
        [scheduleRefresh]
    );

    const logout = useCallback(async (): Promise<void> => {
        try {
            await apiAdminLogout();
        } catch (err) {
            errorTracker.captureMessage('Admin logout API failed (non-fatal)', 'warning', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
        handleForcedLogout();
        navigate('/login', { replace: true });
    }, [handleForcedLogout, navigate]);

    const refresh = useCallback(async (): Promise<void> => {
        await performRefresh();
        // Re-fetch profile so role/permission changes propagate
        try {
            const me = await apiGetMe();
            setUser(me);
            const current = loadSession();
            if (current) saveSession({ ...current, user: me });
        } catch (err) {
            errorTracker.captureMessage('Admin /me refresh failed', 'warning', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }, [performRefresh]);

    const setImpersonatedTenant = useCallback((id: number | null) => {
        setTenantId(id);
        try {
            if (id == null) {
                localStorage.removeItem(TENANT_KEY);
            } else {
                localStorage.setItem(TENANT_KEY, String(id));
            }
        } catch {
            /* ignore */
        }
        const current = loadSession();
        if (current) saveSession({ ...current, tenantId: id });
    }, []);

    // ── Boot ────────────────────────────────────────────────────────────

    useEffect(() => {
        const init = async () => {
            const session = loadSession();
            if (!session) {
                setIsLoading(false);
                return;
            }

            // Restore tenantId
            const persistedTenant = localStorage.getItem(TENANT_KEY);
            if (persistedTenant) setTenantId(Number(persistedTenant));
            else if (typeof session.tenantId === 'number') setTenantId(session.tenantId);

            // Hard expiry — refresh or kick
            if (Date.now() >= session.expiresAt) {
                const ok = await performRefresh();
                if (!ok) {
                    setIsLoading(false);
                    return;
                }
            }

            setUser(session.user);
            scheduleRefresh(session.expiresAt);

            // Token is in-memory only — refresh once on boot to recover it
            // via the httpOnly refresh cookie (cookie + setAccessToken happen
            // inside performRefresh).
            if (!getAuthToken()) {
                await performRefresh();
            }

            // Confirm with backend that the session is still valid (defends
            // against revoked sessions / role changes mid-session).
            try {
                const me = await apiGetMe();
                setUser(me);
                saveSession({ ...session, user: me });
                errorTracker.setUser({
                    id: String(me.id),
                    email: me.email,
                    role: typeof me.role === 'string' ? me.role : undefined,
                });
            } catch {
                handleForcedLogout();
            }

            setIsLoading(false);
        };
        void init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Global auth:expired listener ─────────────────────────────────────

    useEffect(() => {
        const onExpired = () => {
            handleForcedLogout();
            navigate('/login', { replace: true });
        };
        window.addEventListener('auth:expired', onExpired);
        return () => window.removeEventListener('auth:expired', onExpired);
    }, [handleForcedLogout, navigate]);

    // ── Cross-tab logout sync ────────────────────────────────────────────

    useEffect(() => {
        let bc: BroadcastChannel | null = null;
        try {
            bc = new BroadcastChannel('pu.admin.auth');
            bc.onmessage = (ev) => {
                if (ev.data?.type === 'logout') {
                    handleForcedLogout();
                    navigate('/login', { replace: true });
                }
            };
        } catch {
            /* unsupported */
        }
        const onStorage = (e: StorageEvent) => {
            if (e.key === SESSION_KEY && !e.newValue) {
                handleForcedLogout();
                navigate('/login', { replace: true });
            }
        };
        window.addEventListener('storage', onStorage);
        return () => {
            bc?.close();
            window.removeEventListener('storage', onStorage);
        };
    }, [handleForcedLogout, navigate]);

    // ── Cleanup ──────────────────────────────────────────────────────────

    useEffect(() => {
        return () => {
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        };
    }, []);

    const value: AuthContextValue = {
        user,
        isLoading,
        isAuthenticated: !!user,
        tenantId,
        login,
        logout,
        refresh,
        setImpersonatedTenant,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ──────────────────────────────────────────────────────────────────────────
//  Hooks
// ──────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components -- co-located
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
}

// Re-export the role enum for downstream consumers
export type { AdminRole };
