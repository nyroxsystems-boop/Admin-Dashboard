/**
 * impersonationSession — lokaler Marker für eine laufende Impersonation (P1.4).
 *
 * Impersonation öffnet das User-Dashboard in einem NEUEN Tab; das Admin-Dashboard
 * selbst wechselt nicht den Auth-State. Damit der Admin trotzdem sieht „ich habe
 * gerade eine Impersonation offen", merken wir uns das in localStorage und zeigen
 * im AdminTopbar einen Banner. „Zurück zum Admin" löscht den Marker.
 *
 * getSnapshot() liefert eine STABILE Referenz solange sich der gespeicherte String
 * nicht ändert — Pflicht für useSyncExternalStore (sonst Render-Loop).
 */

export interface ActiveImpersonation {
    tenantId: string;
    tenantName: string;
    expiresAt: string | null;
    startedAt: string;
    /** Server-side revoke handle (Audit H-1). Null for legacy markers. */
    sessionId?: string | null;
}

const KEY = 'admin.activeImpersonation';
const EVENT = 'admin:impersonation-changed';

/**
 * localStorage ist nicht überall benutzbar: Safari im privaten Modus wirft beim
 * Zugriff, eingebettete Browser und Testumgebungen stellen ihn teils gar nicht
 * bereit. Ein `typeof window`-Check allein genügt deshalb nicht — er war da,
 * und der Topbar stürzte trotzdem ab.
 *
 * Ohne Speicher gibt es eben keinen Impersonation-Marker. Das ist eine
 * Anzeigehilfe, kein Sicherheitsmerkmal.
 */
function storage(): Storage | null {
    try {
        if (typeof window === 'undefined') return null;
        return window.localStorage ?? null;
    } catch {
        return null;
    }
}

let cachedRaw: string | null | undefined;
let cachedValue: ActiveImpersonation | null = null;

export function getActiveImpersonationSnapshot(): ActiveImpersonation | null {
    const store = storage();
    if (!store) return null;
    let raw: string | null;
    try {
        raw = store.getItem(KEY);
    } catch {
        return null;
    }
    if (raw === cachedRaw) return cachedValue; // stabile Referenz bei Unverändert
    cachedRaw = raw;
    if (!raw) {
        cachedValue = null;
        return null;
    }
    try {
        cachedValue = JSON.parse(raw) as ActiveImpersonation;
    } catch {
        cachedValue = null;
    }
    return cachedValue;
}

export function setActiveImpersonation(v: ActiveImpersonation): void {
    const store = storage();
    if (!store) return;
    try {
        store.setItem(KEY, JSON.stringify(v));
    } catch {
        // Voller oder gesperrter Speicher: der Banner fehlt dann, die
        // Impersonation selbst laeuft trotzdem. Kein Grund abzustuerzen.
        return;
    }
    window.dispatchEvent(new Event(EVENT));
}

export function clearActiveImpersonation(): void {
    const store = storage();
    if (!store) return;
    try {
        store.removeItem(KEY);
    } catch {
        return;
    }
    window.dispatchEvent(new Event(EVENT));
}

export function subscribeImpersonation(cb: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener(EVENT, cb);
    window.addEventListener('storage', cb); // andere Tabs
    return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener('storage', cb);
    };
}
