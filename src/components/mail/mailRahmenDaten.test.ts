/**
 * Übersetzung einer Nachricht in die Felder des Rahmens.
 *
 * Zwei Dinge sind hier wichtiger als der Rest:
 *
 * 1. `istEigenerAbsender` entscheidet, ob die Markenleiste erscheint. Wer sie
 *    bekommt, sieht aus wie Post von uns. Ein Teilstring-Vergleich würde
 *    `info@partsunion.de.boese.example` durchlassen — und einer Fälschung
 *    damit genau das Aussehen geben, das Vertrauen schafft.
 *
 * 2. Die Kategorie darf nur benennen, was BELEGT ist. Wer "SUPPORT" liest,
 *    verlässt sich darauf, dass die Mail wirklich dort ankam.
 */
import { describe, expect, it } from 'vitest';

import type { InboxMessage } from '@/api/types';

import {
    chipsFuer,
    groesse,
    initialen,
    istEigenerAbsender,
    kategorieFuer,
    rahmenDatenFuer,
    textAlsAbsaetze,
    vorschau,
    zeitpunkt,
} from './mailRahmenDaten';
import { KATEGORIE } from './mailRahmen';

function nachricht(over: Partial<InboxMessage> = {}): InboxMessage {
    return {
        id: 'm1',
        direction: 'inbound',
        from: 'max@kunde.de',
        from_name: 'Max Mustermann',
        to: [], cc: [], bcc: [],
        subject: 'Anfrage',
        body: 'Guten Tag',
        html: null,
        received_at: '2026-07-29T12:09:00.000Z',
        is_read: false,
        mailbox: 'support@partsunion.de',
        mailboxes: ['support@partsunion.de'],
        folder: 'inbox',
        attachments: [],
        ...over,
    } as InboxMessage;
}

describe('eigener Absender', () => {
    it('erkennt unsere Domain', () => {
        expect(istEigenerAbsender('info@partsunion.de')).toBe(true);
        expect(istEigenerAbsender('Info@Partsunion.DE')).toBe(true);
        expect(istEigenerAbsender('bot@mail.partsunion.de')).toBe(true);
    });

    it('faellt NICHT auf eine angehaengte Fremddomain herein', () => {
        // Der klassische Fehler. Mit includes() waere das hier `true` — und die
        // Faelschung bekaeme unsere Markenleiste.
        expect(istEigenerAbsender('info@partsunion.de.boese.example')).toBe(false);
        expect(istEigenerAbsender('partsunion.de@boese.example')).toBe(false);
        expect(istEigenerAbsender('info@nichtpartsunion.de')).toBe(false);
    });

    it('kommt mit unbrauchbaren Adressen zurecht', () => {
        expect(istEigenerAbsender('')).toBe(false);
        expect(istEigenerAbsender('kein-at-zeichen')).toBe(false);
    });
});

describe('Markenleiste', () => {
    it('erscheint bei Post von aussen', () => {
        expect(rahmenDatenFuer(nachricht({ from: 'max@kunde.de' }), '').zeigeMarkenleiste).toBe(true);
    });

    it('entfaellt bei eigener Post — sonst steht der Schriftzug doppelt', () => {
        expect(rahmenDatenFuer(nachricht({ from: 'info@partsunion.de' }), '').zeigeMarkenleiste).toBe(false);
    });
});

describe('Kategorie benennt nur Belegbares', () => {
    it('Postfach bei gewoehnlicher Post', () => {
        expect(kategorieFuer(nachricht()).label).toBe('SUPPORT');
    });

    it('Spam gewinnt gegen das Postfach', () => {
        const k = kategorieFuer(nachricht({ folder: 'spam' }));
        expect(k.label).toBe('SPAM');
        expect(k.farbe).toBe(KATEGORIE.eskalation);
    });

    it('ungepruefte Zuordnung wird ausgewiesen', () => {
        // Der Zustellempfaenger war nicht ermittelbar; die Zuordnung beruht auf
        // einer Kopfzeile, die der Absender geschrieben hat.
        const k = kategorieFuer(nachricht({ mailbox_source: 'header' }));
        expect(k.label).toContain('UNGEPR');
        expect(k.farbe).toBe(KATEGORIE.wartet);
    });

    it('gesendete Post wird als solche gekennzeichnet', () => {
        expect(kategorieFuer(nachricht({ direction: 'outbound' })).label).toBe('GESENDET');
    });
});

