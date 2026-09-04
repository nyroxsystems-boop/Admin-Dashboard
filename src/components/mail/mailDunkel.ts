/**
 * Rechnet fremde E-Mail-HTML auf ein dunkles Erscheinungsbild um.
 *
 * ─── Warum das nicht einfach "Hintergrund dunkel setzen" ist ───────────────
 *
 * Newsletter setzen ihre Farben INLINE und unvollständig: mal einen weissen
 * Hintergrund ohne Textfarbe, mal dunklen Text ohne Hintergrund, mal beides,
 * mal nichts. Wer nur den äusseren Hintergrund dunkel macht, bekommt genau
 * die Mails unlesbar, die dunklen Text gesetzt haben — schwarz auf schwarz.
 *
 * Deshalb wird JEDE gesetzte Farbe einzeln betrachtet und nur dann geändert,
 * wenn sie im Dunkeln nicht mehr funktioniert:
 *
 *   Hintergrund HELL   → wird dunkel. (Weisse Karte auf dunkler Oberfläche.)
 *   Hintergrund DUNKEL → bleibt.      (Eigener dunkler Kopfbereich etwa.)
 *   Schrift DUNKEL     → wird hell.   (Sonst unlesbar.)
 *   Schrift HELL       → bleibt.      (Steht meist auf eigenem Farbgrund.)
 *
 * Farbton und Sättigung bleiben erhalten, nur die Helligkeit kippt. Ein blauer
 * Knopf bleibt blau, ein rotes Warnfeld rot — sie werden nur so hell oder
 * dunkel, wie es der Untergrund verlangt.
 *
 * Transparente, flache Signatur-Logos brauchen eine Sonderbehandlung: ihre
 * schwarze Wortmarke ist Teil der Bildpixel und reagiert deshalb nicht auf
 * `color`. Solche eindeutig logofoermigen Bilder werden im Dunkelmodus
 * monochrom hell dargestellt. Fotos, Banner und kleine Icons bleiben bewusst
 * unangetastet.
 */

/** Helligkeitsgrenze, ab der eine Farbe als "hell" gilt (HSL-L in 0..1). */
const HELL_AB = 0.5;

/** Zielbereich für umgekehrte Hintergründe. Nicht ganz schwarz — sonst
 *  verschwinden Ränder und Abstufungen. */
const BG_MIN = 0.06;
const BG_MAX = 0.20;

/** Zielbereich für umgekehrte Schrift. Nicht reinweiss — das flimmert. */
const TEXT_MIN = 0.62;
const TEXT_MAX = 0.92;

interface Rgb { r: number; g: number; b: number; a: number }

const NAMEN: Record<string, string> = {
    white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000',
    blue: '#0000ff', gray: '#808080', grey: '#808080', silver: '#c0c0c0',
    navy: '#000080', teal: '#008080', olive: '#808000', maroon: '#800000',
    purple: '#800080', yellow: '#ffff00', lime: '#00ff00', aqua: '#00ffff',
    fuchsia: '#ff00ff',
};

export function farbeLesen(wert: string): Rgb | null {
    const v = wert.trim().toLowerCase();
    if (!v || v === 'transparent' || v === 'inherit' || v === 'currentcolor') return null;

    const benannt = NAMEN[v];
    const hex = (benannt || v).match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
        const h = hex[1];
        const voll = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
        return {
            r: parseInt(voll.slice(0, 2), 16),
            g: parseInt(voll.slice(2, 4), 16),
            b: parseInt(voll.slice(4, 6), 16),
            a: 1,
        };
    }

    const fn = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
    if (fn) {
        const a = fn[4] === undefined ? 1
            : fn[4].endsWith('%') ? parseFloat(fn[4]) / 100 : parseFloat(fn[4]);
        return { r: +fn[1], g: +fn[2], b: +fn[3], a };
    }
    return null;
}

function rgbZuHsl({ r, g, b }: Rgb): [number, number, number] {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
    else if (max === G) h = ((B - R) / d + 2) / 6;
    else h = ((R - G) / d + 4) / 6;
    return [h, s, l];
}

function hslZuHex(h: number, s: number, l: number): string {
    const f = (n: number) => {
        const k = (n + h * 12) % 12;
        const a = s * Math.min(l, 1 - l);
        const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
        return Math.round(v * 255);
    };
    const [r, g, b] = [f(0), f(8), f(4)];
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function spanne(wert: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, wert));
}

/**
 * Kehrt eine Farbe um — aber nur, wenn sie im Dunkeln nicht mehr funktioniert.
 *
 * Gibt `null` zurück, wenn die Farbe bleiben soll. Das ist die häufigste und
 * wichtigste Antwort: Was schon passt, wird nicht angefasst.
 */
