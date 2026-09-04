/**
 * MailHtmlFrame — stellt fremde E-Mail-HTML abgeschottet dar.
 *
 * ─── Warum ein iframe und nicht dangerouslySetInnerHTML ─────────────────────
 *
 * Wird fremde HTML direkt ins Dokument der Anwendung gehängt, muss die
 * Bereinigung allein alles abfangen. Sie war deshalb so streng, dass ein
 * gewöhnlicher Newsletter zu einer Linkliste mit leeren Kästchen zerfiel.
 *
 * Der Rahmen dreht das um: Weil der Inhalt nichts anrichten kann, darf er sein
 * Aussehen behalten.
 *
 * ─── Die Sandbox-Einstellung, genau ────────────────────────────────────────
 *
 *   allow-same-origin   Die Anwendung darf den Inhalt LESEN — nur so lässt
 *                       sich seine Höhe messen (siehe unten).
 *   allow-popups        Damit Links überhaupt aufgehen.
 *   allow-popups-to-escape-sandbox
 *                       Damit sie in einem NORMALEN Tab aufgehen und nicht in
 *                       einem, der die Beschränkungen erbt.
 *
 * NICHT gesetzt und niemals zu setzen: `allow-scripts`.
 *
 * Gefährlich ist die KOMBINATION `allow-same-origin` + `allow-scripts` — dann
 * könnte der Inhalt seine eigene Sandbox entfernen. Ohne `allow-scripts` läuft
 * dort überhaupt kein Code: kein `<script>`, kein `onerror`, kein
 * `javascript:`. Am Browser nachgemessen: mit dieser Einstellung ist die Höhe
 * lesbar (1254 px im Versuch) und es lief kein einziges Skript.
 *
 * Was der Inhalt weiterhin NICHT kann: das Dokument der Anwendung sehen,
 * Cookies oder das Sitzungstoken lesen, unsere API aufrufen, das Hauptfenster
 * umleiten.
 *
 * ─── Externe Bilder laden SOFORT ───────────────────────────────────────────
 *
 * Vorher lagen sie hinter einem Klick: ein Bild von fremdem Server meldet dem
 * Absender, wann und wo die Mail geöffnet wurde. In einem Team-Postfach mit
 * täglichen Lieferanten-Newslettern war das aber ein Klick pro Nachricht, und
 * auf Wunsch des Betreibers ist das jetzt abgeschafft — die Mail sieht aus wie
 * beim Absender gedacht.
 *
 * Was BLEIBT: Zählpixel werden in sanitizeMailHtml entfernt (1x1-Bilder mit
 * fremder Adresse). Die tragen keinen Inhalt, ihr einziger Zweck ist die
 * Lesebestätigung. Sie wegzulassen kostet nichts und nimmt dem Absender das
 * verlässlichste Mittel.
 *
 * ─── Warum die Höhe gemessen wird ──────────────────────────────────────────
 *
 * Vorher hatte der Rahmen eine feste Höhe und rollte intern. Damit gab es zwei
 * Bildläufe übereinander: einen für die Seite, einen für die Mail. Wer eine
 * lange Mail las, musste erst im Rahmen ans Ende rollen und dann noch einmal
 * die Seite. Jetzt wächst der Rahmen auf die Höhe seines Inhalts, und es rollt
 * nur noch die Seite — wie in jedem gewohnten Postfach.
 *
 * Nachgemessen wird auch NACH dem Laden: Bilder ändern die Höhe, sobald sie
 * ankommen. Ein einmaliges Messen beim `load` bliebe zu kurz.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

import type { InboxMessage } from '@/api/types';
import { sanitizeMailHtml } from '@/lib/sanitizeMailHtml';
import { aufDunkelUmstellen } from './mailDunkel';
import { renderMailRahmen } from './mailRahmen';
import { rahmenDatenFuer } from './mailRahmenDaten';

/** Anfangshöhe, bis gemessen ist. Verhindert ein Springen von 0 auf voll. */
const START_HOEHE = 320;

interface Props {
    message: InboxMessage;
}

