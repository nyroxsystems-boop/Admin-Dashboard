/**
 * Die Rückweg-Messung: Marke und Auswertung gehören zusammen.
 *
 * Der Startpunkt liegt im Mailprogramm (Klick auf "Dashboard"), die
 * Auswertung in der Übersicht. Die beiden finden sich über den NAMEN der
 * Performance-Marke — ein Tippfehler auf einer Seite, und die Messung
 * schweigt einfach, ohne dass irgendetwas bricht. Nach drei Fehlerrunden
 * voller Raterei ist diese Messung das Werkzeug, das Raten beendet; sie darf
 * nicht still kaputtgehen.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MARKE = "'dashboard-klick'";

describe('Rückweg-Messung', () => {
    it('Mailprogramm setzt die Marke, Übersicht wertet sie aus', () => {
        expect(
            readFileSync('src/components/layout/MailLayout.tsx', 'utf8'),
            'der Klick auf Dashboard muss die Marke setzen — mit der '
            + 'HARDWARE-Zeit des Klicks als Start, sonst uebersieht die '
            + 'Messung einen blockierten Hauptthread (so geschehen: Nutzer '
            + 'erlebte Sekunden, Konsole meldete 39 ms)',
        ).toContain(`performance.mark(${MARKE}, { startTime: klick })`);

        const uebersicht = readFileSync('src/views/dashboard/OverviewView.tsx', 'utf8');
        expect(uebersicht).toContain(`getEntriesByName(${MARKE}, 'mark')`);
        expect(uebersicht, 'verbrauchte Marken muessen geloescht werden').toContain(`clearMarks(${MARKE})`);
    });

    it('meldet über console.warn, nicht console.info', () => {
        /**
         * Der Produktionsbau entfernt console.info (pure-Liste in
         * vite.config). Eine Messung, die im Produktionsbau verschwindet,
         * misst genau dort nicht, wo das Problem auftritt — so geschehen bei
         * der ersten Probemessung.
         */
        const uebersicht = readFileSync('src/views/dashboard/OverviewView.tsx', 'utf8');
        expect(uebersicht).toMatch(/console\.warn\(\s*\n?\s*`\[Messung\]/);
    });
});
