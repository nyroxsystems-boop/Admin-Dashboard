/**
 * Partsunion-Rahmen für E-Mail-Darstellung.
 *
 * Der wichtigste Teil hier ist das MASKIEREN. Betreff, Absendername,
 * Dateinamen und Postfachangaben kommen von Fremden und landen in HTML.
 * `Max <script>alert(1)</script>` als Anzeigename ist kein Gedankenspiel —
 * das Feld steht dem Absender frei zur Verfügung.
 *
 * Nur `inhaltHtml` geht roh hinein; das ist zuvor durch sanitizeMailHtml
 * gelaufen. Alles andere MUSS maskiert sein.
 */
import { describe, expect, it } from 'vitest';

import {
    DUNKEL,
    KATEGORIE,
    RAHMEN_AUSSEN,
    RAHMEN_CHIP_HINTERGRUND,
    RAHMEN_MARKENLEISTE,
    renderMailRahmen,
    type MailRahmenDaten,
} from './mailRahmen';

function daten(over: Partial<MailRahmenDaten> = {}): MailRahmenDaten {
    return {
        betreff: 'Anfrage Bremsscheiben',
        vorschautext: 'Guten Tag, wir suchen…',
        kategorieLabel: 'SUPPORT',
        kategorieFarbe: KATEGORIE.kunde,
        absenderName: 'Max Mustermann',
        absenderAdresse: 'max@kunde.de',
        absenderInitialen: 'MM',
        empfangenAm: '29.07.2026, 14:12',
        chips: [],
        inhaltHtml: '<p>Guten Tag</p>',
        anhaenge: [],
        zeigeMarkenleiste: true,
        fusszeileHerkunft: 'Eingegangen über Partsunion Mail',
        ...over,
    };
}

describe('Maskierung fremder Angaben', () => {
    it('maskiert einen Betreff mit HTML', () => {
        const h = renderMailRahmen(daten({ betreff: '<script>alert(1)</script>' }));
        expect(h).not.toContain('<script>alert(1)</script>');
        expect(h).toContain('&lt;script&gt;');
    });

    it('maskiert den Absendernamen', () => {
        const h = renderMailRahmen(daten({ absenderName: 'Max <img src=x onerror=alert(1)>' }));
        expect(h).not.toContain('<img src=x');
        expect(h).toContain('&lt;img');
    });

    it('maskiert Dateinamen von Anhaengen', () => {
        const h = renderMailRahmen(daten({
            anhaenge: [{ dateiname: '"><script>x</script>.pdf', groesse: '12 KB' }],
        }));
        expect(h).not.toContain('<script>x</script>');
    });

    it('maskiert Anfuehrungszeichen, damit kein Attribut aufbricht', () => {
        // Ein Anzeigename mit " koennte sonst aus dem style-Attribut ausbrechen.
        const h = renderMailRahmen(daten({ absenderInitialen: '"><b>' }));
        expect(h).not.toContain('"><b>');
        expect(h).toContain('&quot;&gt;&lt;b&gt;');
    });

    it('setzt inhaltHtml BEWUSST roh ein — er ist bereits bereinigt', () => {
        const h = renderMailRahmen(daten({ inhaltHtml: '<table><tr><td style="padding:8px">Zelle</td></tr></table>' }));
        expect(h).toContain('<table><tr><td style="padding:8px">Zelle</td></tr></table>');
    });
});

describe('Adressen in Schaltflaechen', () => {
    it('zeigt die Schaltflaeche, sobald eine Aktion angegeben ist', () => {
        const h = renderMailRahmen(daten({ aktionPrimaer: { text: 'Öffnen', url: 'https://x.de' } }));
        expect(h).toContain('class="pu-btn pu-btn-cell"');
        expect(h).toContain('Öffnen');
    });

    it('laesst gewoehnliche Adressen durch', () => {
        const h = renderMailRahmen(daten({
            aktionPrimaer: { text: 'Öffnen', url: 'https://app.partsunion.de/x' },
        }));
        expect(h).toContain('href="https://app.partsunion.de/x"');
    });

    it('entschaerft javascript:-Adressen zu einem Anker', () => {
        const h = renderMailRahmen(daten({
            aktionPrimaer: { text: 'Klick', url: 'javascript:alert(1)' },
        }));
        expect(h).not.toContain('javascript:');
        expect(h).toContain('href="#"');
    });

    it('entschaerft data:-Adressen', () => {
        const h = renderMailRahmen(daten({
            aktionPrimaer: { text: 'Klick', url: 'data:text/html,<script>x</script>' },
        }));
        expect(h).not.toContain('data:text/html');
    });
});

