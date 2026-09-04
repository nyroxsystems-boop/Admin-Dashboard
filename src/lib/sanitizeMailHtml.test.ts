/**
 * Bereinigung fremder E-Mail-HTML.
 *
 * Jede Regel hier hat einen Angriff als Anlass. Der Inhalt stammt von
 * beliebigen Fremden und wird einem angemeldeten Admin gerendert — es gibt in
 * dieser Anwendung keine Fläche, an der ein Fehler teurer wäre.
 *
 * Besonders wichtig, solange Caddy die strenge Content-Security-Policy des
 * nginx überschreibt: dann ist diese Datei die einzige Schicht im Browser.
 */
import { describe, expect, it } from 'vitest';

import { sanitizeMailHtml } from './sanitizeMailHtml';

describe('Skripte und Ereignis-Attribute', () => {
    it('entfernt script-Elemente, behaelt den uebrigen Text', () => {
        const r = sanitizeMailHtml('<script>alert(1)</script><p>Guten Tag</p>');
        expect(r).not.toContain('script');
        expect(r).toContain('Guten Tag');
    });

    it('entfernt onclick', () => {
        expect(sanitizeMailHtml('<a href="#" onclick="alert(1)">x</a>')).not.toContain('onclick');
    });

    it('entfernt Bilder samt onerror', () => {
        const r = sanitizeMailHtml('<img src=x onerror=alert(1)>');
        expect(r).not.toContain('onerror');
    });

    it('entfernt iframe und object', () => {
        const r = sanitizeMailHtml('<iframe src="https://b.example"></iframe><object data="x"></object>');
        expect(r).not.toContain('iframe');
        expect(r).not.toContain('object');
    });

    it('entfernt base — sonst koennte eine Mail alle relativen Pfade umbiegen', () => {
        expect(sanitizeMailHtml('<base href="https://boese.example/">')).not.toContain('base');
    });
});

