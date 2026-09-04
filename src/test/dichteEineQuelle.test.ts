/**
 * Die Dichte der Oberfläche kommt aus dichte.ts — und nur von dort.
 *
 * ─── Warum das ein Test ist ────────────────────────────────────────────────
 *
 * Die Kachelhöhen standen an drei Orten mit drei verschiedenen Zahlen: 152 px
 * in den Kennzahlen, 148 px in der Onboarding-Übersicht, 168 px bei den
 * Zugängen. Ein Unterschied war nie beabsichtigt — er ist entstanden, weil
 * jede Ansicht ihre eigene Zahl bekam.
 *
 * Beim Auftrag „mach alles kompakter" fällt so etwas nicht auf: man dreht drei
 * Zahlen, übersieht die vierte, und die Ansicht mit der übersehenen Zahl sieht
 * danach falsch aus, ohne dass irgendwo ein Fehler entsteht. Genau so ist die
 * vorige Runde ausgegangen.
 *
 * Dieser Test verbietet deshalb eigene Werte in den Ansichten. Er prüft
 * bewusst den ORT und nicht die Zahl: wie kompakt es sein soll, entscheidet
 * der Nutzer, aber es soll an einer Stelle entschieden werden.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const QUELLE = 'src/components/ui/dichte.ts';

function alleAnsichten(verzeichnis = 'src'): string[] {
    const gefunden: string[] = [];
    for (const eintrag of readdirSync(verzeichnis)) {
        const pfad = join(verzeichnis, eintrag);
        if (statSync(pfad).isDirectory()) {
            gefunden.push(...alleAnsichten(pfad));
        } else if (/\.tsx$/.test(eintrag) && !/\.test\.tsx$/.test(eintrag)) {
            gefunden.push(pfad);
        }
    }
    return gefunden;
}

/** Kommentare raus — sonst meldet der Test seine eigenen Beispiele. */
function ohneKommentare(quelle: string): string {
    return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Dichte kommt aus einer Quelle', () => {
    it('keine Ansicht setzt eine eigene Kachelhöhe', () => {
        /**
         * Gesucht sind Mindesthöhen im Bereich, in dem Kacheln liegen
         * (100–199 px). Ein `min-h-[520px]` fuer einen Lesebereich ist etwas
         * anderes und bleibt erlaubt.
         */
        const sünder: string[] = [];
        for (const datei of alleAnsichten()) {
            if (datei.endsWith('dichte.ts')) continue;
            const treffer = ohneKommentare(readFileSync(datei, 'utf8')).match(/min-h-\[1[0-9]{2}px\]/g);
            if (treffer) sünder.push(`${datei}: ${treffer.join(', ')}`);
        }
        expect(
            sünder,
            `eigene Kachelhoehe statt KACHEL aus ${QUELLE} — beim naechsten `
            + '"kompakter" bleibt genau diese Stelle stehen',
        ).toEqual([]);
    });

    it('kein Innenabstand von 22 px mehr', () => {
        // Der Wert aus der Entwurfsvorlage. Karten tragen jetzt KARTE_INNEN.
        const sünder = alleAnsichten().filter((d) =>
            ohneKommentare(readFileSync(d, 'utf8')).includes('p-[22px]'));
        expect(sünder, `p-[22px] statt KARTE_INNEN aus ${QUELLE}`).toEqual([]);
    });

    it('keine Ansicht setzt eine eigene Schriftgroesse fuer Zahl oder Titel', () => {
        /**
         * Die Ueberschrift stand an vier Orten in vier Groessen — 26-34 px im
         * Seitenkopf, 26-36 im Begruessungsbereich, 26-42 in der
         * CRM-Uebersicht, 22-28 in Outreach. Beim Wechsel zwischen zwei
         * Ansichten sprang sie, sichtbar aber schwer zu benennen. Dieselbe
         * Sorte Abweichung gab es bei den Kachelzahlen: 28-38 px in der
         * Onboarding-Uebersicht gegen 22-28 ueberall sonst.
         *
         * `clamp` in einer Ansicht ist deshalb ab jetzt verboten. Wer eine
         * neue Groesse braucht, gibt ihr in dichte.ts einen Namen — dann
         * sieht der Naechste, dass es sie schon gibt.
         */
        const suender: string[] = [];
        for (const datei of alleAnsichten()) {
            const treffer = ohneKommentare(readFileSync(datei, 'utf8')).match(/text-\[clamp\([^\]]+\]/g);
            if (treffer) suender.push(`${datei}: ${treffer.join(', ')}`);
        }
        expect(
            suender,
            `eigene Schriftgroesse statt eines Namens aus ${QUELLE}`,
        ).toEqual([]);
    });

    it('die Quelle bietet alles an, was die Ansichten brauchen', () => {
        const quelle = readFileSync(QUELLE, 'utf8');
        for (const name of ['KARTE_INNEN', 'KACHEL', 'KACHEL_ZAHL', 'HERO', 'HERO_TITEL', 'SEITEN_TITEL', 'KALENDER_ZELLE']) {
            expect(quelle, `${name} fehlt in ${QUELLE}`).toMatch(new RegExp(`export const ${name}\\b`));
        }
    });

    it('die Ansichten benutzen sie auch', () => {
        const paare: Array<[string, string]> = [
            ['src/views/dashboard/OverviewView.tsx', 'KACHEL'],
            ['src/views/onboarding/OnboardingPipelineView.tsx', 'KACHEL'],
            ['src/views/access/AccessRequestsView.tsx', 'KACHEL'],
            ['src/views/calendar/CalendarView.tsx', 'KALENDER_ZELLE'],
        ];
        for (const [datei, name] of paare) {
            expect(readFileSync(datei, 'utf8'), `${datei} benutzt ${name} nicht`).toContain(name);
        }
    });
});
