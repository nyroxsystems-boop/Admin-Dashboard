/**
 * Glocke in der Kopfzeile — zeigt, was auf jemanden wartet.
 *
 * ─── Vorher ────────────────────────────────────────────────────────────────
 *
 * Ein dauerhaft abgeschalteter Knopf mit durchgestrichener Glocke. Das war
 * ehrlich — der Ereignisstrom dahinter (`/api/events/ticket`) verlangt einen
 * Mandantenbezug, den eine Plattform-Admin-Sitzung nicht hat, und ein Anschluss
 * hätte bei jedem Laden eine fehlschlagende Anfrage erzeugt. Genau die Sorte
 * Schleife, die uns beim Systemzustand die Wartezeit gekostet hat.
 *
 * Es blieb aber ein Bedienelement, das nie etwas tun würde, und das ist
 * Ballast in einer Kopfzeile.
 *
 * ─── Jetzt ─────────────────────────────────────────────────────────────────
 *
 * Sie zeigt zwei Dinge, die wir ohnehin abfragen: ungelesene Nachrichten und
 * Zugangsanfragen, deren Versand fehlgeschlagen ist. Kein neuer Endpunkt, keine
 * offene Verbindung — siehe hooks/useOffeneSachen.ts.
 *
 * Jede Zeile führt DORTHIN, wo man die Sache erledigt. Eine Benachrichtigung,
 * die nur zählt und einen dann suchen lässt, ist eine halbe.
 */
import { Bell, KeyRound, Mail, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface NotificationsBellProps {
    ungeleseneMails: number;
    fehlgeschlageneAnfragen: number;
}

/** Eine Zeile im Aufklappmenü — Symbol, Text, Zahl, führt zum Ziel. */
function Zeile({
    to,
    icon: Icon,
    text,
    anzahl,
    ton,
}: {
    to: string;
    icon: LucideIcon;
    text: string;
    anzahl: number;
    ton?: 'warnung';
}): JSX.Element {
    return (
        <DropdownMenuItem asChild>
            <Link to={to} className="flex cursor-pointer items-center gap-2.5">
                <Icon className={cn('size-4 shrink-0', ton === 'warnung' ? 'text-warning' : 'text-text-tertiary')} />
                <span className="min-w-0 flex-1 truncate text-[12px]">{text}</span>
                <span
                    className={cn(
                        'shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums',
                        ton === 'warnung' ? 'bg-warning text-auf-ton' : 'bg-overlay/[0.08] text-text-secondary',
                    )}
                >
                    {anzahl}
                </span>
            </Link>
        </DropdownMenuItem>
    );
}

export function NotificationsBell({
    ungeleseneMails,
    fehlgeschlageneAnfragen,
}: NotificationsBellProps): JSX.Element {
    const gesamt = ungeleseneMails + fehlgeschlageneAnfragen;
    const label = gesamt > 0 ? `${gesamt} Dinge warten auf dich` : 'Nichts Offenes';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-text-tertiary transition-colors hover:bg-overlay/[0.07] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50"
                    aria-label={label}
                >
                    <Bell size={16} aria-hidden />
                    {gesamt > 0 && (
                        <span
                            aria-hidden
                            className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-500 px-1 font-mono text-[9px] font-semibold text-white"
                        >
                            {gesamt > 99 ? '99+' : gesamt}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={8} className="w-64">
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                    Was ansteht
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {gesamt === 0 ? (
                    /* Bewusst ein Satz und keine Liste mit Nullen: "0 ungelesen,
                       0 fehlgeschlagen" liest sich wie ein Bericht, obwohl die
                       Antwort schlicht "nichts" lautet. */
                    <p className="px-2 py-3 text-center text-[12px] text-text-muted">Nichts Offenes.</p>
                ) : (
                    <>
                        {ungeleseneMails > 0 && (
                            <Zeile
                                to="/mail"
                                icon={Mail}
                                text={ungeleseneMails === 1 ? 'ungelesene Nachricht' : 'ungelesene Nachrichten'}
                                anzahl={ungeleseneMails}
                            />
                        )}
                        {fehlgeschlageneAnfragen > 0 && (
                            <Zeile
                                to="/access-requests"
                                icon={KeyRound}
                                text={
                                    fehlgeschlageneAnfragen === 1
                                        ? 'Zugangsanfrage nicht zugestellt'
                                        : 'Zugangsanfragen nicht zugestellt'
                                }
                                anzahl={fehlgeschlageneAnfragen}
                                ton="warnung"
                            />
                        )}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default NotificationsBell;