describe('bedingte Abschnitte', () => {
    it('laesst die Chip-Zeile weg, wenn es keine gibt', () => {
        expect(renderMailRahmen(daten({ chips: [] }))).not.toContain(RAHMEN_CHIP_HINTERGRUND);
    });

    it('zeigt Chips, wenn welche da sind', () => {
        const h = renderMailRahmen(daten({ chips: ['support@partsunion.de', 'Archiv'] }));
        expect(h).toContain('support@partsunion.de');
        expect(h).toContain('Archiv');
    });

    it('laesst den Anhang-Block weg, wenn keine Anhaenge da sind', () => {
        expect(renderMailRahmen(daten({ anhaenge: [] }))).not.toContain('ANH&Auml;NGE');
    });

    it('zeigt Anhaenge mit Anzahl und Groesse', () => {
        const h = renderMailRahmen(daten({
            anhaenge: [
                { dateiname: 'Rechnung.pdf', groesse: '240 KB' },
                { dateiname: 'Lieferschein.pdf', groesse: '1,2 MB' },
            ],
        }));
        expect(h).toContain('ANH&Auml;NGE &middot; 2');
        expect(h).toContain('Rechnung.pdf');
        expect(h).toContain('1,2 MB');
    });

    it('laesst die Aktionsleiste weg, wenn keine Aktion angegeben ist', () => {
        // Beim Lesen im Dashboard gibt es keine — die Werkzeugleiste der
        // Anwendung uebernimmt das, und ein Link im abgeschotteten Rahmen
        // koennte sie ohnehin nicht ausloesen.
        //
        // Geprueft wird das KLASSENATTRIBUT der Schaltflaeche. Weder `pu-btn`
        // allein (steht im Stilblock) noch die Farbe (der Kategoriestreifen
        // nutzt dasselbe Blau) taugen als Merkmal.
        expect(renderMailRahmen(daten())).not.toContain('class="pu-btn pu-btn-cell"');
    });

    it('laesst die Platzhalter-Anschrift weg, solange keine echte vorliegt', () => {
        const h = renderMailRahmen(daten({ firmenzeile: null }));
        expect(h).not.toContain('Musterstra');
    });

    it('zeigt eine Anschrift, sobald sie gesetzt ist', () => {
        const h = renderMailRahmen(daten({ firmenzeile: 'Partsunion GmbH, Echte Str. 5, 12345 Stadt' }));
        expect(h).toContain('Echte Str. 5');
    });
});

describe('Grundgeruest', () => {
    it('traegt Betreff, Absender und Zeitpunkt', () => {
        const h = renderMailRahmen(daten());
        expect(h).toContain('Anfrage Bremsscheiben');
        expect(h).toContain('Max Mustermann');
        expect(h).toContain('max@kunde.de');
        expect(h).toContain('29.07.2026, 14:12');
        expect(h).toContain('MM');
    });

    it('faerbt den Kategoriestreifen', () => {
        expect(renderMailRahmen(daten({ kategorieFarbe: KATEGORIE.eskalation })))
            .toContain(KATEGORIE.eskalation);
    });

    it('begrenzt fremde Bilder und Tabellen auf die Rahmenbreite', () => {
        // Steht nicht in der Vorlage: dort ist der Inhalt selbst verfasst.
        // Hier stammt er von aussen und wuerde den Rahmen sonst sprengen.
        const h = renderMailRahmen(daten());
        expect(h).toContain('.pu-inhalt img');
        expect(h).toContain('max-width: 100% !important');
    });
});

describe('Markenleiste', () => {
    it('zeigt den Schriftzug bei Post von aussen', () => {
        expect(renderMailRahmen(daten({ zeigeMarkenleiste: true }))).toContain('PARTSUNION');
    });

    it('laesst ihn bei eigener Post weg — sonst steht er doppelt', () => {
        // Unsere Benachrichtigungen bringen einen eigenen dunklen Kopfbereich
        // mit Logo mit. Zwei Partsunion-Balken untereinander sehen nach
        // Versehen aus.
        const h = renderMailRahmen(daten({ zeigeMarkenleiste: false }));
        expect(h).not.toContain('PARTSUNION');
    });

    it('behaelt die Kategorie auch ohne Markenleiste', () => {
        const h = renderMailRahmen(daten({ zeigeMarkenleiste: false, kategorieLabel: 'ESKALATION' }));
        expect(h).toContain('ESKALATION');
    });
});