export function farbeUmkehren(wert: string, art: 'text' | 'hintergrund'): string | null {
    const rgb = farbeLesen(wert);
    if (!rgb) return null;
    // Fast durchsichtige Flächen liegen ohnehin auf dem Untergrund.
    if (rgb.a < 0.1) return null;

    const [h, s, l] = rgbZuHsl(rgb);

    if (art === 'hintergrund') {
        if (l < HELL_AB) return null;                   // schon dunkel — bleibt
        return hslZuHex(h, s, spanne(1 - l, BG_MIN, BG_MAX));
    }
    if (l >= HELL_AB) return null;                      // schon hell — bleibt
    return hslZuHex(h, s, spanne(1 - l, TEXT_MIN, TEXT_MAX));
}

/** Eigenschaften, die als Hintergrund zählen. */
const HINTERGRUND = ['background-color', 'background'];

/** Wandelt einen `style`-Wert um. Gibt den unveränderten zurück, wenn nichts zu tun ist. */
export function stilUmkehren(stil: string): string {
    return stil.replace(
        /(^|;)\s*([a-z-]+)\s*:\s*([^;]+)/gi,
        (ganz, trenner: string, name: string, wert: string) => {
            const n = name.trim().toLowerCase();
            const w = wert.trim();
            const wichtig = /\s*!important\s*$/i.test(w);
            const farbwert = w.replace(/\s*!important\s*$/i, '').trim();
            const wichtigSuffix = wichtig ? ' !important' : '';

            if (n === 'color' || n === 'border-color') {
                const neu = farbeUmkehren(farbwert, 'text');
                return neu ? `${trenner}${name}: ${neu}${wichtigSuffix}` : ganz;
            }
            if (HINTERGRUND.includes(n)) {
                // `background` kann mehr als eine Farbe enthalten (Bilder,
                // Verläufe). Nur der reine Farbfall wird angefasst — alles
                // andere bliebe sonst kaputt.
                const neu = farbeLesen(farbwert) ? farbeUmkehren(farbwert, 'hintergrund') : null;
                return neu ? `${trenner}${name}: ${neu}${wichtigSuffix}` : ganz;
            }
            return ganz;
        },
    );
}

/**
 * Stellt eine ganze E-Mail auf dunkel um.
 *
 * Erwartet BEREITS BEREINIGTES HTML — diese Funktion prüft nichts nach, sie
 * färbt nur um.
 */
export function aufDunkelUmstellen(html: string): string {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');

    for (const el of Array.from(doc.querySelectorAll<HTMLElement>('[style]'))) {
        const alt = el.getAttribute('style') || '';
        const neu = stilUmkehren(alt);
        if (neu !== alt) el.setAttribute('style', neu);
    }

    // Alte Mails nutzen Attribute statt CSS.
    for (const el of Array.from(doc.querySelectorAll('[bgcolor]'))) {
        const neu = farbeUmkehren(el.getAttribute('bgcolor') || '', 'hintergrund');
        if (neu) el.setAttribute('bgcolor', neu);
    }
    for (const el of Array.from(doc.querySelectorAll('font[color]'))) {
        const neu = farbeUmkehren(el.getAttribute('color') || '', 'text');
        if (neu) el.setAttribute('color', neu);
    }

    /**
     * Schwarze Wortmarken in Signaturen sind haeufig transparente PNGs. Auf
     * dem dunklen Mailgrund verschwinden sie vollstaendig, obwohl der uebrige
     * Text korrekt aufgehellt wurde. Das YQ-Service-Logo, an dem der Fehler
     * sichtbar wurde, ist beispielsweise 300 x 57 px.
     *
     * Die Form ist absichtlich streng: mindestens 120 px breit, hoechstens
     * 120 px hoch und mindestens dreimal so breit wie hoch. Damit treffen wir
     * typische Wortmarken, nicht Produktbilder, Anzeigen oder quadratische
     * Verbandslogos. Bei fehlenden Massen raten wir nicht.
     */
    for (const bild of Array.from(doc.querySelectorAll<HTMLImageElement>('img'))) {
        const stil = bild.getAttribute('style') || '';
        const breiteImStil = stil.match(/(?:^|;)\s*width\s*:\s*([\d.]+)px/i)?.[1];
        const hoeheImStil = stil.match(/(?:^|;)\s*height\s*:\s*([\d.]+)px/i)?.[1];
        const breite = Number(bild.getAttribute('width') || breiteImStil || 0);
        const hoehe = Number(bild.getAttribute('height') || hoeheImStil || 0);

        if (breite >= 120 && hoehe > 0 && hoehe <= 120 && breite / hoehe >= 3) {
            // Reines Invertieren funktioniert fuer beide gaengigen Varianten:
            // Schwarz auf transparent wird weiss auf transparent; Schwarz auf
            // festem Weiss wird weiss auf dunklem Hintergrund.
            bild.style.filter = 'invert(1)';
            bild.style.removeProperty('mix-blend-mode');
        }
    }

    return doc.body.innerHTML;
}
