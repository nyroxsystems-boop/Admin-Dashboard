/**
 * Übersetzt eine Nachricht in die Felder des Partsunion-Rahmens.
 *
 * Getrennt von mailRahmen.ts, damit die Vorlage rein bleibt: sie bekommt
 * fertige Werte und trifft keine Entscheidungen. Was hier entschieden wird,
 * lässt sich dadurch ohne HTML prüfen (mailRahmenDaten.test.ts).
 *
 * GRUNDSATZ für die Kategorie: Sie benennt nur, was wir WISSEN — in welchem
 * Postfach die Mail liegt, ob sie als Spam gilt, ob die Zuordnung ungeprüft
 * ist. Nicht, worum es inhaltlich geht. Eine geratene Einordnung wäre
 * schlimmer als keine: Wer "Kunde" liest, verlässt sich darauf.
 */
import type { InboxMessage } from '@/api/types';

import { KATEGORIE, RAHMEN_GEDAEMPFT, type MailRahmenDaten } from './mailRahmen';

/** Initialen aus Anzeigename oder Adresse. Immer zwei Zeichen oder eines. */
export function initialen(name: string | null | undefined, adresse: string): string {
    const quelle = (name || '').trim() || adresse.split('@')[0].replace(/[._-]+/g, ' ');
    const teile = quelle.split(/\s+/).filter(Boolean);
    if (teile.length === 0) return '?';
    if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase();
    return (teile[0][0] + teile[teile.length - 1][0]).toUpperCase();
}

/** Dateigrösse in einer Form, die man vorlesen kann. */
export function groesse(bytes: number | undefined): string {
    if (bytes === undefined || bytes < 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0).replace('.', ',')} KB`;
    return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Datum und Uhrzeit, deutsch. Ungültige Werte ergeben einen Strich. */
export function zeitpunkt(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

interface Kategorie {
    label: string;
    farbe: string;
}

/**
 * Kategorie aus belegbaren Eigenschaften — nie aus dem Inhalt geraten.
 *
 * Die Reihenfolge ist die Rangfolge: Was eine Warnung verdient, gewinnt gegen
 * die blosse Postfachangabe.
 */
export function kategorieFuer(m: InboxMessage): Kategorie {
    if (m.folder === 'spam') return { label: 'SPAM', farbe: KATEGORIE.eskalation };
    if (m.mailbox_source === 'header') {
        // Der Zustellempfänger war nicht ermittelbar; die Zuordnung beruht auf
        // einer Kopfzeile, die der Absender geschrieben hat.
        return { label: 'ZUORDNUNG UNGEPRÜFT', farbe: KATEGORIE.wartet };
    }
    if (m.direction === 'outbound') return { label: 'GESENDET', farbe: KATEGORIE.info };
    const postfach = (m.mailbox || m.mailboxes[0] || '').split('@')[0];
    return {
        label: postfach ? postfach.toUpperCase() : 'POSTEINGANG',
        farbe: KATEGORIE.kunde,
    };
}

/** Kontextmarken unter dem Betreff. Bewusst wenige — sonst liest sie niemand. */
export function chipsFuer(m: InboxMessage): string[] {
    const chips: string[] = [];
    if (m.mailbox) chips.push(m.mailbox);
    if (m.folder === 'archive') chips.push('Archiv');
    if (m.folder === 'trash') chips.push('Papierkorb');
    if (m.mailboxes.length > 1) chips.push(`${m.mailboxes.length} Postfächer`);
    return chips;
}

/**
 * Stammt die Mail von uns selbst?
 *
 * Entscheidet, ob die Markenleiste gezeigt wird. Verglichen wird die DOMAIN
 * hinter dem @, nicht ein Teilstring: sonst ginge auch
 * `info@partsunion.de.boese.example` als eigene Post durch — und bekaeme
 * damit ein Aussehen, das Vertrauen schafft.
 */
export function istEigenerAbsender(adresse: string): boolean {
    const domain = adresse.trim().toLowerCase().split('@').pop() || '';
    return domain === 'partsunion.de' || domain.endsWith('.partsunion.de');
}

function escText(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Reiner Text als Absätze.
 *
 * Nur für Mails OHNE HTML-Teil. Der Text stammt vom Absender und wird
 * maskiert — sonst wäre ein `<script>` im Textkörper der bequemste Weg in den
 * Rahmen hinein.
 */
export function textAlsAbsaetze(text: string): string {
    const absaetze = text.replace(/\r\n/g, '\n').split(/\n{2,}/).filter((a) => a.trim());
    if (absaetze.length === 0) {
        return `<p style="margin: 0; color: ${RAHMEN_GEDAEMPFT};">Diese E-Mail enthält keinen lesbaren Text.</p>`;
    }
    return absaetze
        .map((a) => `<p style="margin: 0 0 14px;">${escText(a.trim()).replace(/\n/g, '<br>')}</p>`)
        .join('');
}

/** Vorschautext für die Vorschauzeile — aus dem Textkörper, gekürzt. */
export function vorschau(m: InboxMessage): string {
    const roh = (m.body || '').replace(/\s+/g, ' ').trim();
    return roh.length > 85 ? `${roh.slice(0, 84)}…` : roh;
}

/**
 * Baut die Felder für den Rahmen.
 *
 * `inhaltHtml` muss BEREITS bereinigt sein — diese Funktion prüft nichts nach.
 * Die Bereinigung liegt in sanitizeMailHtml.ts, damit es genau eine Stelle
 * dafür gibt.
 */
export function rahmenDatenFuer(m: InboxMessage, inhaltHtmlBereinigt: string): MailRahmenDaten {
    const kategorie = kategorieFuer(m);
    const adresse = m.direction === 'outbound' ? (m.to[0] || m.from) : m.from;
    const name = (m.from_name || '').trim() || adresse;

    return {
        betreff: (m.subject || '').trim() || '(Kein Betreff)',
        vorschautext: vorschau(m),
        kategorieLabel: kategorie.label,
        kategorieFarbe: kategorie.farbe,
        absenderName: name,
        absenderAdresse: adresse,
        absenderInitialen: initialen(m.from_name, adresse),
        empfangenAm: zeitpunkt(m.received_at),
        chips: chipsFuer(m),
        // Eigene Benachrichtigungen bringen ihren eigenen Kopfbereich mit.
        zeigeMarkenleiste: !istEigenerAbsender(m.from),
        inhaltHtml: inhaltHtmlBereinigt || textAlsAbsaetze(m.body || ''),
        anhaenge: (m.attachments || []).map((a) => ({
            dateiname: a.filename || 'Anhang',
            groesse: groesse(a.size),
        })),
        // Beim LESEN keine Schaltflächen: Antworten und Archivieren stehen in
        // der Werkzeugleiste der Anwendung, und ein Link im abgeschotteten
        // Rahmen könnte sie ohnehin nicht auslösen.
        aktionPrimaer: null,
        fusszeileHerkunft: m.mailbox
            ? `Eingegangen über Partsunion Mail · ${m.mailbox}`
            : 'Eingegangen über Partsunion Mail',
        // Die Vorlage enthält an dieser Stelle eine Platzhalteranschrift
        // ("Musterstraße 1, 00000 Musterstadt"). Die wird NICHT ausgeliefert —
        // eine erfundene Anschrift unter einer echten Mail ist schlimmer als
        // gar keine. Sobald die richtige vorliegt, kommt sie hier hinein.
        firmenzeile: null,
        abmeldeUrl: null,
    };
}
