/**
 * Dichte der Oberfläche — an EINER Stelle.
 *
 * ─── Warum das eine eigene Datei ist ───────────────────────────────────────
 *
 * Die Abstände standen an fünf Orten mit leicht abweichenden Zahlen: 152 px
 * Mindesthöhe bei den Kennzahlen, 148 px in der Onboarding-Übersicht, 168 px
 * bei den Zugängen, dazu drei verschiedene Innenabstände. Beim nächsten
 * „mach es kompakter" bleibt davon garantiert die Hälfte stehen — genau so
 * ist die letzte Runde ausgegangen.
 *
 * Die Zahlen stehen hier bewusst als Fliesstext und NICHT in der Schreibweise
 * einer Klasse: Tailwind durchsucht auch Kommentare und legt für jede Klasse,
 * die es dort findet, eine Regel an. Drei tote Regeln in der ausgelieferten
 * CSS, nur weil jemand erklärt hat, was früher galt.
 *
 * Deshalb hier: eine Zeile drehen, alles zieht mit. Dasselbe Muster wie
 * SEITEN_RAND in seite.tsx, und aus demselben Grund.
 *
 * ─── Woher die Werte kommen ────────────────────────────────────────────────
 *
 * Der Auslöser war ein MacBook Pro 13". Dort deckten fünf Kacheln die halbe
 * Höhe des Fensters ab, der Kalender war unten abgeschnitten, und eine
 * Kennzahl-Karte bestand zur Hälfte aus Leerraum — bei einer Karte, die
 * ein Symbol, ein Wort und eine Zahl trägt.
 *
 * Die Kachelhöhe ist deshalb an ihrem INHALT bemessen und nicht am Entwurf.
 * Im Browser nachgemessen statt gerechnet: Kopfzeile 15, Abstand 10, Zahl 22,
 * Innenabstand 2×16 — zusammen 81 px.
 *
 * Seit Beschriftung und Wert in EINER Zeile stehen — links der Text, rechts
 * die Zahl — braucht die Kachel nur noch die Höhe einer Zeile plus
 * Innenabstand und den 20-px-Streifen am unteren Rand: 68 px. Die vier Pixel
 * ueber der reinen Zeilenhoehe sind der Abstand, den der Streifen zur Zahl
 * braucht — bei 64 beruehrte er sie.
 *
 * Die Zwischenstände sind lehrreich: 104 px (Wert unter der Beschriftung, dazu
 * gestreckter Platz durch die Verlaufskurve), dann 88 px (Kurve als Streifen
 * am Rand), jetzt 64. Zweimal war die Leerfläche nicht der Innenabstand,
 * sondern die Anordnung.
 */

/**
 * Innenabstand einer Karte. 16 px statt 20–22.
 *
 * Bei 18 px Eckradius ist das der kleinste Wert, bei dem der Inhalt die
 * Rundung nicht berührt.
 */
export const KARTE_INNEN = 'p-4';

/**
 * Kennzahl-Kachel: Symbol und Beschriftung oben, Wert darunter.
 *
 * Gilt für alle drei Sorten — Übersicht, Onboarding-Stufen, Zugänge. Vorher
 * hatten sie 152, 148 und 168 px, ohne dass ein Unterschied beabsichtigt war.
 */
export const KACHEL = 'min-h-[68px] gap-2.5 p-4';

/**
 * Schriftgrad der grossen Zahl in einer Kachel.
 *
 * Wächst mit dem Fenster, aber gedeckelt: auf einem breiten Bildschirm soll
 * die Zahl nicht zur Schlagzeile werden. Vorher 24–34 px.
 */
export const KACHEL_ZAHL = 'text-[clamp(1.375rem,1.9vw,1.75rem)]';

/**
 * Begrüssungsbereich der Übersicht.
 *
 * Vorher `px-6 py-8 md:px-9 md:py-[34px]` plus `mb-7` — zusammen über 100 px
 * Höhe, bevor die erste Zahl kommt.
 */
export const HERO = 'mb-5 px-4 py-3 md:px-5 md:py-4';

/**
 * Höhe einer Kalenderzelle im Monatsraster.
 *
 * 72 px trägt drei Termin-Zeilen plus die Tageszahl. Bei 92 px passten sechs
 * Wochen nicht mehr auf einen 13-Zoll-Bildschirm — der Kalender war unten
 * abgeschnitten, ohne dass man es an der Zelle sah.
 */
export const KALENDER_ZELLE = 'min-h-[72px]';

/** Senkrechter Abstand zwischen den Blöcken einer Ansicht. */
export const BLOCK_ABSTAND = 'gap-3.5';

/**
 * Überschrift einer Ansicht.
 *
 * Sie stand an vier Orten in vier Größen: 26–34 px im Seitenkopf, 26–36 im
 * Begrüssungsbereich, 26–42 in der CRM-Übersicht, 22–28 in der neuen
 * Outreach-Ansicht. Beim Wechsel zwischen zwei Ansichten sprang damit die
 * Überschrift — sichtbar, aber schwer zu benennen.
 *
 * Gleichlautend mit CRM-System/src/app/components/dichte.ts.
 */
export const SEITEN_TITEL = 'text-[clamp(1.375rem,2.4vw,1.75rem)]';

/**
 * Begrüssung im Kopfbereich der Übersicht.
 *
 * Eine Stufe über den Seitentiteln — sie ist die einzige Überschrift, die
 * nicht benennt, was man sieht, sondern anspricht. Trotzdem gedeckelt: auf
 * einem breiten Bildschirm soll sie keine Schlagzeile werden.
 */
export const HERO_TITEL = 'text-[clamp(1.5rem,2.6vw,2rem)]';
