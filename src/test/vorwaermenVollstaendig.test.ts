/**
 * Das Vorwärmen deckt ALLE Abfragen der Übersicht ab — und mit denselben
 * Schlüsseln.
 *
 * ─── Warum das ein Test ist und kein Kommentar ─────────────────────────────
 *
 * Beim Wechsel aus dem Mailprogramm zurück zur Übersicht wurde eine von vier
 * Abfragen vorgewärmt. Die anderen drei starteten erst nach dem Klick. Der
 * Fehler ist unsichtbar: es geht ja alles, nur eben nicht sofort.
 *
 * Genauso unsichtbar ist der zweite Fehler, den es hier geben kann — ein
 * Schlüssel, der um ein Zeichen abweicht. React Query erkennt einen
 * vorgewärmten Abruf ausschliesslich am Schlüssel. Steht im Vorwärmen
 * `['admin','dashboard','metrics']` und in der Ansicht `['admin','metrics']`,
 * wird brav etwas geholt, in eine Ablage gelegt, die niemand liest, und
 * danach alles noch einmal abgerufen. Nichts bricht, nichts warnt.
 *
 * Deshalb vergleicht dieser Test die Schlüssel BEIDER Seiten miteinander,
 * statt eine Liste zu prüfen, die jemand von Hand pflegen müsste.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Schlüssel der Form ['admin', 'x', 'y'] aus einer Datei einsammeln. */
function schluessel(datei: string): Set<string> {
    const quelle = readFileSync(datei, 'utf8');
    const treffer = quelle.matchAll(/queryKey:\s*(\[[^\]]*\])/g);
    return new Set([...treffer].map((m) => m[1].replace(/\s+/g, ' ').trim()));
}

const UEBERSICHT = 'src/views/dashboard/OverviewView.tsx';
const ZUSTAND = 'src/hooks/useSystemHealth.ts';
const KENNZAHLEN = 'src/hooks/useDashboardMetrics.ts';
const AUDIT = 'src/hooks/useAuditLogs.ts';
const MAILPROGRAMM = 'src/components/layout/MailLayout.tsx';

describe('Vorwärmen beim Rückweg aus dem Mailprogramm', () => {
    it('deckt jede Abfrage ab, die die Übersicht beim Aufbau stellt', () => {
        const gebraucht = new Set([
            ...schluessel(UEBERSICHT),
            ...schluessel(ZUSTAND),
            ...schluessel(KENNZAHLEN),
            /**
             * useAuditLogs kam hier NICHT vor — und genau deshalb konnte der
             * Test nicht sehen, dass die fuenfte Abfrage der Uebersicht nie
             * vorgewaermt wurde. "Letzte Aenderungen" zeigte beim Rueckweg
             * erst einen falschen Leerzustand. Ein Vollstaendigkeits-Test,
             * dessen Dateiliste unvollstaendig ist, prueft nur sich selbst.
             */
            ...schluessel(AUDIT),
        ]);
        const gewaermt = schluessel(MAILPROGRAMM);

        const fehlend = [...gebraucht].filter((k) => !gewaermt.has(k));
        expect(
            fehlend,
            'diese Abfragen starten erst NACH dem Klick — genau das war die '
            + 'Wartezeit beim Wechsel zurueck zur Uebersicht',
        ).toEqual([]);
    });

    it('wärmt nichts vor, das niemand liest', () => {
        /**
         * Die Gegenrichtung. Ein Schlüssel, der nur im Vorwärmen vorkommt,
         * ist entweder ein Tippfehler oder ein Rest — beides kostet einen
         * Abruf und bringt nichts.
         */
        const gebraucht = new Set([
            ...schluessel(UEBERSICHT),
            ...schluessel(ZUSTAND),
            ...schluessel(KENNZAHLEN),
            ...schluessel(AUDIT),
        ]);
        const ueberfluessig = [...schluessel(MAILPROGRAMM)].filter((k) => !gebraucht.has(k));
        expect(
            ueberfluessig,
            'wird vorgewaermt, aber von keiner Abfrage der Uebersicht gelesen',
        ).toEqual([]);
    });

    it('berechnet den Terminzeitraum nur an einer Stelle', () => {
        const uebersicht = readFileSync(UEBERSICHT, 'utf8');
        const mail = readFileSync(MAILPROGRAMM, 'utf8');
        for (const [name, quelle] of [['Übersicht', uebersicht], ['Mailprogramm', mail]] as const) {
            expect(quelle, `${name} muss terminfenster() benutzen`).toContain('terminfenster(');
            expect(
                quelle,
                `${name} rechnet den Zeitraum selbst aus — laufen die beiden `
                + 'auseinander, waermt das Mailprogramm einen Schluessel mit '
                + 'falschem Inhalt vor',
            ).not.toMatch(/setDate\(\s*\w+\.getDate\(\) - \(\(/);
        }
    });


    it('kein Hook des Rückwegs setzt ein eigenes gcTime', () => {
        /**
         * Die globale Ablagezeit (30 Minuten, App.tsx) wurde AUSDRÜCKLICH für
         * den Rückweg aus dem Mailprogramm gesetzt — der Kommentar dort sagt
         * es. Vier Hooks überschrieben sie trotzdem mit fünf Minuten: wer
         * länger Post las, bekam wieder Skelette. Der Fix in App.tsx sah aus,
         * als wirke er, und wirkte nicht — die gefährlichste Sorte Fix.
         */
        for (const datei of [UEBERSICHT, ZUSTAND, KENNZAHLEN, AUDIT, 'src/hooks/useInbox.ts']) {
            // Kommentare raus — die BEGRÜNDUNG, warum hier kein gcTime steht,
            // darf das Wort natürlich nennen.
            const code = readFileSync(datei, 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/^\s*\/\/.*$/gm, '');
            expect(
                code.includes('gcTime'),
                `${datei} setzt ein eigenes gcTime und hebelt die globale Ablagezeit aus`,
            ).toBe(false);
        }
    });
});
