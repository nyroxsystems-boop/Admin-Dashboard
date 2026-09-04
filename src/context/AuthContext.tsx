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
import { useQueryClient } from '@tanstack/react-query';

import {
    adminLogin as apiAdminLogin,
    adminLogout as apiAdminLogout,
    getAdminMe as apiGetMe,
} from '../api/auth';
import {
    setAccessToken,
    clearAuth,
    resetAuthExpired,
    isApiError,
    getAuthorizationValue,
} from '../api/client';
import type { Admin, AdminRole } from '../api/types';
import { errorTracker } from '../services/errorTracker';
import { encryptToken, decryptToken, clearStorageKey } from '../services/secureStorage';

// ──────────────────────────────────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────────────────────────────────

interface Session {
    user: Admin;
    /**
     * Verschlüsseltes Sitzungstoken — FEHLT bei Cookie-Sitzungen.
     *
     * Seit das Backend das Token nur noch als httpOnly-Cookie ausliefert,
     * gibt es hier meistens nichts zu speichern. Das ist kein Mangel, sondern
     * der sicherere Fall: was nicht im localStorage liegt, kann ein
     * eingeschleustes Skript auch nicht auslesen.
     */
    accessToken?: string;
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
    /** Nach erfolgreichem Pflicht-Passwortwechsel: Flag im User + Session-Blob
     *  auf false setzen, damit der /change-password-Guard nicht erneut greift. */
    markPasswordChanged: () => void;
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
        /* Kein Token ist ein GÜLTIGER Zustand: bei einer Cookie-Sitzung liegt
           das Token ausschliesslich im httpOnly-Cookie. Hier stand vorher eine
           Pflichtprüfung — sie hätte jede Cookie-Sitzung beim Neuladen
           verworfen und den Nutzer stillschweigend ausgeloggt. */
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

/**
 * /admin-auth/me liefert `must_change_password` nicht garantiert mit (Feld ist
 * im Schema optional). Damit der Pflicht-Wechsel-Guard einen frisch geseedeten
 * Admin nicht durch ein /me-Refresh "verliert", wird das Flag aus dem
 * vorherigen User-Objekt konserviert, wenn der Server es weglässt.
 */
function mergeMustChangePassword(next: Admin, prev: Admin | null | undefined): Admin {
    if (next.must_change_password === undefined && prev?.must_change_password !== undefined) {
        return { ...next, must_change_password: prev.must_change_password };
    }
    return next;
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
    clearStorageKey();
}

/**
 * Notify OTHER tabs to log out. Deliberately SEPARATE from clearAllAuth():
 * the cross-tab BroadcastChannel listener calls handleForcedLogout() →
 * clearAllAuth(). If clearAllAuth() itself broadcast, a *received* 'logout'
 * would re-broadcast, and the navigate('/login') in the listener would loop
 * until the browser kills it with "history.replaceState() more than 100 times
 * per 10 seconds" (exactly the bug this fixes). Only the INITIATING tab
 * broadcasts; receivers clean up locally and stay silent.
 */
function broadcastLogout(): void {
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
    const queryClient = useQueryClient();
    const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleForcedLogoutRef = useRef<() => void>(() => {});

    // ── Forced Logout ────────────────────────────────────────────────────

    const handleForcedLogout = useCallback(() => {
        if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
        clearAllAuth();
        // React Query survives route changes. Clear all server state before a
        // different admin can log in, otherwise cached cross-tenant data from
        // the previous session can flash in the next session.
        queryClient.clear();
        setUser(null);
        setTenantId(null);
        errorTracker.setUser(null);
    }, [queryClient]);

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

            queryClient.clear();

            /**
             * Zwei Betriebsarten, je nachdem was das Backend liefert.
             *
             * COOKIE (Produktion): die Antwort enthält kein `access`. Das
             * Sitzungstoken steckt im httpOnly-Cookie `admin_session`, das der
             * Browser bei jeder Anfrage mitschickt — `apiFetch` sendet dafür
             * `credentials: 'include'`. Es gibt hier nichts zu speichern, und
             * das ist der sicherere Fall: was nicht im localStorage liegt,
             * kann ein eingeschleustes Skript nicht auslesen.
             *
             * BEARER (Entwicklung, oder mit ADMIN_ALLOW_LEGACY_TOKEN_RESPONSE):
             * das Token kommt im Körper und wird wie bisher verschlüsselt
             * abgelegt, damit es ein hartes Neuladen überlebt — einen
             * /refresh-Endpunkt gibt es nicht.
             */
            setAccessToken(res.access ?? null);
            const encryptedToken = res.access ? await encryptToken(res.access) : undefined;
            const session: Session = {
                user: res.user,
                ...(encryptedToken ? { accessToken: encryptedToken } : {}),
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
        [queryClient, scheduleHardLogout]
    );

    const logout = useCallback(async (): Promise<void> => {
        // Capture the authenticated header before local cleanup. Previously the
        // token was cleared first, so /logout was always sent anonymously and
        // the server-side admin session remained valid.
        const authorization = getAuthorizationValue();
        handleForcedLogout();
        broadcastLogout(); // tell other tabs (initiating tab only — see broadcastLogout)
        navigate('/login', { replace: true });
        // Fire-and-forget the API call (best-effort server-side cleanup)
        void apiAdminLogout(authorization).catch((err) => {
            errorTracker.captureMessage('Admin logout API failed (non-fatal)', 'warning', {
                error: err instanceof Error ? err.message : String(err),
            });
        });
    }, [handleForcedLogout, navigate]);

    const refresh = useCallback(async (): Promise<void> => {
        // No /refresh endpoint — just re-fetch profile so role/permission
        // changes propagate. If /me 401s, the auth:expired event handles
        // logout via the latch.
        try {
            const raw = await apiGetMe();
            const current = loadSession();
            const me = mergeMustChangePassword(raw, current?.user);
            setUser(me);
            if (current) saveSession({ ...current, user: me });
        } catch (err) {
            errorTracker.captureMessage('Admin /me refresh failed', 'warning', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }, []);

    const markPasswordChanged = useCallback(() => {
        setUser((prev) => (prev ? { ...prev, must_change_password: false } : prev));
        const current = loadSession();
        if (current) {
            saveSession({
                ...current,
                user: { ...current.user, must_change_password: false },
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
            // ?reset=1 (or ?logout=1) lets a stuck user wipe local state without
            // going into devtools. Useful when an old session blob from a
            // previous deploy can't be parsed by the new schema.
            try {
                const qs = new URLSearchParams(window.location.search);
                if (qs.get('reset') === '1' || qs.get('logout') === '1') {
                    clearAllAuth();
                    qs.delete('reset');
                    qs.delete('logout');
                    const clean = window.location.pathname + (qs.toString() ? `?${qs}` : '');
                    window.history.replaceState({}, '', clean);
                    setIsLoading(false);
                    return;
                }
            } catch {
                /* ignore */
            }

            // Boot is wrapped in a top-level try so any unexpected throw —
            // corrupt localStorage, BroadcastChannel unavailable, schema drift —
            // degrades to "logged out", never to a white screen.
            try {
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

                /**
                 * Token wiederherstellen — falls überhaupt eines da ist.
                 *
                 * Bei einer Cookie-Sitzung ist `accessToken` nicht gesetzt;
                 * die Anmeldung trägt dann allein über das httpOnly-Cookie.
                 * Hier stand vorher eine unbedingte Entschlüsselung mit
                 * Zwangsabmeldung im Fehlerfall — die hätte jede
                 * Cookie-Sitzung beim Neuladen der Seite verworfen.
                 *
                 * Ist ein Token da, gilt die alte Regel unverändert: lässt es
                 * sich nicht entschlüsseln (Schlüssel weg, alter Klartext,
                 * Manipulation), wird sauber abgemeldet statt geraten.
                 */
                if (session.accessToken) {
                    const plaintext = await decryptToken(session.accessToken);
                    if (!plaintext) {
                        handleForcedLogout();
                        setIsLoading(false);
                        return;
                    }
                    setAccessToken(plaintext);
                } else {
                    setAccessToken(null);
                }
                setUser(session.user);
                scheduleHardLogout(session.expiresAt);
                resetAuthExpired();

                /**
                 * ─── Die Oberflaeche wartet NICHT auf /me ─────────────────
                 *
                 * Hier stand ein `await apiGetMe()` VOR dem Ende des Boots.
                 * Der Nutzer war zu dem Zeitpunkt laengst aus der lokalen
                 * Sitzung wiederhergestellt — trotzdem stand die ganze
                 * Anwendung hinter dem bildschirmfuellenden "Authenticating",
                 * bis die Antwort da war. In der Netzwerkansicht des Nutzers:
                 * 939 ms, weil die allererste Anfrage den Verbindungsaufbau
                 * bezahlt.
                 *
                 * Und dieser Weg laeuft nicht nur beim Anmelden: NACH JEDEM
                 * DEPLOY laedt die Seite einmal hart neu (ChunkErrorBoundary,
                 * alte Code-Stuecke sind weg). Jede Auslieferung bescherte dem
                 * offenen Tab also eine Sekunde Vollbild-Spinner — das ist ein
                 * grosser Teil der "der Knopf ist immer noch langsam"-Runden.
                 *
                 * Jetzt prueft /me im HINTERGRUND. Faellt die Pruefung durch,
                 * wird genauso abgemeldet wie vorher — nur eben ohne dass die
                 * gueltige Mehrheit der Sitzungen darauf wartet. Ein
                 * unguelitges Token scheitert ohnehin an der ersten echten
                 * Abfrage; hier laeuft nichts ungeprueft weiter.
                 */
                void (async () => {
                    try {
                        const me = mergeMustChangePassword(await apiGetMe(), session.user);
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
                })();
            } catch (bootErr) {
                errorTracker.captureException(bootErr, { phase: 'auth-boot' });
                // Last-ditch: nuke local state and fall back to logged-out.
                try { clearAllAuth(); } catch { /* swallow */ }
            } finally {
                setIsLoading(false);
            }
        };
        void init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Global auth:expired listener ─────────────────────────────────────

    useEffect(() => {
        const onExpired = () => {
            handleForcedLogout();
            broadcastLogout(); // initiating tab only; receivers stay silent (no loop)
            navigate('/login', { replace: true });
        };
        window.addEventListener('auth:expired', onExpired);
        return () => window.removeEventListener('auth:expired', onExpired);
    }, [handleForcedLogout, navigate]);

    // ── Netz: serverseitiges PASSWORD_CHANGE_REQUIRED (403) abfangen ─────
    //
    // Die requireAdminPasswordChanged-Middleware beantwortet JEDEN
    // /api/admin/*-Call mit 403 { error: 'PASSWORD_CHANGE_REQUIRED' },
    // solange must_change_password=1. client.ts wirft dafür einen ApiError
    // mit message='PASSWORD_CHANGE_REQUIRED'. Landet so ein Fehler uncaught
    // als unhandledrejection, setzen wir das Flag lokal und leiten auf
    // /change-password. (Vom View-Code gefangene Fehler erreichen dieses
    // Netz nicht — der primäre Guard ist der Login-/Restore-Pfad.)

    useEffect(() => {
        const onRejection = (ev: PromiseRejectionEvent) => {
            const reason: unknown = ev.reason;
            if (
                isApiError(reason) &&
                reason.status === 403 &&
                reason.message === 'PASSWORD_CHANGE_REQUIRED'
            ) {
                ev.preventDefault();
                setUser((prev) => {
                    if (!prev || prev.must_change_password === true) return prev;
                    return { ...prev, must_change_password: true };
                });
                const current = loadSession();
                if (current) {
                    saveSession({
                        ...current,
                        user: { ...current.user, must_change_password: true },
                    });
                }
                navigate('/change-password', { replace: true });
            }
        };
        window.addEventListener('unhandledrejection', onRejection);
        return () => window.removeEventListener('unhandledrejection', onRejection);
    }, [navigate]);

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
        markPasswordChanged,
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