describe('Untergrund ausserhalb der Karte', () => {
    it('ist standardmaessig hell — so kennt man es aus jedem Postfach', () => {
        expect(renderMailRahmen(daten())).toContain(RAHMEN_AUSSEN);
    });

    it('laesst sich abschalten, damit die Karte auf der dunklen Oberflaeche sitzt', () => {
        // Beim Lesen im Dashboard stoert der helle Streifen: er legt einen
        // Rahmen um die Karte, mitten in einer dunklen Anwendung.
        const h = renderMailRahmen(daten({ aussenHintergrund: null }));
        expect(h).toContain('background: transparent;');
        expect(h).toContain('padding: 0;');
    });
});

describe('dunkles Erscheinungsbild', () => {
    it('faerbt Karte und Schrift auf die Farben der Anwendung um', () => {
        const h = renderMailRahmen(daten({ dunkel: true }));
        expect(h).toContain(DUNKEL.karte);
        expect(h).toContain(DUNKEL.text);
        expect(h).not.toContain('background: #FFFFFF');
    });

    it('bleibt hell, wenn nicht ausdruecklich dunkel verlangt', () => {
        // Beim VERSENDEN gilt das helle Original — wir wissen nicht, welches
        // Erscheinungsbild der Empfaenger nutzt.
        const h = renderMailRahmen(daten());
        expect(h).toContain('#FFFFFF');
        expect(h).not.toContain(DUNKEL.karte);
    });

    it('zeigt die Markenleiste im Hellmodus weiss und im Dunkelmodus weiterhin dunkel', () => {
        const hell = renderMailRahmen(daten({ zeigeMarkenleiste: true }));
        const dunkel = renderMailRahmen(daten({ zeigeMarkenleiste: true, dunkel: true }));

        expect(hell).toContain(`background: ${RAHMEN_MARKENLEISTE}`);
        expect(hell).not.toContain(`background: ${DUNKEL.leiste}`);
        expect(dunkel).toContain(`background: ${DUNKEL.leiste}`);
    });
});

