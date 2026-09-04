/**
 * Lesbare Bezeichnungen für Audit-Einträge.
 *
 * ANLASS: In der Übersicht und im Audit-Log stand bisher der rohe Schlüssel —
 * `ADMIN_LOGIN`, `TENANT_UPDATE`. Das ist eine Entwicklerkonstante, kein Satz
 * für einen Menschen. In der Datenbank stehen aktuell ausschliesslich solche
 * Werte in Grossbuchstaben.
 *
 * ─── Warum eine Rückfallregel und keine reine Liste ────────────────────────
 *
 * Neue Aktionen entstehen im Backend, nicht hier. Eine reine Liste würde bei
 * jedem neuen Schlüssel wieder den Rohwert zeigen — nur unbemerkt, weil kein
 * Test dagegen läuft. Deshalb gilt: Bekanntes bekommt einen guten Satz,
 * Unbekanntes wird wenigstens LESBAR gemacht (`TENANT_UPDATE` → `Tenant
 * update`) statt roh durchgereicht.
 */

/** Aktionen, die es heute wirklich gibt, plus die absehbaren. */
const AKTIONEN: Record<string, string> = {
    ADMIN_LOGIN: 'Angemeldet',
    ADMIN_LOGOUT: 'Abgemeldet',
    ADMIN_LOGIN_FAILED: 'Anmeldung fehlgeschlagen',
    ADMIN_CREATE: 'Admin angelegt',
    ADMIN_UPDATE: 'Admin geändert',
    ADMIN_DELETE: 'Admin gelöscht',
    ADMIN_PASSWORD_CHANGE: 'Passwort geändert',
    TENANT_CREATE: 'Kunde angelegt',
    TENANT_UPDATE: 'Kunde geändert',
    TENANT_DELETE: 'Kunde gelöscht',
    TENANT_SUSPEND: 'Kunde gesperrt',
    ACCESS_REQUEST_CREATE: 'Zugang beantragt',
    ACCESS_REQUEST_APPROVE: 'Zugang gewährt',
    ACCESS_REQUEST_REJECT: 'Zugang abgelehnt',
    MAILBOX_ACCESS_GRANT: 'Postfach-Recht vergeben',
    MAILBOX_ACCESS_REVOKE: 'Postfach-Recht entzogen',
    IMPERSONATE_START: 'Sitzung übernommen',
    IMPERSONATE_END: 'Übernahme beendet',
    DOCUMENT_UPLOAD: 'Dokument hochgeladen',
    DOCUMENT_DELETE: 'Dokument gelöscht',
};

/** Gegenstände, auf die sich eine Aktion bezieht. */
const OBJEKTE: Record<string, string> = {
    ADMIN: 'Admin',
    TENANT: 'Kunde',
    USER: 'Nutzer',
    ORDER: 'Bestellung',
    MAILBOX: 'Postfach',
    DOCUMENT: 'Dokument',
    ACCESS_REQUEST: 'Zugangsanfrage',
    SESSION: 'Sitzung',
};

/**
 * Macht einen unbekannten Schlüssel wenigstens lesbar.
 *
 * `TENANT_UPDATE_LIMITS` → `Tenant update limits`. Nicht schön, aber ein Satz
 * statt einer Konstante — und man erkennt sofort, dass hier eine Übersetzung
 * fehlt, statt dass es wie Absicht aussieht.
 */
function lesbarMachen(schluessel: string): string {
    const worte = schluessel.trim().replace(/[._-]+/g, ' ').toLowerCase().split(/\s+/).filter(Boolean);
    if (worte.length === 0) return 'Änderung';
    return worte[0][0].toUpperCase() + worte[0].slice(1) + (worte.length > 1 ? ` ${worte.slice(1).join(' ')}` : '');
}

export function auditAktion(schluessel: string | null | undefined): string {
    if (!schluessel?.trim()) return 'Änderung';
    return AKTIONEN[schluessel.trim().toUpperCase()] ?? lesbarMachen(schluessel);
}

export function auditObjekt(schluessel: string | null | undefined): string | null {
    if (!schluessel?.trim()) return null;
    return OBJEKTE[schluessel.trim().toUpperCase()] ?? lesbarMachen(schluessel);
}

/**
 * Ganze Zeile: "Aaron hat sich angemeldet" liest sich besser als
 * "Aaron · ADMIN_LOGIN". Der Gegenstand kommt nur dazu, wenn er etwas
 * hinzufügt — bei "Angemeldet · Sitzung" wäre er nur Lärm.
 */
export function auditZeile(eintrag: {
    action?: string | null;
    action_type?: string | null;
    entity_type?: string | null;
    entity_name?: string | null;
}): string {
    const aktion = auditAktion(eintrag.action || eintrag.action_type);
    const name = eintrag.entity_name?.trim();
    if (name) return `${aktion} · ${name}`;

    const objekt = auditObjekt(eintrag.entity_type);
    // Steht der Gegenstand schon in der Aktion, nicht wiederholen.
    if (objekt && !aktion.toLowerCase().includes(objekt.toLowerCase())) {
        return `${aktion} · ${objekt}`;
    }
    return aktion;
}