export function MailHtmlFrame({ message }: Props): JSX.Element {
    const [hoehe, setHoehe] = useState(START_HOEHE);
    const rahmen = useRef<HTMLIFrameElement>(null);

    /**
     * Der Rahmen folgt dem Erscheinungsbild der Anwendung.
     *
     * Hier stand `dunkel: true` fest. Im Hellmodus sass dann eine SCHWARZE
     * Karte auf weissem Grund — ein Sprung von fast 0 auf fast 100 Prozent
     * Helligkeit, mitten auf der Seite. Das ist kein Kontrast, der hilft,
     * sondern einer, der blendet: das Auge stellt sich beim Lesen der Mail auf
     * dunkel ein und beim Blick zurueck auf die Liste wieder auf hell.
     *
     * `resolvedTheme` statt `theme`, damit auch "System" richtig aufgeloest
     * wird. Vor dem Aufloesen ist es undefined — dann bleibt es dunkel, das
     * ist die Vorgabe der Anwendung und der haeufigere Fall.
     */
    const { resolvedTheme } = useTheme();
    const dunkel = resolvedTheme !== 'light';

    const doc = useMemo(() => {
        /**
         * ─── Jede Stufe wird gestoppt ─────────────────────────────────────
         *
         * Die Rueckweg-Messung hat einen 3,3-Sekunden-Stau des Hauptthreads
         * IM MAILPROGRAMM nachgewiesen — aufgetreten nur nach dem Oeffnen
         * bestimmter Mails. Diese Kette hier ist der Hauptverdaechtige: alle
         * drei Stufen sind Mustersuchen ueber den HTML-Text, und bestimmte
         * Eingaben koennen Mustersuchen katastrophal langsam machen
         * (backtracking). Welche Mail und welche Stufe, sagt ab jetzt die
         * Konsole — mit Betreff und Millisekunden je Stufe.
         *
         * console.warn, nicht info: der Produktionsbau entfernt info.
         */
        const t0 = performance.now();
        const sauber = sanitizeMailHtml(message.html);
        const t1 = performance.now();
        // Farben der Mail nur im Dunkelmodus umrechnen. Im Hellmodus muss das
        // bereinigte Original erhalten bleiben — sonst sitzt eine künstlich
        // geschwärzte Mail auf der weißen Lesefläche der Anwendung.
        const inhalt = dunkel ? aufDunkelUmstellen(sauber) : sauber;
        const t2 = performance.now();
        const fertig = renderMailRahmen({
            ...rahmenDatenFuer(message, inhalt),
            // Kein heller Streifen um die Karte: sie sitzt direkt auf der
            // Arbeitsflaeche der Anwendung.
            aussenHintergrund: null,
            dunkel,
            volleBreite: true,
        });
        const t3 = performance.now();
        if (t3 - t0 > 200) {
            // eslint-disable-next-line no-console
            console.warn(
                `[Messung] Mailaufbereitung "${(message.subject || '?').slice(0, 60)}" `
                + `dauerte ${Math.round(t3 - t0)} ms `
                + `(bereinigen ${Math.round(t1 - t0)}, dunkel ${Math.round(t2 - t1)}, `
                + `rahmen ${Math.round(t3 - t2)})`,
            );
        }
        return fertig;
    }, [message, dunkel]);

    /**
     * ─── Die Sperrklinke, die hier drin war ───────────────────────────────
     *
     * Zwei Fehler, die zusammen die Hoehe nur noch wachsen liessen:
     *
     * 1. Die Hoehe lebt im Baustein, nicht im iframe. Beim Wechsel von einer
     *    langen zu einer kurzen Nachricht entsteht zwar ein frischer Rahmen
     *    (key an der Nachricht), aber er bekommt die ALTE Hoehe als style.
     *    Hier stand sogar ein Kommentar, warum kein Zuruecksetzen noetig sei —
     *    "onLoad misst sofort neu". Stimmt, nur misst onLoad dann Punkt 2:
     *
     * 2. `documentElement.scrollHeight` ist MINDESTENS die Rahmenhoehe selbst.
     *    Ein 4000-px-Rahmen mit 1100 px Inhalt misst 4000 — die alte Hoehe
     *    bestaetigt sich selbst, fuer immer. Nach einer langen Mail war jede
     *    kurze Mail darunter ein leerer Schacht, und das Antwortfeld lag erst
     *    am Ende des Schachts.
     *
     * Deshalb: beim Nachrichtenwechsel auf die Starthoehe zurueck (Zustand
     * waehrend des Renderns angepasst, kein Effekt — vgl. React-Muster
     * "adjusting state during render"), und gemessen wird die INHALTSHOEHE:
     * `getBoundingClientRect().height` des Wurzelelements ist die Layouthoehe
     * des Inhalts und kann — anders als scrollHeight — auch KLEINER sein als
     * der Rahmen. body.scrollHeight bleibt als zweite Quelle fuer Mails, deren
     * Wurzel die Hoehe nicht traegt.
     */
    const messungGeplant = useRef(false);
    const letzteHoehe = useRef(0);

    const [gemesseneNachricht, setGemesseneNachricht] = useState(message.id);
    if (gemesseneNachricht !== message.id) {
        setGemesseneNachricht(message.id);
        setHoehe(START_HOEHE);
        // Auch die Daempfung vergisst die alte Hoehe — sonst schluckt sie
        // die erste Messung der neuen Nachricht, wenn beide gleich hoch sind.
        letzteHoehe.current = 0;
    }

    /**
     * ─── Gebuendelt und gedaempft ─────────────────────────────────────────
     *
     * Vorher lief die Messung bei JEDEM Ausschlag des ResizeObservers — und
     * ein Newsletter mit dreissig Bildern schlaegt dreissigmal aus, waehrend
     * die Bilder eintrudeln. Jede Messung liest Layoutmasse (erzwingt einen
     * Umbruch) und setzt dann die Rahmenhoehe (erzwingt den naechsten). Bei
     * einem tabellenlastigen 4000-Pixel-Dokument ist ein Umbruch teuer; in
     * Summe sass der Hauptthread fest — die Rueckweg-Messung hat einen
     * 3,3-Sekunden-Stau im Mailprogramm nachgewiesen.
     *
     * Zwei Daempfer:
     *   1. Je Bildwechsel hoechstens EINE Messung (rAF-Buendelung). Dreissig
     *      Ausschlaege in einem Rutsch ergeben eine Messung statt dreissig.
     *   2. Aenderungen bis 2 px werden geschluckt. Bruchteil-Rundungen
     *      zwischen gemessener und gesetzter Hoehe koennen sonst einen
     *      Endlos-Kreisel antreiben: messen -> setzen -> Umbruch -> messen.
     */
    const messen = useCallback(() => {
        if (messungGeplant.current) return;
        messungGeplant.current = true;
        requestAnimationFrame(() => {
            messungGeplant.current = false;
            const d = rahmen.current?.contentDocument;
            if (!d?.documentElement) return;
            const gemessen = Math.ceil(Math.max(
                d.documentElement.getBoundingClientRect().height,
                d.body?.scrollHeight ?? 0,
            ));
            if (gemessen <= 0 || Math.abs(gemessen - letzteHoehe.current) <= 2) return;
            letzteHoehe.current = gemessen;
            setHoehe(gemessen);
        });
    }, []);

    /**
     * Nachmessen, solange sich etwas ändert.
     *
     * Bilder kommen nach dem `load`-Ereignis an und verschieben alles darunter.
     * Der ResizeObserver fängt das zuverlässig ab; er läuft im Dokument des
     * Rahmens, was nur dank `allow-same-origin` möglich ist.
     */
    useEffect(() => {
        const d = rahmen.current?.contentDocument;
        if (!d?.documentElement || typeof ResizeObserver === 'undefined') return undefined;
        const beobachter = new ResizeObserver(() => messen());
        beobachter.observe(d.documentElement);
        return () => beobachter.disconnect();
    }, [doc, messen]);

    return (
        <div className="relative flex min-h-0 flex-col">
            <iframe
                ref={rahmen}
                // Erzwingt bei jedem Wechsel einen frischen Rahmen — sonst
                // bliebe beim Wechsel der Nachricht der alte Inhalt stehen.
                key={message.id}
                title={message.subject ? `E-Mail-Inhalt: ${message.subject}` : 'E-Mail-Inhalt'}
                srcDoc={doc}
                onLoad={messen}
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                scrolling="no"
                style={{ height: `${hoehe}px` }}
                className="w-full border-0 bg-transparent"
            />
        </div>
    );
}

export default MailHtmlFrame;
