/**
 * Light-weight session-bound token encryption.
 *
 * The key lives in sessionStorage (cleared on tab close), the encrypted
 * token in localStorage (survives reload). Single XSS payload now needs
 * BOTH stores plus an active session — significantly raises the bar
 * compared to plain localStorage tokens.
 *
 * Not a silver bullet: a sufficiently sophisticated XSS can still read both.
 * Real fix is httpOnly cookie + a /refresh endpoint, which the bot-service
 * does not currently provide.
 */

const KEY_NAME = 'pu.admin.skey.v1';
const ALGO = 'AES-GCM';

async function getKey(): Promise<CryptoKey> {
    let raw = sessionStorage.getItem(KEY_NAME);
    if (!raw) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        raw = btoa(String.fromCharCode(...bytes));
        try { sessionStorage.setItem(KEY_NAME, raw); } catch { /* ignore */ }
    }
    const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', keyBytes, ALGO, false, ['encrypt', 'decrypt']);
}

export async function encryptToken(plaintext: string): Promise<string> {
    if (!plaintext) return '';
    if (typeof crypto === 'undefined' || !crypto.subtle) return plaintext; // SSR fallback
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
        { name: ALGO, iv },
        key,
        new TextEncoder().encode(plaintext)
    );
    const ctBytes = new Uint8Array(ct);
    const combined = new Uint8Array(iv.length + ctBytes.length);
    combined.set(iv, 0);
    combined.set(ctBytes, iv.length);
    return btoa(String.fromCharCode(...combined));
}

export async function decryptToken(ciphertext: string): Promise<string | null> {
    if (!ciphertext) return null;
    if (typeof crypto === 'undefined' || !crypto.subtle) return ciphertext;
    try {
        const key = await getKey();
        const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const ct = combined.slice(12);
        const pt = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ct);
        return new TextDecoder().decode(pt);
    } catch {
        return null;
    }
}

export function clearStorageKey(): void {
    try { sessionStorage.removeItem(KEY_NAME); } catch { /* ignore */ }
}