describe('gefaehrliche URI-Schemata', () => {
    it('entfernt javascript:', () => {
        expect(sanitizeMailHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
    });

    it('entfernt data: in Links', () => {
        expect(sanitizeMailHtml('<a href="data:text/html,x">x</a>')).not.toContain('data:');
    });
});

describe('Eingabefelder', () => {
    it('entfernt input — auch wenn kein form drumherum steht', () => {
        // form allein zu verbieten genuegt NICHT: die Felder bleiben sonst
        // stehen und ergeben ein taeuschend echtes Passwortfeld im Lesebereich.
        const r = sanitizeMailHtml('<form action="https://b.example"><input type="password" name="pw"></form>');
        expect(r).not.toContain('input');
        expect(r).not.toContain('form');
    });

    it('entfernt button, select und textarea', () => {
        const r = sanitizeMailHtml('<button>Jetzt anmelden</button><select><option>a</option></select><textarea></textarea>');
        expect(r).not.toContain('button');
        expect(r).not.toContain('select');
        expect(r).not.toContain('textarea');
    });
});

describe('Links', () => {
    it('oeffnet fremde Links in einem neuen Tab', () => {
        // Ohne das ersetzt die Zielseite das Postfach im selben Tab — in der
        // installierten App ohne sichtbare Adresszeile.
        const r = sanitizeMailHtml('<a href="https://fremd.example/rechnung">Rechnung ansehen</a>');
        expect(r).toContain('target="_blank"');
    });

    it('nimmt der Zielseite den Zugriff auf das Postfach-Fenster', () => {
        const r = sanitizeMailHtml('<a href="https://fremd.example">x</a>');
        expect(r).toContain('noopener');
        expect(r).toContain('noreferrer');
    });

    it('laesst reine Sprungmarken in Ruhe', () => {
        expect(sanitizeMailHtml('<a href="#unten">nach unten</a>')).not.toContain('target');
    });

    it('behaelt die Zieladresse unveraendert', () => {
        expect(sanitizeMailHtml('<a href="https://partsunion.de/x?a=1">x</a>'))
            .toContain('https://partsunion.de/x?a=1');
    });
});

describe('normale Post', () => {
    it('laesst uebliche Formatierung stehen', () => {
        const r = sanitizeMailHtml('<p><strong>Sehr geehrte Damen</strong><br>Text<ul><li>Punkt</li></ul></p>');
        expect(r).toContain('<strong>');
        expect(r).toContain('<li>');
    });

    it('kommt mit leerer und fehlender Eingabe zurecht', () => {
        expect(sanitizeMailHtml('')).toBe('');
        expect(sanitizeMailHtml(null)).toBe('');
        expect(sanitizeMailHtml(undefined)).toBe('');
    });
});

describe('Layout bleibt erhalten', () => {
    // Anlass: Die erste Fassung entfernte alle style-Attribute. Ein echter
    // Newsletter (Instagram: 50 Tabellen, 244 style-Attribute) zerfiel dadurch
    // zu einer senkrechten Linkliste mit leeren Kaestchen. Weil die Darstellung
    // jetzt in einem abgeschotteten Rahmen laeuft, darf die Gestaltung bleiben.

    it('behaelt style-Attribute', () => {
        const r = sanitizeMailHtml('<div style="padding:12px;margin:4px">Text</div>');
        expect(r).toContain('style=');
        expect(r).toContain('padding');
    });

    it('behaelt style-Attribute auch in Tabellenzellen', () => {
        // Hier vollstaendig notiert: ein <td> ohne <table> packt der Parser aus,
        // dann ist der Test ueber die Bereinigung gar keiner mehr.
        const r = sanitizeMailHtml('<table><tr><td style="padding:12px">x</td></tr></table>');
        expect(r).toContain('style="padding:12px"');
    });

    it('behaelt Tabellen samt Layout-Attributen', () => {
        const r = sanitizeMailHtml('<table cellpadding="0" cellspacing="0" width="600"><tr><td align="center">x</td></tr></table>');
        expect(r).toContain('<table');
        expect(r).toContain('cellpadding');
        expect(r).toContain('width="600"');
        expect(r).toContain('align="center"');
    });

    it('entfernt <style>-Bloecke — wie Gmail, und das ist verkraftbar', () => {
        // Nachgeprueft: DOMPurify entfernt <style> in JEDER Konfiguration, auch
        // mit ADD_TAGS. Festgehalten, damit niemand spaeter vergeblich sucht.
        // Das Layout eines Newsletters haengt ohnehin an den Inline-Stilen.
        const r = sanitizeMailHtml('<style>.a{color:red}</style><p>x</p>');
        expect(r).not.toContain('<style');
        expect(r).toContain('<p>x</p>');
    });

    it('entfernt Skripte — die Abschottung ist kein Freibrief', () => {
        const r = sanitizeMailHtml('<div style="padding:4px">x</div><script>alert(1)</script>');
        expect(r).toContain('style=');
        expect(r).not.toContain('<script');
    });
});

describe('Zählpixel', () => {
    it('entfernt ein 1x1-Bild mit fremder Adresse', () => {
        const r = sanitizeMailHtml(
            '<p>Text</p><img src="http://newstracking.example.com/q/abc" width="1" height="1" alt="">',
        );
        expect(r).toContain('Text');
        expect(r).not.toContain('newstracking.example.com');
        expect(r).not.toContain('<img');
    });

    it('entfernt es auch bei 2x2', () => {
        const r = sanitizeMailHtml('<img src="https://t.example.com/p" width="2" height="2">');
        expect(r).not.toContain('<img');
    });

    it('lässt ein ECHTES kleines Bild stehen', () => {
        // Ein 16x16-Symbol ist Inhalt, keine Wanze. Die Grenze liegt bei 2 px.
        const r = sanitizeMailHtml('<img src="https://cdn.example.com/icon.png" width="16" height="16">');
        expect(r).toContain('cdn.example.com/icon.png');
    });

    it('lässt ein Bild OHNE Massangaben stehen', () => {
        // Ohne Masse kann es echter Inhalt sein — dann wird nicht geraten.
        const r = sanitizeMailHtml('<img src="https://cdn.example.com/bild.png">');
        expect(r).toContain('cdn.example.com/bild.png');
    });

    it('lässt eingebettete Bilder (data:) unangetastet', () => {
        const winzig = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        const r = sanitizeMailHtml(`<img src="${winzig}" width="1" height="1">`);
        expect(r).toContain('data:image/gif');
    });
});

