/**
 * Der Seitenrand steht an EINER Stelle — und bleibt dort.
 *
 * ─── Was hier schiefging ───────────────────────────────────────────────────
 *
 * Der äussere Rand jeder Ansicht war einzeln hingeschrieben, in drei Fassungen:
 *
 *   p-6 md:px-8 md:py-7    in den neu gebauten Ansichten (Kunden, Onboarding,
 *                          OEM-Finder, Zugänge, Kalender, Einstellungen)
 *   p-6 md:p-8             in Bestellungen, Admins, Protokoll, Wartung, Profil,
 *                          Assistent, Support, Bot-Test
 *   p-4                    in der Postfachverwaltung
 *
 * Dazu SECHS verschiedene Maximalbreiten: 1180, 1280 (max-w-7xl), 1680, 672
 * (2xl), 1024 (5xl), 1152 (6xl).
 *
 * Ein einzelner Bildschirm sieht dabei nie falsch aus. Auffallen tut der
 * ÜBERGANG: wer von "Kunden" auf "Bestellungen" klickt, sieht den Inhalt
 * seitlich und oben springen. Das war die Beobachtung "allign bitte alles noch
 * besser" — sie beschreibt keine einzelne Ansicht, sondern die Bewegung
 * zwischen zwei.
 *
 * ─── Warum ein Test und nicht nur eine Konstante ───────────────────────────
 *
 * Eine Konstante ist eingeführt und heute überall benutzt. Die nächste Ansicht
 * wird aber von jemandem angelegt, der ein bestehendes Muster kopiert — und
 * kopiert dabei mit einer Wahrscheinlichkeit von 100 Prozent eine
 * Klassenkette, wenn er eine findet. Dieser Test macht aus dem guten Vorsatz
 * eine Bedingung.
 *
 * Bei den Schriftfamilien war genau das der Ablauf: eine Quelle gedacht, drei
 * Orte vorhanden, zwei blieben beim Wechsel stehen, und die Anwendung lief
 * unbemerkt in der Systemschrift.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WURZEL = join(process.cwd(), 'src/views');

function alleAnsichten(pfad = WURZEL, gesammelt: string[] = []): string[] {
    for (const eintrag of readdirSync(pfad)) {
        const voll = join(pfad, eintrag);
        if (statSync(voll).isDirectory()) alleAnsichten(voll, gesammelt);
        else if (eintrag.endsWith('.tsx') && !eintrag.includes('.test.')) gesammelt.push(voll);
    }
    return gesammelt;
}

const ANSICHTEN = alleAnsichten();

describe('Seitenrand', () => {
    it('kommt in jeder Ansicht aus der Konstante, nicht aus einer Klassenkette', () => {
        const eigenmaechtig: string[] = [];

        for (const datei of ANSICHTEN) {
            const quelle = readFileSync(datei, 'utf8');

            // Wer die Konstante benutzt, ist fertig. Diese Abkürzung ist nicht
            // nur schneller — sie vermeidet einen Fehlalarm, in den ich beim
            // ersten Lauf gelaufen bin: ich hatte die äusserste Klassenkette
            // über das ERSTE `return (<div className=` gesucht. Sobald der
            // äusserste Baustein aber `{cn(SEITEN_RAND)}` trägt, findet dieses
            // Muster das nächste `return` in derselben Datei — und das ist
            // typischerweise eine Karte einer Unterkomponente mit `p-4 md:p-5`.
            // Gemeldet wurde dann eine Ansicht, die längst richtig war.
            if (/\bSEITEN_RAND(?:_OHNE_BREITE)?\b/.test(quelle)) continue;

            // Kennzeichen eines Seitenrands: eine Maximalbreite ZUSAMMEN mit
            // einem Rand. Eine Karte setzt nie `max-w-` — sie füllt ihre Spalte.
            // Darum ist diese Verbindung eindeutig die Seitenhülle.
            for (const m of quelle.matchAll(/className="([^"]*)"/g)) {
                const kette = m[1];
                const rand = /\b(?:p|px|py)-[4-9]\b/.test(kette);
                const breite = /\bmax-w-(?:\[|\dxl|content|screen)/.test(kette);
                if (rand && breite) {
                    eigenmaechtig.push(`${datei.replace(process.cwd() + '/', '')} → ${kette.slice(0, 70)}`);
                    break;
                }
            }

            // Zweiter Fall: ein äusserster Baustein mit grossem Rundum-Rand und
            // ohne Maximalbreite. `p-6`/`p-8` ganz aussen ist immer ein
            // Seitenrand — so gross wird innen nichts gepolstert.
            const aussen = /return\s*\(\s*<div\s+className="([^"]*)"/.exec(quelle)?.[1] ?? '';
            if (/\bp-[6-9]\b/.test(aussen)) {
                eigenmaechtig.push(`${datei.replace(process.cwd() + '/', '')} → ${aussen.slice(0, 70)}`);
            }
        }

        expect(
            eigenmaechtig,
            'Diese Ansichten setzen ihren Seitenrand selbst. Nimm SEITEN_RAND aus '
            + '@/components/ui/seite — oder SEITEN_RAND_OHNE_BREITE, wenn die '
            + 'Ansicht ein Formular ist und bewusst schmaler bleibt.',
        ).toEqual([]);
    });

    it('ist im CRM wertgleich — die beiden Anwendungen laufen nebeneinander', () => {
        /**
         * Der Nutzer wechselt oben rechts zwischen Admin und CRM. Wenn der Rand
         * dort um 8 px abweicht, springt der Inhalt beim Wechsel — dasselbe
         * Problem wie zwischen zwei Ansichten, nur zwischen zwei Anwendungen.
         *
         * Vorher: Admin 1280 px Textbreite, CRM 1680. 400 px Unterschied.
         */
        const hier = readFileSync(join(process.cwd(), 'src/components/ui/seite.tsx'), 'utf8');
        const dort = readFileSync(
            join(process.cwd(), '../CRM-System/src/app/components/ui-kit.tsx'), 'utf8',
        );

        const lies = (quelle: string, name: string) => {
            const m = new RegExp(`export const ${name} = (?:cn\\()?'([^']*)'`).exec(quelle);
            expect(m, `${name} nicht gefunden`).not.toBeNull();
            return m![1];
        };

        expect(lies(dort, 'SEITEN_RAND_OHNE_BREITE')).toBe(lies(hier, 'SEITEN_RAND_OHNE_BREITE'));
    });

    it('hält den Wert aus dem Entwurf, eine Stufe kleiner', () => {
        /**
         * Der Entwurf setzt `padding: 30px 32px 72px; max-width: 1620px`. Auf
         * Wunsch eine Stufe darunter: 24 oben (pt-6), 28 seitlich (px-7). Der
         * grosse Fussraum bleibt — er hält die letzte Tabellenzeile vom
         * Bildschirmrand weg, und ohne ihn klebt sie unten an.
         *
         * Dieser Test steht hier, damit der Wert nicht unbemerkt zurückwandert:
         * er sieht wie ein beliebiges `pt-5` aus, ist aber gerechnet.
         */
        const quelle = readFileSync(join(process.cwd(), 'src/components/ui/seite.tsx'), 'utf8');
        const rand = /export const SEITEN_RAND_OHNE_BREITE = '([^']*)'/.exec(quelle)?.[1] ?? '';

        expect(rand, 'seitlich 16 px auf dem Handy').toContain('px-4');
        expect(rand, 'seitlich 28 px ab md — eine Stufe unter den 32 des Entwurfs').toContain('md:px-7');
        expect(rand, 'oben 24 px ab md — eine Stufe unter den 30 des Entwurfs').toContain('md:pt-6');
        expect(rand, 'Fussraum 56 px, damit die letzte Zeile nicht am Rand klebt').toContain('pb-14');

        const voll = /export const SEITEN_RAND = cn\(SEITEN_RAND_OHNE_BREITE, '([^']*)'/.exec(quelle)?.[1] ?? '';
        expect(voll, 'Maximalbreite aus dem Entwurf').toContain('max-w-[1620px]');
    });
});
