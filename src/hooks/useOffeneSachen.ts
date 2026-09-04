/**
 * Was auf jemanden wartet — die Grundlage der Glocke in der Kopfzeile.
 *
 * ─── Warum aus vorhandenen Daten und nicht aus einem Ereignisstrom ─────────
 *
 * Die Glocke war abgeschaltet (`PLATFORM_NOTIFICATIONS_ENABLED = false`). Der
 * Grund stand im Kommentar daneben und war richtig: `useNotifications` öffnet
 * einen Ereignisstrom über `/api/events/ticket`, und dieser Endpunkt verlangt
 * einen Mandantenbezug, den eine Plattform-Admin-Sitzung nicht hat. Ein
 * Anschluss hätte bei jedem Laden und jedem Wiederverbinden eine
 * fehlschlagende Anfrage erzeugt — genau die Sorte Schleife, die uns beim
 * Systemzustand die Wartezeit gekostet hat.
 *
 * Eine Glocke braucht dafür aber gar keinen Ereignisstrom. Was ein Admin hier
 * wissen will, holen wir ohnehin schon:
 *
 *   • ungelesene Nachrichten — aus den Postfächern (useMailboxes)
 *   • fehlgeschlagene Zugangsanfragen — aus der Anfragenliste
 *
 * Beide Abfragen laufen bereits für andere Ansichten; dieser Haken liest nur
 * mit. Kein neuer Endpunkt, keine neue Verbindung, keine neue Fehlerquelle.
 *
 * ─── Warum "fehlgeschlagen" und nicht "offen" ──────────────────────────────
 *
 * Zugangsanfragen kennen nur `sent` und `failed` — ein "offen" gibt es nicht.
 * Eine verschickte Anfrage wartet auf den Großhändler, da kann niemand etwas
 * tun. Eine FEHLGESCHLAGENE wartet auf uns. Nur die gehört in eine Glocke;
 * alles andere wäre eine Zahl, die man wegklickt, ohne etwas zu tun.
 */
import { useQuery } from '@tanstack/react-query';

import { getAccessRequestHistory } from '@/api/accessRequests';
import { useMailboxes } from '@/hooks/useInbox';
import type { MailboxSummary } from '@/api/inbox';

export interface OffeneSachen {
    /** Ungelesene Nachrichten über alle Postfächer. */
    ungeleseneMails: number;
    /** Zugangsanfragen, deren Versand fehlgeschlagen ist. */
    fehlgeschlageneAnfragen: number;
    /** Summe — die Zahl auf der Glocke. */
    gesamt: number;
}

/**
 * `all` ist kein weiteres Postfach, sondern die vom Backend bereits
 * deduplizierte Gesamtsicht. Es darf deshalb nicht noch einmal zu den
 * einzelnen Postfächern addiert werden.
 */
export function zaehleUngeleseneMails(mailboxes: MailboxSummary[]): number {
    const alle = mailboxes.find((mailbox) => mailbox.id === 'all');
    if (alle) return alle.unread ?? 0;

    // Rückwärtskompatibel für Antworten ohne virtuelle `all`-Mailbox.
    return mailboxes.reduce((summe, mailbox) => summe + (mailbox.unread ?? 0), 0);
}

export function useOffeneSachen(): OffeneSachen {
    const { mailboxes } = useMailboxes();

    const anfragen = useQuery({
        queryKey: ['admin', 'access-requests', 'verlauf'] as const,
        queryFn: () => getAccessRequestHistory(),
        // Fünf Minuten: Zugangsanfragen entstehen von Hand und selten. Häufiger
        // zu fragen kostet nur Anfragen und ändert die Zahl praktisch nie.
        staleTime: 5 * 60_000,
    });

    /**
     * `unread` kann fehlen, wenn ein Postfach gerade angelegt wurde und das
     * Backend die Zählung noch nicht mitliefert. `?? 0` statt eines Fehlers:
     * eine fehlende Zahl ist kein Grund, die ganze Glocke auszublenden.
     */
    const ungeleseneMails = zaehleUngeleseneMails(mailboxes);

    const fehlgeschlageneAnfragen = (anfragen.data ?? []).filter(
        (a) => a.status === 'failed',
    ).length;

    return {
        ungeleseneMails,
        fehlgeschlageneAnfragen,
        gesamt: ungeleseneMails + fehlgeschlageneAnfragen,
    };
}
