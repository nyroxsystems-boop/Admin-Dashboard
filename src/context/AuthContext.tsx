/**
 * Admin Auth Context — single source of truth for admin authentication.
 *
 * Token storage:
 *   - access token: localStorage (inside the session blob, so it survives
 *     a hard reload — the bot-service backend has NO refresh endpoint, so
 *     in-memory-only would force re-login on every refresh)
 *   - session blob: localStorage key `pu.admin.session`
 *     { user, accessToken, expiresAt, tenantId? }
 *
 * Lifecycle:
 *   - Sessions live 24h server-side. We do NOT call /refresh (the bot-service
 *     does not implement it). Instead, hard logout 60s before expiry.
 *   - Cross-tab logout sync via BroadcastChannel
 *   - Listens for `auth:expired` event from `api/client.ts` (one-shot, latched)
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
    getAdminMe as apiGetMe,
} from '../api/auth';
import { setAccessToken, clearAuth, resetAuthExpired } from '../api/client';
import type { Admin, AdminRole } from '../api/types';
import { errorTracker } from '../services/errorTracker';

// ──────────────────────────────────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────────────────────────────────

interface Session {
    user: Admin;
    accessToken: string;
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
const DEFAULT_EXPIRY_SEC = 24 * 60 * 60; // bot-service issues 24h sessions

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
        if (typeof parsed.accessToken !== 'string' || !parsed.accessToken) return null;
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
    const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleForcedLogoutRef = useRef<() => void>(() => {});

    // ── Forced Logout ────────────────────────────────────────────────────

    const handleForcedLogout = useCallback(() => {
        if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
        clearAllAuth();
        setUser(null);
        setTenantId(null);
        errorTracker.setUser(null);
    }, []);

    // ── Hard-expiry scheduler (no /refresh — bot-service has none) ───────

    const scheduleHardLogout = useCallback((expiresAt: number) => {
        if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
        // Log the user out 60s before the server-side session would die
        // so they don't see mysterious 401s in the middle of an action.
        const delay = Math.max(0, expiresAt - Date.now() - 60_000);
        expiryTimerRef.current = setTimeout(() => {
            handleForcedLogoutRef.current();
        }, delay);
    }, []);

    // Keep the forced-logout ref in sync — done in an effect so we don't
    // write to refs during render.
    useEffect(() => {
        handleForcedLogoutRef.current = handleForcedLogout;
    }, [handleForcedLogout]);

    // ── Public Methods ───────────────────────────────────────────────────

    const login = useCallback(
        async (username: string, password: string): Promise<void> => {
            const res = await apiAdminLogin(username, password);
            const expiresIn = res.expiresIn ?? res.expires_in ?? DEFAULT_EXPIRY_SEC;
            const expiresAt = Date.now() + expiresIn * 1000;

            setAccessToken(res.access);
            // Persist the token in the session blob so it survives a hard
            // reload — the bot-service backend has no /refresh endpoint.
            const session: Session = {
                user: res.user,
                accessToken: res.access,
                expiresAt,
                tenantId: null,
            };
            saveSession(session);

            setUser(res.user);
            setTenantId(null);
            scheduleHardLogout(expiresAt);
            // Re-arm the auth-expired latch so a new 401 in this session
            // can fire the navigate-to-/login flow exactly once.
            resetAuthExpired();

            errorTracker.setUser({
                id: String(res.user.id),
                email: res.user.email,
                role: typeof res.user.role === 'string' ? res.user.role : undefined,
            });
        },
        [scheduleHardLogout]
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
        // No /refresh endpoint — just re-fetch profile so role/permission
        // changes propagate. If /me 401s, the auth:expired event handles
        // logout via the latch.
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
    }, []);

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

            // Hard expiry — kick (no /refresh endpoint to fall back on)
            if (Date.now() >= session.expiresAt) {
                handleForcedLogout();
                setIsLoading(false);
                return;
            }

            // Restore tenantId
            const persistedTenant = localStorage.getItem(TENANT_KEY);
            if (persistedTenant) setTenantId(Number(persistedTenant));
            else if (typeof session.tenantId === 'number') setTenantId(session.tenantId);

            // Restore in-memory token from the session blob, confirm with
            // backend that the session is still valid (defends against
            // revoked sessions / role changes mid-session).
            setAccessToken(session.accessToken);
            setUser(session.user);
            scheduleHardLogout(session.expiresAt);
            resetAuthExpired();

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
            if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
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
