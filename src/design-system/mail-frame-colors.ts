/**
 * Farben für die Darstellung fremder E-Mail-HTML im abgeschotteten Rahmen.
 *
 * Warum hier und nicht als Token: Der Rahmen ist ein EIGENES Dokument mit
 * eigener, undurchlässiger Herkunft (siehe MailHtmlFrame.tsx). Die
 * CSS-Variablen der Anwendung aus tokens.css existieren dort nicht — sie
 * werden weder vererbt noch könnten sie es, weil kein Stylesheet der Anwendung
 * in den Rahmen gelangt. Ein `hsl(var(--bg-surface))` wäre dort schlicht ein
 * ungültiger Wert.
 *
 * Warum HELL und nicht im dunklen Erscheinungsbild der Anwendung: Newsletter
 * setzen zwar oft einen eigenen Hintergrund, aber längst nicht immer eine
 * Textfarbe. Auf dunklem Untergrund wird fremde dunkle Schrift unlesbar — und
 * zwar genau bei den Mails, die man am ehesten lesen will, nämlich denen von
 * Kunden und Lieferanten. Jedes ernsthafte Mailprogramm zeigt HTML-Post
 * deshalb auf hellem Grund, unabhängig vom eigenen Erscheinungsbild.
 *
 * Dieses Verzeichnis ist von der Hex-Farben-Regel ausgenommen (eslint.config.js).
 */

/** Untergrund des Lesebereichs — entspricht der Erwartung der Absender. */
export const MAIL_FRAME_BACKGROUND = '#ffffff';

/** Grundfarbe für Text ohne eigene Angabe. Kein reines Schwarz. */
export const MAIL_FRAME_TEXT = '#1a1a1a';

/** Linkfarbe mit ausreichendem Kontrast auf Weiss (WCAG AA). */
export const MAIL_FRAME_LINK = '#1d4ed8';
