/**
 * Im Suchfeld steht nur, was man im Betrieb auch anklicken soll.
 *
 * ─── Was hier schiefging ───────────────────────────────────────────────────
 *
 * Die Kommandopalette bot Bot-Test-Lab, E2E-Flow-Runner und Live-Simulation
 * an. Das sind Werkzeuge zum Bauen, keine Arbeitsmittel — nachgesehen: sie
 * waren aus NULL anderen Stellen der Anwendung verlinkt, die Palette war ihr
 * einziger Zugang. Dadurch standen sie im Suchfeld gleichwertig neben "Kunden"
 * und "Kalender", und "E2E-Flow-Runner" war sogar der erste Eintrag beim
 * Öffnen.
 *
 * Eine Suche zeigt, was man tun KANN. Steht dort etwas, das man nie anklicken
 * soll, ist entweder der Eintrag falsch oder die Suche.
 *
 * ─── Warum ein Test und kein Kommentar ─────────────────────────────────────
 *
 * Weil der Rückweg so bequem ist: wer an einem Werkzeug arbeitet, will es
 * schnell erreichen und trägt es "kurz" in die Palette ein. Im
 * Entwicklungsbau ist das genau richtig — dieser Test verlangt nur, dass es
 * dort BLEIBT und nicht mit ausgeliefert wird.
 *
 * Das Gegenstück steht im CRM (src/test/paletteVollstaendig.test.ts): dort
 * fehlte umgekehrt eine echte Ansicht im Suchfeld.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PALETTE = readFileSync(
    join(process.cwd(), 'src/components/layout/CommandPalette.tsx'), 'utf8',
);

/** Ohne Kommentare — sonst meldet der Test seine eigene Begründung. */
const QUELLE = PALETTE
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** Pfade, die nur Werkzeuge zum Bauen bedienen. */
const WERKZEUG_PFADE = ['/bot/testing', '/testing/e2e-runner', '/testing/live-sim', '/design-system'];

describe('Kommandopalette', () => {
    it('bietet Entwicklerwerkzeuge nur im Entwicklungsbau an', () => {
        /**
         * Geprüft wird nicht, DASS sie vorkommen, sondern dass jedes Vorkommen
         * hinter `import.meta.env.DEV` steht. Der Block wird dafür
         * herausgeschnitten und der Rest durchsucht.
         */
        const ohneDevBlock = QUELLE.replace(
            /\.\.\.\(import\.meta\.env\.DEV[\s\S]*?:\s*\[\]\),/g,
            '',
        );

        const ausgeliefert = WERKZEUG_PFADE.filter((p) => ohneDevBlock.includes(`'${p}'`));

        expect(
            ausgeliefert,
            'Diese Werkzeuge stehen im Suchfeld des PRODUKTIONSBAUS. Setze sie in '
            + 'den `import.meta.env.DEV`-Block — die Routen bleiben davon unberührt '
            + 'und über die Adresszeile weiter erreichbar.',
        ).toEqual([]);
    });

    it('jeder Werkzeug-Pfad ist ueberhaupt noch im DEV-Block vorhanden', () => {
        // Verhindert die stille Gegenrichtung: jemand entfernt sie ganz, und
        // beim nächsten Fehlersuchen fehlt das Werkzeug, ohne dass jemand weiss,
        // wohin es verschwunden ist.
        for (const p of ['/bot/testing', '/testing/e2e-runner', '/testing/live-sim']) {
            expect(QUELLE, `${p} fehlt inzwischen ganz`).toContain(`'${p}'`);
        }
    });

    it('beschriftet auf Deutsch', () => {
        /**
         * "Orders" stand als einziger Eintrag auf Englisch in einer deutschen
         * Oberfläche — und war damit über "Bestellungen" nicht auffindbar,
         * obwohl die Seite aus zwölf Stellen der Anwendung verlinkt ist.
         */
        expect(QUELLE).toContain("'Bestellungen'");
        expect(QUELLE, 'die englische Beschriftung ist als Suchwort in Ordnung, als Titel nicht')
            .not.toMatch(/nav\('\/orders',\s*'Orders'/);
    });
});
