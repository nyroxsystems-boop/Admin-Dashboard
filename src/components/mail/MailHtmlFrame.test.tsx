/**
 * Die Hoehe des Leserahmens folgt der Nachricht — in BEIDE Richtungen.
 *
 * ─── Die Sperrklinke, die das verhindert hat ───────────────────────────────
 *
 * Die Hoehe lebt im Baustein, der Rahmen wird je Nachricht neu erzeugt. Beim
 * Wechsel von einer langen zu einer kurzen Mail bekam der frische Rahmen die
 * ALTE Hoehe — und die Neumessung benutzte documentElement.scrollHeight, das
 * MINDESTENS die Rahmenhoehe selbst ist. Ein 4000-px-Rahmen mit 1100 px Inhalt
 * mass 4000: die alte Hoehe bestaetigte sich selbst.
 *
 * Sichtbar wurde das als leerer Schacht unter jeder kurzen Mail, mit dem
 * Antwortfeld erst ganz am Ende — man musste durch tausende leere Pixel
 * rollen, um zu antworten.
 */
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MailHtmlFrame } from './MailHtmlFrame';
import type { InboxMessage } from '@/api/types';

const themeState = vi.hoisted(() => ({ resolvedTheme: 'dark' }));
vi.mock('next-themes', () => ({ useTheme: () => themeState }));

beforeEach(() => {
    themeState.resolvedTheme = 'dark';
});

function nachricht(id: string, html: string): InboxMessage {
    return {
        id, subject: `Betreff ${id}`, from: 'x@y.de', from_name: 'X',
        to: ['ziel@partsunion.de'], html, body: '', direction: 'inbound',
        folder: 'inbox', is_read: true, received_at: '2026-08-03T10:00:00Z',
        attachments: [], mailbox: 'info', mailboxes: ['info@partsunion.de'],
    } as unknown as InboxMessage;
}

/** Haengt dem Rahmen ein Messdokument mit fester Inhaltshoehe an. */
function stubbeInhalt(iframe: HTMLIFrameElement, hoehe: number): void {
    const doc = {
        documentElement: {
            getBoundingClientRect: () => ({ height: hoehe }),
            scrollHeight: hoehe,
        },
        body: { scrollHeight: hoehe },
    };
    Object.defineProperty(iframe, 'contentDocument', { get: () => doc, configurable: true });
}

describe('Leserahmen-Hoehe', () => {
    it('waechst mit einer langen Mail und faellt beim Wechsel zurueck', async () => {
        const { container, rerender } = render(<MailHtmlFrame message={nachricht('a', '<p>lang</p>')} />);
        const rahmen = (): HTMLIFrameElement => container.querySelector('iframe')!;

        /**
         * `waitFor` statt sofortiger Pruefung: die Messung ist auf einen
         * Bildwechsel gebuendelt (rAF), seit ein Newsletter mit dreissig
         * Bildern dreissig Messungen samt Umbruechen ausgeloest und den
         * Hauptthread sekundenlang festgehalten hat.
         */
        stubbeInhalt(rahmen(), 3800);
        fireEvent.load(rahmen());
        await waitFor(() => expect(rahmen().style.height).toBe('3800px'));

        /**
         * Wechsel zur kurzen Mail. Vorher blieb hier 3800 stehen, weil die
         * Neumessung ueber scrollHeight die Rahmenhoehe zurueckmass. Der
         * Rueckfall auf die Starthoehe ist der Kern des Fixes.
         */
        rerender(<MailHtmlFrame message={nachricht('b', '<p>kurz</p>')} />);
        expect(rahmen().style.height, 'die alte Hoehe darf den Wechsel nicht ueberleben').toBe('320px');

        // Und die kurze Mail misst dann ihre eigene Hoehe.
        stubbeInhalt(rahmen(), 900);
        fireEvent.load(rahmen());
        await waitFor(() => expect(rahmen().style.height).toBe('900px'));
    });

    it('kann auch innerhalb einer Nachricht schrumpfen', async () => {
        /**
         * Die zweite Haelfte der Sperrklinke: die Messung selbst. Ueber
         * getBoundingClientRect kann ein Wert auch KLEINER sein als der
         * Rahmen — ueber documentElement.scrollHeight nie.
         */
        const { container } = render(<MailHtmlFrame message={nachricht('c', '<p>x</p>')} />);
        const rahmen = container.querySelector('iframe')!;

        stubbeInhalt(rahmen, 2000);
        fireEvent.load(rahmen);
        await waitFor(() => expect(rahmen.style.height).toBe('2000px'));

        stubbeInhalt(rahmen, 1200);
        fireEvent.load(rahmen);
        await waitFor(() => expect(rahmen.style.height, 'schrumpfen muss moeglich sein').toBe('1200px'));
    });
});

describe('Erscheinungsbild des Mailinhalts', () => {
    const farbigeMail = '<div style="background:white;color:black">Lesbarer Inhalt</div>';

    it('behaelt im Hellmodus die Originalfarben der Mail', () => {
        themeState.resolvedTheme = 'light';
        const { container } = render(<MailHtmlFrame message={nachricht('hell', farbigeMail)} />);
        const srcdoc = container.querySelector('iframe')?.getAttribute('srcdoc') ?? '';

        expect(srcdoc).toContain('background:white');
        expect(srcdoc).toContain('color:black');
    });

    it('behaelt Originalfarben und bietet eine bewusste dunkle Leseflaeche', () => {
        const { container, getByRole } = render(<MailHtmlFrame message={nachricht('dunkel', farbigeMail)} />);
        expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toContain('background:white');
        fireEvent.click(getByRole('button', { name: 'Dunkle Lesefläche' }));
        const srcdoc = container.querySelector('iframe')?.getAttribute('srcdoc') ?? '';
        expect(srcdoc).not.toContain('background:white');
        expect(srcdoc).not.toContain('color:black');
    });
});

it('gibt externe Bilder nur fuer die ausgewaehlte Nachricht frei', () => {
    const html = '<img src="https://sender.example/banner.png" alt="Banner">';
    const { container, getByRole, rerender } = render(<MailHtmlFrame message={nachricht('first', html)} />);
    const body = () => new DOMParser().parseFromString(container.querySelector('iframe')!.srcdoc, 'text/html').body;
    expect(body().querySelector('img')?.getAttribute('src')).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Bilder laden' }));
    expect(body().querySelector('img')?.getAttribute('src')).toBe('https://sender.example/banner.png');
    rerender(<MailHtmlFrame message={nachricht('second', html)} />);
    expect(body().querySelector('img')?.getAttribute('src')).toBeNull();
});

it('zeigt reine Textmails vollstaendig und maskiert darin enthaltene HTML-Zeichen', () => {
    const message = { ...nachricht('text', ''), html: null, body: 'Guten Tag\n<script>kein HTML</script>' };
    const { container } = render(<MailHtmlFrame message={message} />);
    const document = new DOMParser().parseFromString(container.querySelector('iframe')!.srcdoc, 'text/html');
    expect(document.body.textContent).toContain('Guten Tag');
    expect(document.body.textContent).toContain('<script>kein HTML</script>');
    expect(document.querySelector('script')).toBeNull();
});
