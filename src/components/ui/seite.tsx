/**
 * Wiederkehrende Bausteine des Redesigns vom 2026-07-30.
 *
 * Der Entwurf benutzt auf JEDEM Bildschirm dieselben drei Teile: einen
 * Kopfblock, eine Filterleiste und eine Tabellenkarte. Bei uns waren die an
 * zwölf Stellen von Hand nachgebaut, jeweils leicht anders.
 *
 * Sie hier einmal zu bauen ist nicht nur weniger Arbeit — es ist der einzige
 * Weg, auf dem sie beim nächsten Wechsel gemeinsam mitgehen. Bei den Schriften
 * ist genau das schiefgegangen: die Familien standen an drei Orten, zwei davon
 * blieben stehen, und die Anwendung lief unbemerkt in der Systemschrift.
 *
 * Masse und Farben stammen unverändert aus dem Entwurf; wo ich abgewichen bin,
 * steht der Grund an der Stelle.
 */
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { SEITEN_TITEL } from './dichte';

/* ────────────────────────────────────────────────────────────────────────
 * Seitenrand
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Der äussere Rand JEDER Ansicht — eine Quelle für alle.
 *
 * Vorher stand er je Ansicht einzeln, und zwar in drei Fassungen: die neu
 * gebauten hatten `p-6 md:px-8 md:py-7`, die älteren `p-6` oder `p-8`. Beim
 * Wechsel von "Kunden" auf "Bestellungen" sprang der Inhalt darum seitlich UND
 * oben. Das war die Fehlausrichtung, die im Betrieb auffällt: nicht ein
 * einzelner Bildschirm sieht falsch aus, sondern der Übergang zwischen zwei.
 *
 * Der Entwurf setzt `padding: 30px 32px 72px; max-width: 1620px`. Hier steht
 * eine Stufe darunter (24/28), weil die Ansicht kleiner werden sollte; der
 * grosse Fussraum bleibt — er hält die letzte Zeile vom Bildschirmrand weg.
 *
 * ─── Warum zwei Konstanten ────────────────────────────────────────────────
 *
 * Der Rand ist überall gleich, die BREITE nicht — und das ist richtig so. Ein
 * Assistent, ein Profilformular oder die Wartungsseite sind Formulare; auf
 * 1620 px gezogen laufen ihre Eingabefelder über die halbe Wand und werden
 * schlechter lesbar, nicht besser. Diese Ansichten nehmen darum
 * `SEITEN_RAND_OHNE_BREITE` und setzen ihre Breite selbst.
 *
 * So ist der Rand an einer Stelle gepflegt, und die Breite bleibt dort eine
 * ausgesprochene Entscheidung, wo sie eine ist — statt eines Werts, den vor
 * einem Jahr jemand hingeschrieben hat. Vorher lagen im Admin sechs Breiten
 * nebeneinander (1180, 1280, 1680, 672, 1024, 1152), ohne erkennbaren Grund.
 */
export const SEITEN_RAND_OHNE_BREITE = 'w-full px-4 pb-14 pt-5 md:px-7 md:pt-6';

/**
 * Der Regelfall: volle Breite bis 1620 px.
 *
 * `max-w-[1620px]` kommt aus dem Entwurf. Vorher: Admin 1280 (max-w-7xl), CRM
 * 1680 — zwei Anwendungen, die nebeneinander laufen, mit 400 px Unterschied in
 * der Textbreite. Bewusst OHNE `mx-auto`: der Entwurf zentriert nicht, der
 * Inhalt schliesst links an die Seitenleiste an.
 */
export const SEITEN_RAND = cn(SEITEN_RAND_OHNE_BREITE, 'max-w-[1620px]');

/* ────────────────────────────────────────────────────────────────────────
 * Kopfblock
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Titel, Beileile und rechts die Hauptaktion.
 *
 * Im Entwurf: `font:600 34px/1.1 'Space Grotesk'`, `letter-spacing:-.02em`,
 * Beileile `400 14.5px` in `#8a90a3` (= text-tertiary).
 *
 * Die Grösse wächst mit: bei 34 px fest bricht "Zugänge beantragen" auf einem
 * 1280er Bildschirm um, sobald rechts noch eine Schaltfläche steht.
 */
export function SeitenKopf({
    titel,
    beileile,
    aktionen,
    className,
}: {
    titel: string;
    beileile?: ReactNode;
    aktionen?: ReactNode;
    className?: string;
}): JSX.Element {
    return (
        <header className={cn('flex flex-wrap items-center gap-4', className)}>
            <div className="flex min-w-[min(100%,17.5rem)] flex-1 flex-col gap-1.5">
                <h1 className={cn('font-display font-semibold leading-[1.1] tracking-[-0.02em] text-text-primary', SEITEN_TITEL)}>
                    {titel}
                </h1>
                {beileile && (
                    <p className="text-sm leading-relaxed text-text-secondary">{beileile}</p>
                )}
            </div>
            {aktionen && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{aktionen}</div>}
        </header>
    );
}

