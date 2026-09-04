/**
 * Jede Ansicht der Seitenleiste wird auch vorgewärmt — die BÜNDEL.
 *
 * Nicht zu verwechseln mit src/test/vorwaermenVollstaendig.test.ts: der prüft,
 * dass die DATEN der Übersicht vorgewärmt werden (react-query). Hier geht es
 * um den Code, also darum, dass beim Klick nicht erst ein Download anläuft.
 * Beides zusammen heisst: weder das Bündel noch die Antwort ist noch offen.
 *
 * ─── Warum das leicht auseinanderläuft ─────────────────────────────────────
 *
 * Wer eine neue Ansicht hinzufügt, denkt an drei Dinge: die `lazy(...)`-Zeile,
 * den Weg in adminRoutes.tsx und den Punkt in der Seitenleiste. An die Liste
 * in vorwaermen.ts denkt niemand — sie ist die vierte Stelle.
 *
 * Die Folge wäre der unangenehmste Fehler: genau diese eine Ansicht ist
 * langsam, alle anderen sind sofort da. Das sieht nach Zufall aus und wird
 * deshalb nicht gemeldet, sondern hingenommen.
 *
 * Der Test vergleicht die Navigation gegen die Vorwärmliste. Er prüft die
 * Quelle, nicht das Verhalten — er soll ja bei einer Ansicht anschlagen, die
 * es heute noch gar nicht gibt.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const VORWAERMEN = readFileSync('src/routes/vorwaermen.ts', 'utf8');
const ROUTEN = readFileSync('src/routes/adminRoutes.tsx', 'utf8');
const SEITENLEISTE = readFileSync('src/components/layout/AdminSidebar.tsx', 'utf8');
const HUELLE = readFileSync('src/components/layout/AdminLayout.tsx', 'utf8');

/** Adressen aus NAV_SECTIONS — das, was in der Seitenleiste steht. */
function navigationsWege(): string[] {
    const start = SEITENLEISTE.indexOf('const NAV_SECTIONS');
    const roh = SEITENLEISTE.slice(start, SEITENLEISTE.indexOf('\n];', start));
    return [...roh.matchAll(/\{\s*to:\s*'([^']+)'/g)].map((t) => t[1]);
}

/** Pfade aus den `import('@/views/…')`-Aufrufen von vorwaermen.ts. */
function vorgewaermt(): string[] {
    return [...VORWAERMEN.matchAll(/import\('@\/views\/([\w/]+)'\)/g)].map((t) => t[1]);
}

/** Weg → Modulpfad, wie in adminRoutes.tsx verdrahtet. */
function modulFuerWeg(weg: string): string | undefined {
    // Den Bauteilnamen am Weg finden, dann dessen lazy-Zeile.
    const teil = weg === '/' ? 'index' : weg.replace(/^\//, '');
    const muster = weg === '/'
        ? /<Route\s+index[^>]*element=\{<(\w+)/
        : new RegExp(`path="${teil}"[^>]*element=\\{<(\\w+)`);
    const treffer = ROUTEN.match(muster);
    if (!treffer) return undefined;
    const lazyZeile = ROUTEN.match(
        new RegExp(`const ${treffer[1]} = lazy\\(\\(\\) => import\\('@/views/([\\w/]+)'\\)`));
    return lazyZeile?.[1];
}

describe('Vorwärmen im Admin-Dashboard', () => {
    it('findet ueberhaupt Navigationspunkte (sonst prueft der Test nichts)', () => {
        expect(navigationsWege().length).toBeGreaterThanOrEqual(8);
    });

    it('findet ueberhaupt vorgewaermte Ansichten', () => {
        expect(vorgewaermt().length).toBeGreaterThanOrEqual(8);
    });

    it('jeder Punkt der Seitenleiste ist vorgewaermt', () => {
        const fehlen: string[] = [];
        for (const weg of navigationsWege()) {
            const modul = modulFuerWeg(weg);
            // Wege ohne eigene Ansicht (Unterseiten der Einstellungen, externe
            // Ziele) sind hier nicht zu holen — nur was adminRoutes kennt.
            if (!modul) continue;
            if (!vorgewaermt().includes(modul)) fehlen.push(`${weg} (${modul})`);
        }
        expect(
            fehlen,
            `nicht vorgewaermt: ${fehlen.join(', ')} — der erste Klick darauf `
            + 'wartet auf einen Download, waehrend alle anderen sofort da sind',
        ).toEqual([]);
    });

    it('waermt nichts vor, das es nicht mehr gibt', () => {
        for (const modul of vorgewaermt()) {
            expect(ROUTEN, `${modul} ist keine Ansicht mehr`).toContain(`@/views/${modul}`);
        }
    });

    it('laeuft im Leerlauf und nicht sofort', () => {
        // Sofort geholt, konkurriert es mit dem, was gerade entsteht.
        expect(VORWAERMEN).toContain('requestIdleCallback');
        // Safari kennt requestIdleCallback bis heute nicht.
        expect(VORWAERMEN).toContain('setTimeout');
    });

    it('wird von der Huelle auch aufgerufen — genau einmal', () => {
        expect(HUELLE).toContain('ansichtenVorwaermen()');
        // Leeres Abhaengigkeitsfeld: sonst laeuft es bei jedem Wegwechsel
        // erneut und stellt bei jedem Klick neue Anfragen in die Schlange.
        expect(HUELLE).toMatch(/ansichtenVorwaermen\(\);\s*\},\s*\[\]\)/);
    });
});
