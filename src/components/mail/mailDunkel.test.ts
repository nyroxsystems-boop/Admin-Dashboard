/**
 * Umstellung fremder E-Mail-HTML auf ein dunkles Erscheinungsbild.
 *
 * Die eine Regel, an der alles hängt: NUR ÄNDERN, WAS IM DUNKELN NICHT MEHR
 * FUNKTIONIERT. Wer alle Farben umkehrt, macht aus einem eigenen dunklen
 * Kopfbereich einen hellen Balken und aus weisser Schrift auf blauem Knopf
 * schwarze Schrift auf blauem Knopf.
 *
 * Der teuerste Fehler wäre der stille: dunkle Schrift, die auf dunklem Grund
 * stehen bleibt. Die Mail sieht dann nicht kaputt aus — sie ist einfach leer.
 */
import { describe, expect, it } from 'vitest';

import { aufDunkelUmstellen, farbeLesen, farbeUmkehren, stilUmkehren } from './mailDunkel';

/** HSL-Helligkeit einer Hex-Farbe, für Vergleiche in den Tests. */
function helligkeit(hex: string): number {
    const h = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

describe('Farben lesen', () => {
    it.each([
        ['#fff', { r: 255, g: 255, b: 255 }],
        ['#ffffff', { r: 255, g: 255, b: 255 }],
        ['#1B6FE3', { r: 27, g: 111, b: 227 }],
        ['rgb(10, 20, 30)', { r: 10, g: 20, b: 30 }],
        ['white', { r: 255, g: 255, b: 255 }],
    ])('%s', (eingabe, erwartet) => {
        expect(farbeLesen(eingabe)).toMatchObject(erwartet);
    });

    it('gibt bei unbrauchbaren Werten null zurueck, statt zu raten', () => {
        expect(farbeLesen('transparent')).toBeNull();
        expect(farbeLesen('inherit')).toBeNull();
        expect(farbeLesen('irgendwas')).toBeNull();
        expect(farbeLesen('')).toBeNull();
    });
});

describe('Hintergruende', () => {
    it('macht helle Hintergruende dunkel', () => {
        const neu = farbeUmkehren('#ffffff', 'hintergrund');
        expect(neu).not.toBeNull();
        expect(helligkeit(neu as string)).toBeLessThan(0.25);
    });

    it('LAESST dunkle Hintergruende in Ruhe', () => {
        // Der eigene Kopfbereich unserer Benachrichtigungen ist #020617.
        // Wuerde er umgekehrt, staende dort ein heller Balken.
        expect(farbeUmkehren('#020617', 'hintergrund')).toBeNull();
        expect(farbeUmkehren('#0E1524', 'hintergrund')).toBeNull();
    });

    it('behaelt den Farbton', () => {
        // Ein blaues Feld bleibt blau, nur dunkler.
        const neu = farbeUmkehren('#DBEAFE', 'hintergrund') as string;
        const [r, , b] = [1, 3, 5].map((i) => parseInt(neu.slice(i, i + 2), 16));
        expect(b).toBeGreaterThan(r);
    });
});

describe('Schriftfarben', () => {
    it('macht dunkle Schrift hell — sonst waere sie unlesbar', () => {
        const neu = farbeUmkehren('#0F172A', 'text');
        expect(neu).not.toBeNull();
        expect(helligkeit(neu as string)).toBeGreaterThan(0.55);
    });

    it('LAESST helle Schrift in Ruhe', () => {
        // Weisse Schrift steht meist auf einem eigenen Farbgrund (Knopf).
        // Sie umzukehren machte sie dort unlesbar.
        expect(farbeUmkehren('#FFFFFF', 'text')).toBeNull();
        expect(farbeUmkehren('#E9EDF1', 'text')).toBeNull();
    });

    it('geht nicht bis reinweiss — das flimmert', () => {
        const neu = farbeUmkehren('#000000', 'text') as string;
        expect(helligkeit(neu)).toBeLessThan(0.95);
    });
});

describe('style-Werte', () => {
    it('kehrt Hintergrund und Schrift in einem Zug um', () => {
        const neu = stilUmkehren('background: #ffffff; color: #111111; padding: 8px');
        expect(neu).toContain('padding: 8px');
        expect(neu).not.toContain('#ffffff');
        expect(neu).not.toContain('#111111');
    });

    it('fasst andere Eigenschaften nicht an', () => {
        const stil = 'padding: 12px; font-size: 15px; border-radius: 6px';
        expect(stilUmkehren(stil)).toBe(stil);
    });

    it('laesst Hintergrundbilder und Verlaeufe unangetastet', () => {
        // `background` kann mehr als eine Farbe enthalten. Halb umgeschrieben
        // waere das Ergebnis kaputt.
        const stil = 'background: url(https://x.de/a.png) no-repeat';
        expect(stilUmkehren(stil)).toBe(stil);
    });

    it('kommt mit Grossschreibung und Leerraum zurecht', () => {
        expect(stilUmkehren('COLOR :  #000000')).toContain('#');
        expect(stilUmkehren('COLOR :  #000000')).not.toContain('#000000');
    });

    it('rechnet erzwungene Newsletter-Farben um und behaelt important', () => {
        const neu = stilUmkehren(
            'background:#F8F9FA!important;color:#111111 !important;width:100%',
        );
        expect(neu.toLowerCase()).not.toContain('#f8f9fa');
        expect(neu.toLowerCase()).not.toContain('#111111');
        expect(neu.match(/!important/gi)).toHaveLength(2);
        expect(neu).toContain('width:100%');
    });
});

describe('ganze Mails', () => {
    it('stellt Tabellenzellen um', () => {
        const h = aufDunkelUmstellen('<table><tr><td style="background:#ffffff;color:#222">Text</td></tr></table>');
        expect(h).not.toContain('#ffffff');
        expect(h).toContain('Text');
    });

    it('beruecksichtigt das alte bgcolor-Attribut', () => {
        const h = aufDunkelUmstellen('<td bgcolor="#FFFFFF">x</td>');
        expect(h.toLowerCase()).not.toContain('bgcolor="#ffffff"');
    });

    it('beruecksichtigt font color', () => {
        const h = aufDunkelUmstellen('<font color="#000000">x</font>');
        expect(h.toLowerCase()).not.toContain('color="#000000"');
    });

    it('macht eine flache schwarze Wortmarke im Dunkelmodus hell', () => {
        const h = aufDunkelUmstellen(
            '<img style="width:300px; height:57px" src="data:image/png;base64,abc">',
        );
        expect(h).toContain('filter: invert(1)');
        expect(h).not.toContain('mix-blend-mode');
    });

    it('veraendert Fotos, Banner und kleine Icons nicht', () => {
        const h = aufDunkelUmstellen(`
            <img width="600" height="240" src="foto.jpg">
            <img width="600" height="160" src="banner.jpg">
            <img width="72" height="45" src="icon.png">
        `);
        expect(h).not.toContain('filter:');
    });

    it('laesst eine Mail ohne Farbangaben unveraendert', () => {
        const h = '<p>Guten Tag, wir suchen Bremsscheiben.</p>';
        expect(aufDunkelUmstellen(h)).toBe(h);
    });

    it('kommt mit leerer Eingabe zurecht', () => {
        expect(aufDunkelUmstellen('')).toBe('');
    });
});

describe('der teuerste Fehler', () => {
    it('laesst KEINE dunkle Schrift auf dunklem Grund stehen', () => {
        // Newsletter setzen oft Textfarbe OHNE Hintergrund. Bliebe sie dunkel,
        // waere die Mail auf unserem dunklen Untergrund einfach leer — und das
        // faellt niemandem als Fehler auf.
        const dunkleSchriften = ['#000000', '#111111', '#1a1a1a', '#2A3441', '#0F172A', '#333'];
        for (const farbe of dunkleSchriften) {
            const neu = farbeUmkehren(farbe, 'text');
            expect(neu, `${farbe} muss aufgehellt werden`).not.toBeNull();
            expect(helligkeit(neu as string)).toBeGreaterThan(0.55);
        }
    });
});