describe('Initialen', () => {
    it('aus Vor- und Nachname', () => {
        expect(initialen('Max Mustermann', 'x@y.de')).toBe('MM');
    });

    it('aus einem einzelnen Namen', () => {
        expect(initialen('Instagram', 'x@y.de')).toBe('IN');
    });

    it('aus der Adresse, wenn kein Name da ist', () => {
        expect(initialen(null, 'aaron.vogt@partsunion.de')).toBe('AV');
    });

    it('liefert immer etwas', () => {
        expect(initialen('', '@')).toBe('?');
    });
});

describe('Dateigroessen', () => {
    it.each([
        [0, '0 B'],
        [512, '512 B'],
        [2048, '2,0 KB'],
        [245760, '240 KB'],
        [5_242_880, '5,0 MB'],
    ])('%i Bytes -> %s', (bytes, erwartet) => {
        expect(groesse(bytes)).toBe(erwartet);
    });

    it('zeigt einen Strich, wenn die Groesse fehlt', () => {
        expect(groesse(undefined)).toBe('—');
    });
});

describe('Zeitpunkt', () => {
    it('deutsch formatiert', () => {
        expect(zeitpunkt('2026-07-29T12:09:00.000Z')).toMatch(/29\.07\.2026/);
    });

    it('zeigt einen Strich statt "Invalid Date"', () => {
        expect(zeitpunkt('kein datum')).toBe('—');
    });
});

describe('Text als Absaetze', () => {
    it('trennt an Leerzeilen', () => {
        const h = textAlsAbsaetze('Erster Absatz.\n\nZweiter Absatz.');
        expect((h.match(/<p /g) || []).length).toBe(2);
    });

    it('macht einfache Umbrueche zu <br>', () => {
        expect(textAlsAbsaetze('Zeile eins\nZeile zwei')).toContain('<br>');
    });

    it('MASKIERT den Text — er stammt vom Absender', () => {
        const h = textAlsAbsaetze('<script>alert(1)</script>');
        expect(h).not.toContain('<script>');
        expect(h).toContain('&lt;script&gt;');
    });

    it('sagt Bescheid, wenn gar nichts da ist', () => {
        expect(textAlsAbsaetze('   ')).toContain('keinen lesbaren Text');
    });
});

describe('Vorschautext', () => {
    it('kuerzt lange Texte', () => {
        const v = vorschau(nachricht({ body: 'a'.repeat(200) }));
        expect(v.length).toBeLessThanOrEqual(85);
        expect(v.endsWith('…')).toBe(true);
    });

    it('zieht Zeilenumbrueche zu Leerzeichen zusammen', () => {
        expect(vorschau(nachricht({ body: 'Zeile\n\nZwei' }))).toBe('Zeile Zwei');
    });
});

describe('Kontextmarken', () => {
    it('nennt das Postfach', () => {
        expect(chipsFuer(nachricht())).toContain('support@partsunion.de');
    });

    it('weist auf Archiv und Papierkorb hin', () => {
        expect(chipsFuer(nachricht({ folder: 'archive' }))).toContain('Archiv');
        expect(chipsFuer(nachricht({ folder: 'trash' }))).toContain('Papierkorb');
    });

    it('nennt Mehrfachzuordnung', () => {
        const c = chipsFuer(nachricht({ mailboxes: ['a@x.de', 'b@x.de'] }));
        expect(c.some((x) => x.includes('2 Postfächer'))).toBe(true);
    });
});

describe('Gesamtübersetzung', () => {
    it('nimmt den Textkoerper, wenn kein HTML da ist', () => {
        const d = rahmenDatenFuer(nachricht({ html: null, body: 'Nur Text' }), '');
        expect(d.inhaltHtml).toContain('Nur Text');
    });

    it('nimmt das uebergebene HTML, wenn es da ist', () => {
        const d = rahmenDatenFuer(nachricht(), '<p>Aus HTML</p>');
        expect(d.inhaltHtml).toBe('<p>Aus HTML</p>');
    });

    it('faellt bei fehlendem Betreff nicht auf eine leere Zeile zurueck', () => {
        expect(rahmenDatenFuer(nachricht({ subject: null }), '').betreff).toBe('(Kein Betreff)');
    });

    it('liefert KEINE Platzhalteranschrift aus', () => {
        expect(rahmenDatenFuer(nachricht(), '').firmenzeile).toBeNull();
    });

    it('zeigt beim Lesen keine Schaltflaechen', () => {
        expect(rahmenDatenFuer(nachricht(), '').aktionPrimaer).toBeNull();
    });
});
