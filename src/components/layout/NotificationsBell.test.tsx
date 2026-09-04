/**
 * Die Glocke zeigt, was auf jemanden wartet.
 *
 * Hier stand vorher ein Test, der festhielt, dass der Knopf ABGESCHALTET ist
 * ("communicates the unavailable platform notification feed honestly"). Das war
 * damals richtig: der Ereignisstrom dahinter brauchte einen Mandantenbezug, den
 * eine Plattform-Admin-Sitzung nicht hat.
 *
 * Er beschrieb aber einen Zustand, kein Verhalten — und zementierte damit einen
 * Knopf, der nie etwas tun würde. Jetzt prüft er, dass die Glocke die richtigen
 * Zahlen zeigt und dass jede Zeile dorthin führt, wo man die Sache erledigt.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { NotificationsBell } from './NotificationsBell';

function zeige(ungeleseneMails: number, fehlgeschlageneAnfragen: number) {
    return render(
        <MemoryRouter>
            <NotificationsBell
                ungeleseneMails={ungeleseneMails}
                fehlgeschlageneAnfragen={fehlgeschlageneAnfragen}
            />
        </MemoryRouter>,
    );
}

describe('Glocke in der Kopfzeile', () => {
    it('zeigt die Summe als Zahl am Symbol', () => {
        const { container } = zeige(2, 1);
        expect(container).toHaveTextContent('3');
    });

    it('bleibt ohne Offenes still — keine Null am Symbol', () => {
        const { container } = zeige(0, 0);
        expect(container).not.toHaveTextContent('0');
        expect(container.querySelector('button')).toHaveAttribute('aria-label', 'Nichts Offenes');
    });

    it('ist immer bedienbar', () => {
        /**
         * Der Kern der Änderung. Vorher war der Knopf dauerhaft `disabled` —
         * ein Bedienelement, das nie etwas tun würde.
         */
        expect(zeige(0, 0).container.querySelector('button')).not.toBeDisabled();
    });

    it('fuehrt zu den Stellen, an denen man die Sache erledigt', async () => {
        zeige(4, 2);
        /* Radix reagiert auf Zeigerereignisse, nicht auf einen blossen
           click — deshalb pointerDown davor. Ohne das bleibt das Menue zu und
           der Test scheitert an etwas, das in der Anwendung funktioniert. */
        const knopf = screen.getByRole('button');
        fireEvent.pointerDown(knopf, { button: 0, ctrlKey: false, pointerType: 'mouse' });
        fireEvent.click(knopf);

        const mails = await screen.findByRole('menuitem', { name: /ungelesene Nachrichten/i });
        expect(mails).toHaveAttribute('href', '/mail');

        const anfragen = screen.getByRole('menuitem', { name: /nicht zugestellt/i });
        expect(anfragen).toHaveAttribute('href', '/access-requests');
    }, 15_000);

    it('nennt nur, was es auch gibt', async () => {
        // Eine Zeile "0 Zugangsanfragen" liest sich wie ein Bericht, obwohl die
        // Antwort schlicht "nichts" lautet.
        zeige(3, 0);
        /* Radix reagiert auf Zeigerereignisse, nicht auf einen blossen
           click — deshalb pointerDown davor. Ohne das bleibt das Menue zu und
           der Test scheitert an etwas, das in der Anwendung funktioniert. */
        const knopf = screen.getByRole('button');
        fireEvent.pointerDown(knopf, { button: 0, ctrlKey: false, pointerType: 'mouse' });
        fireEvent.click(knopf);

        expect(await screen.findByRole('menuitem', { name: /ungelesene Nachrichten/i })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: /Zugangsanfrage/i })).toBeNull();
    }, 15_000);
});
