/**
 * Umschalter hell/dunkel.
 *
 * Ein Knopf, kein Menü: es gibt zwei Zustände, und ein Aufklappmenü für zwei
 * Einträge ist ein Klick zu viel. Das Symbol zeigt, was NACH dem Klick kommt —
 * so wie es Browser und Betriebssysteme halten.
 *
 * Die Sperre `bereit` ist nötig, nicht kosmetisch: next-themes kennt die Wahl
 * erst nach dem ersten Rendern (sie steht im localStorage, nicht im Markup).
 * Ohne die Sperre stünde für einen Moment das falsche Symbol da und würde
 * umspringen.
 *
 * Vorher stand dafür ein `useState` mit `useEffect(() => setBereit(true), [])`.
 * Das ist der übliche Mount-Riegel und der Linter meldet ihn zu Recht: ein
 * Effekt, der nur Zustand setzt, erzwingt einen zweiten Durchlauf.
 *
 * Gebraucht wird er hier auch nicht. `resolvedTheme` IST vor dem Auflösen
 * `undefined` — die Bedingung ist also schon vorhanden und muss nicht in einem
 * eigenen Zustand nachgebaut werden. Das ist zusätzlich genauer: der alte
 * Riegel bedeutete "ein Rendern ist vorbei", dieser bedeutet "next-themes hat
 * geantwortet". Das sind nicht zwangsläufig dieselben Zeitpunkte.
 */
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';

const FELD = cn(
    'inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]',
    'border border-overlay/[0.07] bg-overlay/[0.04] text-text-tertiary transition-colors',
    'hover:bg-overlay/[0.07] hover:text-text-primary',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50',
);

export function ErscheinungsbildKnopf(): JSX.Element {
    const { resolvedTheme, setTheme } = useTheme();
    const bereit = resolvedTheme !== undefined;
    const dunkel = resolvedTheme !== 'light';

    return (
        <button
            type="button"
            onClick={() => setTheme(dunkel ? 'light' : 'dark')}
            className={FELD}
            aria-label={dunkel ? 'Zu hellem Erscheinungsbild wechseln' : 'Zu dunklem Erscheinungsbild wechseln'}
            title={dunkel ? 'Helles Erscheinungsbild' : 'Dunkles Erscheinungsbild'}
        >
            {/* Vor dem ersten Rendern kein Symbol statt eines falschen. Der
                Knopf behält seine Grösse, die Kopfzeile springt also nicht. */}
            {bereit && (dunkel ? <Sun className="size-4" /> : <Moon className="size-4" />)}
        </button>
    );
}
