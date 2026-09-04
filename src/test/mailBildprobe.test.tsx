/**
 * Bildprobe für die Mail-Darstellung — mit einer ECHTEN Mail aus dem Postfach.
 *
 * Anlass: im laufenden Postfach war bei einem Newsletter ein grosser schwarzer
 * Block zu sehen, wo Bilder stehen sollten. Ohne eine Probe mit der echten
 * Nachricht bliebe jede Aussage darüber geraten — Beispiel-HTML zeigt genau die
 * Fälle nicht, die in der Wirklichkeit auftreten.
 *
 * Die Datei `scratchpad/mail-roh.html` ist eine Kopie aus der Datenbank
 * (Mailchimp-Newsletter, 7 Bilder, davon ein 1×1-Zählpixel). Fehlt sie, wird
 * die Probe übersprungen statt rot zu werden.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { sanitizeMailHtml } from '@/lib/sanitizeMailHtml';
import { aufDunkelUmstellen } from '@/components/mail/mailDunkel';
import { renderMailRahmen } from '@/components/mail/mailRahmen';

const ROH = join(
    '/private/tmp/claude-501/-Users-xaaronvx-Desktop--Partsunion-Archiv',
    '09f30f20-5440-4441-9ec1-3144a1af5a16/scratchpad/mail-roh.html',
);
const AUSGABE = join(process.cwd(), 'dist-probe');

const vorhanden = existsSync(ROH);

describe.skipIf(!vorhanden)('echte Mail durch die Kette', () => {
    const roh = vorhanden ? readFileSync(ROH, 'utf8') : '';

    /**
     * 1x1/2x2-Bilder im Eingang — die duerfen im Ausgang fehlen. Die
     * Winzigkeit kann als Attribut (width="1") ODER im style
     * (width:1px;height:1px) erklaert sein; Facebook/Instagram nutzen nur
     * das style-Attribut, und genau so ueberlebte ihr Oeffnungs-Tracker
     * (email_open_log_pic.php) die Entfernung.
     */
    function istZaehlpixelTag(tag: string): boolean {
        if (/\b(?:width|height)="[12]"/i.test(tag)) return true;
        const stil = /\bstyle="([^"]*)"/i.exec(tag)?.[1] ?? '';
        return /(?:^|;)\s*width\s*:\s*[12](?:\.\d+)?px/i.test(stil)
            && /(?:^|;)\s*height\s*:\s*[12](?:\.\d+)?px/i.test(stil);
    }

    function zaehlpixelImRoh(): number {
        return (roh.match(/<img\b[^>]*>/gi) ?? []).filter(istZaehlpixelTag).length;
    }

    function kette() {
        const sauber = sanitizeMailHtml(roh);
        return aufDunkelUmstellen(sauber);
    }

    it('schreibt die Mail nach dist-probe/', () => {
        mkdirSync(AUSGABE, { recursive: true });
        const doc = renderMailRahmen({
            betreff: 'Sind Sie auf der Automechanika Frankfurt 2026 dabei?',
            vorschautext: '',
            kategorieLabel: 'NEWSLETTER',
            kategorieFarbe: '#5B8CFF',
            absenderName: 'YQ Service s.r.o.',
            absenderAdresse: 'news@yqservice.eu',
            absenderInitialen: 'YS',
            empfangenAm: '30.07.2026, 02:14',
            chips: ['info@partsunion.de'],
            inhaltHtml: kette(),
            anhaenge: [],
            zeigeMarkenleiste: true,
            fusszeileHerkunft: 'Eingegangen über Partsunion Mail',
            aussenHintergrund: null,
            dunkel: true,
            volleBreite: true,
        });
        writeFileSync(
            join(AUSGABE, 'mail.html'),
            `<!doctype html><html lang="de"><head><meta charset="utf-8">`
            + `<title>Mail — echte Nachricht</title></head>`
            + `<body style="margin:0;background:#08090C">${doc}</body></html>`,
            'utf8',
        );
    });

    /**
     * ─── Regeln statt Exemplare ───────────────────────────────────────────
     *
     * Hier standen feste Zeichenketten aus EINER Beispielmail
     * ("mcusercontent.com", "newstracking.yqservice.eu"). Das las sich
     * konkret, prüfte aber nur, dass genau jene Nachricht durchläuft. Als ich
     * die Probe auf eine andere echte Mail umgestellt habe, wurde der Test rot
     * — obwohl der Code stimmte.
     *
     * Ein Test, der an einer Beispieldatei klebt, meldet Aenderungen der
     * DATEI, nicht des Verhaltens. Die Regeln unten gelten fuer jede Mail.
     */
    it('ersetzt kein Inhaltsbild durch einen Platzhalter', () => {
        expect(
            kette(),
            'data-original-src stammt aus der alten Klick-erst-Loesung',
        ).not.toContain('data-original-src');
    });

    it('reicht die Bilder mit ihrer eigenen Adresse durch', () => {
        const eingang = (roh.match(/<img\b[^>]*\bsrc="https?:\/\/[^"]+"/gi) ?? []).length;
        const ausgang = (kette().match(/<img\b[^>]*\bsrc="https?:\/\/[^"]+"/gi) ?? []).length;
        // Zaehlpixel duerfen fehlen, sonst nichts. Groesser als der Eingang
        // waere ebenfalls falsch (dann fuegen wir selbst welche hinzu).
        expect(ausgang, 'Bilder gehen verloren').toBeLessThanOrEqual(eingang);
        expect(ausgang, 'es duerfen keine dazukommen').toBeGreaterThanOrEqual(
            eingang - zaehlpixelImRoh(),
        );
    });

    it('entfernt die Zählpixel', () => {
        /**
         * Ein Zaehlpixel ist ein 1x1-Bild von fremdem Server. Es traegt keinen
         * Inhalt; sein einziger Zweck ist die Lesebestaetigung.
         */
        const ausgang = kette();
        const uebrig = (ausgang.match(/<img\b[^>]*>/gi) ?? []).filter(istZaehlpixelTag).length;
        expect(uebrig, 'ein 1x1-Bild ist im Ausgang geblieben').toBe(0);
    });
});
