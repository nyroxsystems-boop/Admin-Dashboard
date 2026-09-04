/**
 * Der Editor der Mailmaske — Schreibgefühl und Werkzeugleiste.
 *
 * ─── Warum das Tippen sich zäh anfühlte ────────────────────────────────────
 *
 * `onChange` setzte in InboxView zwei Zustände (bodyHtml, bodyText). Jeder
 * Tastendruck liess damit die GANZE Postfachansicht neu rendern — samt
 * Nachrichtenliste, Vorschau und Werkzeugleiste. Beim schnellen Tippen kamen
 * die Buchstaben verzögert und in Schüben.
 *
 * Jetzt wartet die Meldung nach aussen 200 ms. Der Platzhalter reagiert
 * weiterhin sofort — er haengt an lokalem Zustand und kostet nichts.
 *
 * Beim Verlassen des Feldes wird sofort durchgereicht: wer direkt nach dem
 * letzten Buchstaben auf Senden klickt, soll den letzten Buchstaben auch
 * mitschicken. Das ist der Teil, den ein Entprellen leicht kaputt macht, und
 * genau deshalb steht er hier als Test.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RichEmailEditor } from './RichEmailEditor';

/**
 * jsdom kennt `innerText` nicht — es ist an das tatsaechliche Rendern
 * gebunden, und das gibt es dort nicht. Der Editor benutzt es bewusst und
 * nicht `textContent`: `innerText` beachtet Zeilenumbrueche und liefert damit
 * den Text, der spaeter als Nur-Text-Teil der Mail rausgeht.
 *
 * Hier also ein Ersatz fuer die Testumgebung. Er bildet nur den einfachen Fall
 * ab; fuer die Frage "wann wird gemeldet" reicht das vollstaendig.
 */
Object.defineProperty(HTMLElement.prototype, 'innerText', {
    configurable: true,
    get(this: HTMLElement) {
        return this.textContent ?? '';
    },
    set(this: HTMLElement, wert: string) {
        this.textContent = wert;
    },
});

function schreibe(feld: HTMLElement, text: string): void {
    // contentEditable: der Text wird direkt gesetzt, dann ein input-Ereignis.
    feld.innerHTML = `<p>${text}</p>`;
    fireEvent.input(feld);
}

function feldVon(container: HTMLElement): HTMLElement {
    const el = container.querySelector('[contenteditable]');
    if (!el) throw new Error('Kein Schreibfeld gefunden');
    return el as HTMLElement;
}

beforeEach(() => vi.useRealTimers());

describe('Schreibfeld', () => {
    it('meldet nicht bei jedem Tastendruck nach aussen', async () => {
        const gemeldet = vi.fn();
        const { container } = render(<RichEmailEditor onChange={gemeldet} />);
        const feld = feldVon(container);

        schreibe(feld, 'H');
        schreibe(feld, 'Ha');
        schreibe(feld, 'Hal');
        schreibe(feld, 'Hallo');

        // Unmittelbar nach vier Anschlaegen darf noch nichts draussen sein.
        expect(gemeldet, 'sonst rendert die ganze Ansicht je Buchstabe neu').not.toHaveBeenCalled();

        // Nach der Pause genau EINMAL, mit dem letzten Stand.
        await waitFor(() => expect(gemeldet).toHaveBeenCalledTimes(1), { timeout: 1500 });
        expect(gemeldet.mock.calls[0][0].text).toContain('Hallo');
    }, 15_000);

    it('reicht beim Verlassen SOFORT durch', async () => {
        const gemeldet = vi.fn();
        const { container } = render(<RichEmailEditor onChange={gemeldet} />);
        const feld = feldVon(container);

        schreibe(feld, 'Kurz vor dem Senden');
        fireEvent.blur(feld);

        expect(gemeldet).toHaveBeenCalled();
        expect(gemeldet.mock.calls.at(-1)?.[0].text).toContain('Kurz vor dem Senden');
    }, 15_000);

    it('blendet den Platzhalter SOFORT aus — der haengt nicht am Entprellen', () => {
        const { container } = render(<RichEmailEditor onChange={() => {}} />);
        expect(screen.getByText('Nachricht schreiben…')).toBeInTheDocument();

        schreibe(feldVon(container), 'Text');
        expect(screen.queryByText('Nachricht schreiben…')).toBeNull();
    });
});

describe('Werkzeugleiste', () => {
    it('zeichnet die Auswahlfelder selbst statt der Systemhuelle', () => {
        /**
         * `border-0 bg-transparent` genuegt nicht: Safari und Chrome zeichnen
         * um ein <select> ihre eigene Huelle mit Rahmen und Doppelpfeil, und
         * die ueberlebt jede Farbangabe. In einer Leiste, in der alle anderen
         * Bedienelemente unsere Form haben, stechen sie als Fremdkoerper
         * heraus. `appearance-none` schaltet sie ab.
         */
        const { container } = render(<RichEmailEditor onChange={() => {}} />);
        const felder = [...container.querySelectorAll('select')];

        expect(felder.length, 'Textstil, Schriftart, Groesse').toBe(3);
        for (const f of felder) {
            expect(f.className, 'ohne appearance-none bleibt die Systemhuelle').toContain('appearance-none');
            expect(f.className, 'eigener Rahmen wie bei den uebrigen Bedienelementen').toContain('border-overlay');
        }
    });

    it('haelt die Breite fest — sonst springt die Leiste in eine zweite Zeile', () => {
        /**
         * Ein <select> ist so breit wie seine GEWAEHLTE Beschriftung.
         * "Zwischenueberschrift" ist doppelt so breit wie "Normal": waehlte man
         * sie, wuchs die Leiste und schob das letzte Werkzeug in eine zweite
         * Zeile — die Leiste aenderte also ihre Hoehe, je nachdem was
         * eingestellt war. Genau das war zu sehen, und ich hatte es mit den
         * neuen Raendern selbst ausgeloest.
         *
         * Feste Breiten machen die Hoehe unabhaengig von der Einstellung; lange
         * Beschriftungen schneidet der Browser selbst ab (`truncate`).
         */
        const { container } = render(<RichEmailEditor onChange={() => {}} />);
        for (const f of container.querySelectorAll('select')) {
            expect(
                f.className,
                'ohne feste Breite haengt die Leistenhoehe an der Auswahl',
            ).toMatch(/\bw-\[[\d.]+rem\]/);
            expect(f.className).toContain('truncate');
        }
    });
});
