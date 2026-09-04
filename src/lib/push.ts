/**
 * push — An- und Abmelden für Benachrichtigungen über neue Post.
 *
 * Zwei Zustände werden hier sauber auseinandergehalten, weil sie sich sonst
 * gegenseitig überschreiben:
 *
 *   Berechtigung   — vom Browser vergeben, gilt für die ganze Herkunft, und
 *                    ein "abgelehnt" lässt sich per Code NICHT zurücknehmen.
 *   Abonnement     — unsere Zeile in der Datenbank, jederzeit an- und abschaltbar.
 *
 * Wer die Berechtigung erteilt, aber das Abonnement abschaltet, soll nicht
 * erneut gefragt werden. Deshalb ist der maßgebliche Zustand immer das
 * Abonnement beim Browser, nie die Berechtigung allein.
 *
 * Der Anmeldedialog wird NIE ungefragt geöffnet. Ein Benachrichtigungsdialog
 * beim Seitenaufruf ist der schnellste Weg zu einem dauerhaften "Blockiert" —
 * und das ist dann nicht mehr zu reparieren, außer von Hand in den
 * Browsereinstellungen. Er erscheint nur nach einem Klick auf die Glocke.
 */
import { fetchPushKey, subscribePush, unsubscribePush } from '@/api/inbox';

const SW_PFAD = '/sw.js';

export type PushZustand =
    | 'nicht-unterstuetzt'   // Browser kann kein Push (u. a. iOS-Safari ohne Homescreen)
    | 'server-aus'           // VAPID auf dem Server nicht eingerichtet
    | 'blockiert'            // Nutzer hat abgelehnt — nur in den Browsereinstellungen zu ändern
    | 'aus'                  // technisch möglich, nicht abonniert
    | 'an';

/**
 * Der VAPID-Schlüssel kommt als base64url und muss als Byte-Feld übergeben
 * werden. `atob` versteht kein base64url, deshalb erst die beiden abweichenden
 * Zeichen zurücktauschen und auf ein Vielfaches von vier auffüllen.
 */
function schluesselZuBytes(base64url: string): Uint8Array {
    const fuellung = '='.repeat((4 - (base64url.length % 4)) % 4);
    const roh = atob((base64url + fuellung).replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(roh.length);
    for (let i = 0; i < roh.length; i += 1) bytes[i] = roh.charCodeAt(i);
    return bytes;
}

export function pushMoeglich(): boolean {
    return (
        typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window
    );
}

/**
 * Registriert den Service Worker.
 *
 * Wird auch ohne Push gebraucht: ohne Registrierung ist die Anwendung nicht
 * installierbar. Fehler sind hier nicht schlimm — dann gibt es eben keine
 * Installation und keine Benachrichtigungen, die Anwendung selbst läuft weiter.
 */
export async function serviceWorkerRegistrieren(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    try {
        return await navigator.serviceWorker.register(SW_PFAD, { scope: '/' });
    } catch {
        return null;
    }
}

export async function pushZustand(): Promise<PushZustand> {
    if (!pushMoeglich()) return 'nicht-unterstuetzt';

    let key: Awaited<ReturnType<typeof fetchPushKey>>;
    try {
        key = await fetchPushKey();
    } catch {
        return 'server-aus';
    }
    if (!key.enabled || !key.publicKey) return 'server-aus';

    if (Notification.permission === 'denied') return 'blockiert';

    const reg = await navigator.serviceWorker.getRegistration(SW_PFAD);
    if (!reg) return 'aus';

    const vorhanden = await reg.pushManager.getSubscription();
    return vorhanden ? 'an' : 'aus';
}

/**
 * Schaltet Benachrichtigungen ein. Nur aus einem Klick heraus aufrufen —
 * der Browser verlangt für den Berechtigungsdialog eine Nutzergeste.
 */
export async function pushEinschalten(): Promise<PushZustand> {
    if (!pushMoeglich()) return 'nicht-unterstuetzt';

    const key = await fetchPushKey();
    if (!key.enabled || !key.publicKey) return 'server-aus';

    const erlaubnis = await Notification.requestPermission();
    if (erlaubnis !== 'granted') return erlaubnis === 'denied' ? 'blockiert' : 'aus';

    const reg = (await serviceWorkerRegistrieren()) ?? (await navigator.serviceWorker.ready);
    if (!reg) return 'nicht-unterstuetzt';

    // Ein bestehendes Abonnement kann auf einen ALTEN Schlüssel lauten (etwa
    // nach einem Schlüsselwechsel auf dem Server). Der Push-Dienst nimmt es
    // dann zwar an, die Entschlüsselung auf dem Gerät scheitert aber still.
    // Deshalb: vorhandenes Abonnement mit abweichendem Schlüssel wegwerfen.
    const bytes = schluesselZuBytes(key.publicKey);
    const alt = await reg.pushManager.getSubscription();
    if (alt) {
        const altKey = alt.options?.applicationServerKey;
        const gleich = altKey
            ? new Uint8Array(altKey).every((b, i) => b === bytes[i])
                && new Uint8Array(altKey).length === bytes.length
            : false;
        if (!gleich) await alt.unsubscribe();
    }

    const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes as BufferSource,
    });

    await subscribePush(sub.toJSON());
    return 'an';
}

/**
 * Schaltet Benachrichtigungen aus.
 *
 * Erst beim Server abmelden, dann beim Browser: andersherum bliebe bei einem
 * Netzfehler eine Zeile in der Datenbank stehen, deren Endpunkt es nicht mehr
 * gibt — sie würde erst nach dem nächsten Zustellversuch aufgeräumt.
 */
export async function pushAusschalten(): Promise<PushZustand> {
    const reg = await navigator.serviceWorker.getRegistration(SW_PFAD);
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return 'aus';

    try {
        await unsubscribePush(sub.endpoint);
    } catch {
        // Weiter: das Abonnement beim Browser muss trotzdem weg, sonst zeigt die
        // Oberfläche "an" und der Knopf tut beim nächsten Klick nichts.
    }
    await sub.unsubscribe();
    return 'aus';
}