/* ────────────────────────────────────────────────────────────────────────
 * Schaltflächen
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Gefüllte Hauptaktion mit Verlauf.
 *
 * Der Verlauf läuft von accent-600 nach 700 und NICHT von 500 aus, wie im
 * Entwurf gezeichnet: Weiss auf accent-500 ergibt 3,16 Kontrast, zu wenig für
 * Text. Beim Überfahren wird er heller — dann liegt der Text ohnehin nur kurz
 * darauf. Nachgerechnet in design-system/kontrast.test.ts.
 */
export const HAUPT_AKTION = cn(
    'inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-md',
    'bg-accent-600 hover:bg-accent-700 px-3.5 py-2.5',
    'text-sm font-semibold text-white',
    /* Der Verlauf bleibt UNVERÄNDERT und es wird nur der Schatten überblendet.
       `transition-all` mit einem Verlaufswechsel beim Überfahren flackert:
       Verläufe kann kein Browser stufenlos überblenden, er springt hart, und
       beim Klick fallen Überfahren, Gedrückt und Fokusring zusammen. Im CRM war
       das deutlich zu sehen. */
    'shadow-sm hover:shadow-glow-primary',
    'transition-[background-color,box-shadow,transform] duration-150 hover:-translate-y-px',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50',
);

/** Zurückhaltende Aktion: durchscheinende Fläche, wie die Pillen der Kopfzeile. */
export const NEBEN_AKTION = cn(
    'inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-md',
    'border border-border bg-surface px-3 py-2.5',
    'text-sm font-medium text-text-secondary transition-colors',
    'hover:bg-overlay/[0.07] hover:text-text-primary',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50',
    'disabled:pointer-events-none disabled:opacity-60',
);

/* ────────────────────────────────────────────────────────────────────────
 * Filterleiste
 * ──────────────────────────────────────────────────────────────────────── */

/** Suchfeld der Filterleiste — im Entwurf mindestens 300 px breit. */
export const SUCH_FELD = cn(
    'flex min-w-0 flex-1 items-center gap-[9px] rounded-md',
    'border border-overlay/[0.08] bg-overlay/[0.04] px-3.5 py-2.5',
    'transition-colors focus-within:border-accent-500/50 sm:max-w-[26rem] sm:flex-none sm:min-w-[300px]',
);

/** Das nackte Eingabefeld darin — ohne eigenen Rahmen, der Rahmen ist aussen. */
export const SUCH_EINGABE = cn(
    'min-w-0 flex-1 bg-transparent text-sm font-medium text-text-primary',
    'placeholder:text-text-muted focus:outline-none',
);

/**
 * Filterpille.
 *
 * `aktiv` färbt sie im Akzent ein. Der Entwurf setzt dafür Rand, Fläche und
 * Schrift gemeinsam — einzeln sieht der aktive Zustand nach Fehler aus.
 */