describe('Breite', () => {
    it('nutzt das Briefmass, wenn nichts anderes verlangt ist', () => {
        expect(renderMailRahmen(daten())).toContain('width: 600px');
    });

    it('fuellt in der Leseansicht die Breite, deckelt ausgehende Post bei 600', () => {
        /**
         * Die Karte im Lesebereich soll buendig mit dem Knopf "Auf diese
         * E-Mail antworten" darunter abschliessen — der ist `w-full`. Ein
         * Deckel in Pixeln erzeugt dort eine Kante, die nach Versehen aussieht.
         *
         * Zwischendurch stand hier 720 px, und das war zu seiner Zeit richtig:
         * fremde Newsletter sind fuer etwa 600 px gebaut, ihre inneren
         * Tabellen tragen `margin: 0 auto` und zentrierten sich EINZELN im zu
         * breiten Rahmen — einer bei 394 px, der naechste bei 480, ein dritter
         * linksbuendig. Der Deckel war die Notbremse dagegen.
         *
         * Inzwischen zwingt der Stilblock jede Tabelle im Inhalt auf
         * `margin-left/right: auto` (eigener Test unten). Alle Bloecke sitzen
         * damit auf derselben Mittelachse, unabhaengig von der Kartenbreite —
         * die Ursache ist behoben, die Notbremse nicht mehr noetig.
         *
         * AUSGEHENDE Post behaelt ihre 600 px: die liest niemand in unserem
         * Lesebereich, sondern in Outlook, Gmail und Apple Mail.
         */
        const lesen = renderMailRahmen(daten({ volleBreite: true }));
        expect(lesen, 'im Lesebereich darf kein Pixel-Deckel stehen').not.toMatch(
            /class="pu-deckel"[^>]*max-width:\s*\d+px/,
        );
        expect(lesen).toMatch(/class="pu-deckel" style="max-width: 100%;/);

        const ausgehend = renderMailRahmen(daten({ volleBreite: false }));
        expect(
            ausgehend,
            'ausgehende Post wird in fremden Mailprogrammen gelesen und bleibt bei 600 px',
        ).toMatch(/class="pu-deckel" style="max-width: 600px;/);

        expect(lesen, 'ohne Zentrierung klebt die Karte links').toContain('margin: 0 auto');
    });

    it('holt fremde Mails in die Mitte', () => {
        /**
         * Das eigentliche Symptom: der Inhalt stand rechts statt mittig.
         *
         * Newsletter setzen an Abstandszellen gern `display: block`, damit sie
         * auf dem Handy umbrechen. In einem echten Browser faellt die Zelle
         * damit aus der Tabelle; der Rest der Zeile landet in einer ANONYMEN
         * Zelle, und wo die sitzt, entscheidet jeder Browser fuer sich. In
         * Chromium blieb der Inhalt mittig, in Safari rutschte er nach rechts.
         * Die Instagram-Mail hat neun solcher Zellen.
         *
         * Zwei Regeln beheben das unabhaengig vom Browser: Zellen zurueck auf
         * table-cell, und jede Tabelle waagerecht mittig. Nachgemessen: 17 von
         * 17 Bloecken mit gleichem Rand links und rechts.
         */
        const h = renderMailRahmen(daten({ volleBreite: true }));
        /**
         * VERSTECKEN, nicht auf table-cell zurueckstellen. Der erste Versuch
         * stand genau falsch herum: als echte Zellen machen die
         * Abstandshalter aus Instagrams wechselnden Zeilen
         * (Inhalt|Abstand / Abstand|Inhalt) eine ZWEISPALTIGE Tabelle von
         * 886 px, in der der Inhalt mal links und mal rechts sitzt — der
         * gemeldete Versatz, nur vollstaendig.
         */
        expect(h).toContain('display: none !important');
        expect(h, 'die Klammer muss beide Schreibweisen treffen').toContain('td[style*="display:block"]');
        expect(h, 'auch mit Leerzeichen').toContain('td[style*="display: block"]');
        expect(h, 'feste Breiten kleben sonst an einer Seite').toMatch(
            /\.pu-inhalt table \{ margin-left: auto !important; margin-right: auto !important; \}/,
        );
    });

    it('deckelt auf einem BLOCK, nicht auf der Tabelle', () => {
        /**
         * Der Fehler, der dreimal zurueckkam.
         *
         * Die Deckelung stand am <table class="pu-shell">. In Chromium wirkt
         * das — nachgemessen 720 px, mittig, kein Ueberstand. In SAFARI nicht:
         * dort ignoriert eine Tabelle mit `width: 100%` ihre eigene
         * `max-width`, und die Karte lief auf volle Breite.
         *
         * Ich habe jedes Mal in Chromium gemessen und daraus geschlossen, der
         * Fix sei wirksam. Er war es — nur nicht im Browser des Nutzers.
         *
         * `max-width` auf einem Block ist ueberall verlaesslich. Deshalb
         * prueft dieser Test die STELLE und nicht nur den Wert.
         */
        /**
         * Geprueft wird an der AUSGEHENDEN Post: die traegt weiterhin einen
         * Deckel in Pixeln, im Lesebereich fuellt die Karte inzwischen die
         * volle Breite. Die Stelle bleibt damit pruefbar, auch wenn der Wert
         * fuer die Leseansicht weggefallen ist.
         */
        const h = renderMailRahmen(daten({ volleBreite: false }));

        const deckel = /<div class="pu-deckel" style="max-width: 600px; margin: 0 auto;">/.exec(h);
        expect(deckel, 'der Deckel-Block fehlt').not.toBeNull();

        // Die Tabelle selbst traegt KEINE Deckelung mehr.
        const shell = /<table[^>]*class="pu-shell"[^>]*style="([^"]*)"/.exec(h);
        expect(shell, 'pu-shell nicht gefunden').not.toBeNull();
        expect(
            shell![1],
            'auf der Tabelle wirkt max-width in Safari nicht — sie gehoert an den Block',
        ).not.toMatch(/max-width:\s*\d+px/);
    });
});

describe('der Stilblock ist gültiges CSS-in-Template', () => {
    /**
     * Zwei Mal hintereinander stolperte ich über dasselbe: ein Backtick in
     * einem CSS-Kommentar beendet den Template-String, und der Fehler kommt
     * als kryptisches "';' expected" viele Zeilen später.
     *
     * Der Test prüft nicht den Quelltext, sondern das ERGEBNIS: kommt ein
     * vollständiger Stilblock heraus und stehen die Klammern paarweise, kann
     * der String nicht vorzeitig geendet haben.
     */
    it('liefert einen geschlossenen Stilblock mit paarigen Klammern', () => {
        const h = renderMailRahmen(daten());
        const block = h.slice(h.indexOf('<style>'), h.indexOf('</style>'));
        expect(block.length, 'Stilblock fehlt oder ist leer').toBeGreaterThan(500);

        const auf = (block.match(/\{/g) ?? []).length;
        const zu = (block.match(/\}/g) ?? []).length;
        expect(auf, 'geschweifte Klammern stehen nicht paarweise').toBe(zu);

        // Ein durchgereichter Platzhalter wäre der Beweis für einen Bruch.
        expect(block).not.toContain('${');
    });
});