export function FilterPille({
    aktiv,
    children,
    ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { aktiv?: boolean }): JSX.Element {
    return (
        <button
            type="button"
            aria-pressed={aktiv}
            className={cn(
                'shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50',
                aktiv
                    ? 'border-accent-500/40 bg-accent-500/[0.14] text-accent-500'
                    : 'border-overlay/[0.07] bg-overlay/[0.03] text-text-muted hover:bg-overlay/[0.06] hover:text-text-secondary',
            )}
            {...rest}
        >
            {children}
        </button>
    );
}

/* ────────────────────────────────────────────────────────────────────────
 * Abschnittsmarke
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Abschnittsmarke mit auslaufender Linie — auf mehreren Bildschirmen des
 * Entwurfs.
 *
 * `nummer` setzt links das 24-px-Akzentfeld, das der Entwurf bei mehrstufigen
 * Abläufen zeigt (Zugänge beantragen: Kunde wählen → Zugang wählen → prüfen).
 * Die Nummer ist dort kein Schmuck: sie sagt, dass die Schritte eine
 * Reihenfolge haben.
 */
export function AbschnittMarke({
    children,
    nummer,
    aktion,
    className,
}: {
    children: ReactNode;
    nummer?: number | string;
    aktion?: ReactNode;
    className?: string;
}): JSX.Element {
    return (
        <div className={cn('flex items-center gap-3', className)}>
            {nummer !== undefined && (
                <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-accent-500/30 bg-accent-500/[0.16] font-mono text-[11px] font-bold text-accent-500"
                >
                    {nummer}
                </span>
            )}
            <span className="text-sm font-semibold text-text-tertiary">
                {children}
            </span>
            <span aria-hidden className="h-px flex-1 bg-border" />
            {aktion}
        </div>
    );
}

/* ────────────────────────────────────────────────────────────────────────
 * Tabellenkarte
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Rahmen einer Tabelle: Kartenoptik, waagerecht rollbar.
 *
 * `overflow-x-auto` steht so im Entwurf und ist wichtig: die Spaltenraster sind
 * mit fester Mindestbreite gesetzt, damit die Spalten nicht zu Brei werden.
 * Ohne den Rollbereich schöbe die Tabelle stattdessen die ganze Seite auf.
 */
export function TabellenKarte({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}): JSX.Element {
    return <div className={cn('karte overflow-x-auto', className)}>{children}</div>;
}

/**
 * Kopfzeile der Tabelle.
 *
 * `spalten` ist das Rasterband aus dem Entwurf (z. B. "2.2fr .8fr .9fr"),
 * `mindestBreite` die Breite, unter der gerollt statt gequetscht wird.
 */
export function TabellenKopf({
    spalten,
    mindestBreite,
    children,
    className,
}: {
    spalten: string;
    mindestBreite: number;
    children: ReactNode;
    className?: string;
}): JSX.Element {
    return (
        <div
            role="row"
            className={cn(
                'grid gap-3 border-b border-overlay/[0.07] bg-overlay/[0.02] px-5 py-3.5',
                className,
            )}
            style={{ gridTemplateColumns: spalten, minWidth: `${mindestBreite}px` }}
        >
            {children}
        </div>
    );
}

/** Beschriftung einer Tabellenspalte: Mono-Versalien, 10 px, 0,14 em gesperrt. */
export function SpaltenMarke({
    children,
    rechts,
    className,
}: {
    children: ReactNode;
    rechts?: boolean;
    className?: string;
}): JSX.Element {
    return (
        <span
            className={cn(
                'truncate text-xs font-semibold text-text-muted',
                rechts && 'text-right',
                className,
            )}
        >
            {children}
        </span>
    );
}

/**
 * Eine Datenzeile.
 *
 * Die Trennlinie ist schwächer als die unter der Kopfzeile (4,5 % gegen 7 %) —
 * so trennt der Kopf sichtbar ab, ohne dass jede Zeile wie ein eigener Kasten
 * wirkt.
 */
export function TabellenZeile({
    spalten,
    mindestBreite,
    children,
    className,
    ...rest
}: React.HTMLAttributes<HTMLDivElement> & { spalten: string; mindestBreite: number }): JSX.Element {
    return (
        <div
            role="row"
            className={cn(
                'grid items-center gap-3 border-b border-overlay/[0.045] px-5 py-4 transition-colors',
                'last:border-b-0 hover:bg-overlay/[0.025]',
                className,
            )}
            style={{ gridTemplateColumns: spalten, minWidth: `${mindestBreite}px` }}
            {...rest}
        >
            {children}
        </div>
    );
}

/**
 * Quadratisches Symbolfeld am Zeilenanfang — im Entwurf 34 px mit Akzentverlauf.
 *
 * Trägt entweder Initialen oder ein Symbol. Es macht die Zeile lesbar, ohne
 * dass man die erste Spalte breiter machen muss.
 */
export function ZeilenMarke({
    children,
    ton = 'accent',
    className,
}: {
    children: ReactNode;
    ton?: 'accent' | 'neutral';
    className?: string;
}): JSX.Element {
    return (
        <span
            aria-hidden
            className={cn(
                'flex size-[34px] shrink-0 items-center justify-center rounded-md border',
                'font-display text-xs font-bold',
                ton === 'accent'
                    ? 'border-accent-500/[0.22] bg-accent-500/[0.08] text-accent-500'
                    : 'border-overlay/[0.07] bg-overlay/[0.055] text-text-tertiary',
                className,
            )}
        >
            {children}
        </span>
    );
}

/* ────────────────────────────────────────────────────────────────────────
 * Für echte <table>-Ansichten
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Dieselbe Optik wie TabellenKopf/TabellenZeile, aber für `<table>`.
 *
 * Der Entwurf baut seine Tabellen als CSS-Raster. Bei uns sind mehrere davon
 * echte Tabellen — und das ist besser, nicht schlechter: Vorlesewerkzeuge
 * kennen Zeilen und Spalten dann wirklich, bei einem Raster aus divs nicht.
 * Deshalb wird hier die ERSCHEINUNG übernommen und die Semantik behalten.
 */
export const TABELLE_KOPF = 'border-b border-overlay/[0.07] bg-overlay/[0.02] text-left';

export const TABELLE_KOPF_ZELLE = cn(
    'whitespace-nowrap px-4 py-3 text-xs font-semibold',
    'text-text-muted',
);

export const TABELLE_ZEILE = cn(
    'border-b border-overlay/[0.045] transition-colors last:border-b-0 hover:bg-overlay/[0.025]',
);

export const TABELLE_ZELLE = 'px-4 py-3 align-middle text-sm text-text-secondary';

/** Leerzustand innerhalb einer Tabellenkarte — gestrichelt wie im Entwurf. */
export function LeerZeile({
    icon,
    titel,
    hinweis,
}: {
    icon?: ReactNode;
    titel: string;
    hinweis?: string;
}): JSX.Element {
    return (
        <div className="flex flex-col items-center gap-3 px-6 py-[52px] text-center">
            {icon && (
                <span className="flex size-11 items-center justify-center rounded-[13px] bg-overlay/[0.045] text-text-faint">
                    {icon}
                </span>
            )}
            <span className="text-sm font-semibold text-text-tertiary">{titel}</span>
            {hinweis && <span className="max-w-sm text-sm text-text-muted">{hinweis}</span>}
        </div>
    );
}
