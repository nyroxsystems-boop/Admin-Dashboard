/**
 * SettingsLayout — Sammelstelle für alles, was nicht Tagesgeschäft ist.
 *
 * Vorher lagen Admins, Audit-Log, Support-Konsole, Postfach-Rechte und Wartung
 * als eigene Einträge in der Seitenleiste. Dreizehn Punkte sind keine
 * Navigation mehr, sondern eine Liste, in der man sucht. Diese Dinge werden
 * selten gebraucht und gehören zusammen — deshalb ein Bereich mit eigener
 * Unternavigation statt fünf Einträgen im Hauptmenü.
 *
 * Zugriff: Wer keine Berechtigung für einen Bereich hat, sieht ihn hier gar
 * nicht erst — statt ihn anzuklicken und eine 403 zu bekommen.
 */
import { NavLink, Outlet } from 'react-router-dom';

import { SEITEN_RAND_OHNE_BREITE, SeitenKopf } from '@/components/ui/seite';
import { useAuth } from '@/context/AuthContext';
import {
    FileClock,
    Filter,
    Headset,
    KeyRound,
    UserCog,
    Users,
    Wrench,
    type LucideIcon,
} from 'lucide-react';

import { usePermissions } from '@/auth/usePermissions';
import { cn } from '@/lib/utils';

interface SettingsTab {
    to: string;
    label: string;
    hint: string;
    icon: LucideIcon;
    end?: boolean;
    superAdmin?: boolean;
}

const TABS: SettingsTab[] = [
    {
        to: '/einstellungen',
        label: 'Profil',
        hint: 'Eigene Angaben und E-Mail-Signatur',
        icon: UserCog,
        end: true,
    },
    {
        to: '/einstellungen/admins',
        label: 'Admins',
        hint: 'Wer Zugang zum Dashboard hat',
        icon: Users,
        superAdmin: true,
    },
    {
        to: '/einstellungen/postfaecher',
        label: 'Postfach-Rechte',
        hint: 'Wer welches Postfach liest, und die Broschüre',
        icon: KeyRound,
        superAdmin: true,
    },
    {
        to: '/einstellungen/regeln',
        label: 'Regeln & Abwesenheit',
        hint: 'Eingehende Post sortieren, Urlaubsnotiz',
        icon: Filter,
    },
    {
        to: '/einstellungen/support',
        label: 'Support-Konsole',
        hint: 'Kundenanfragen und Eskalationen',
        icon: Headset,
    },
    {
        to: '/einstellungen/audit',
        label: 'Audit-Log',
        hint: 'Was wann von wem geändert wurde',
        icon: FileClock,
    },
    {
        to: '/einstellungen/wartung',
        label: 'Wartung',
        hint: 'Systemaufgaben und Diagnose',
        icon: Wrench,
        superAdmin: true,
    },
];

/** Zwei Buchstaben aus Name oder Adresse für das Profilquadrat. */
function initialen(quelle: string): string {
    const roh = (quelle || '').split('@')[0];
    const teile = roh.split(/[\s._-]+/).filter(Boolean);
    if (teile.length === 0) return '—';
    if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase();
    return (teile[0][0] + teile[1][0]).toUpperCase();
}

export default function SettingsLayout(): JSX.Element {
    const { user } = useAuth();
    const { isSuperAdmin } = usePermissions();
    const sichtbar = TABS.filter((tab) => !tab.superAdmin || isSuperAdmin);

    return (
        <div className={cn(SEITEN_RAND_OHNE_BREITE, 'mx-auto max-w-6xl')}>
            <SeitenKopf
                className="mb-6"
                titel="Einstellungen"
                beileile="Verwaltung, Zugriffe und Diagnose — alles, was nicht ins Tagesgeschäft gehört."
            />

            {/* 296 px links wie im Entwurf (war 220): die Einträge tragen dort
                eine zweite Zeile mit Erklärung, und die braucht die Breite. */}
            <div className="grid items-start gap-4 lg:grid-cols-[296px_minmax(0,1fr)]">
                <nav aria-label="Einstellungsbereiche" className="lg:sticky lg:top-4 lg:self-start">
                    <ul className="flex gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
                        {sichtbar.map((tab) => (
                            <li key={tab.to} className="shrink-0 lg:shrink">
                                <NavLink
                                    to={tab.to}
                                    end={tab.end}
                                    className={({ isActive }) => cn(
                                        // Karten statt Listenzeilen, wie im Entwurf:
                                        // 13 px Radius, eigener Rahmen, Erklärung
                                        // in zweiter Zeile.
                                        'flex items-start gap-3 rounded-[13px] border p-3.5 transition-colors',
                                        isActive
                                            ? 'border-accent-500/30 bg-accent-500/[0.1] text-accent-500'
                                            : 'border-overlay/[0.06] bg-overlay/[0.025] text-text-secondary hover:border-overlay/[0.12] hover:text-text-primary',
                                    )}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <tab.icon className="mt-px size-4 shrink-0" />
                                            <span className="flex min-w-0 flex-col gap-1">
                                                <span className="truncate text-[12.5px] font-bold">{tab.label}</span>
                                                <span
                                                    className={cn(
                                                        'hidden text-[11px] font-medium leading-[1.35] lg:block',
                                                        isActive ? 'text-accent-500/70' : 'text-text-muted',
                                                    )}
                                                >
                                                    {tab.hint}
                                                </span>
                                            </span>
                                        </>
                                    )}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>

                <section className="flex min-w-0 flex-col gap-3.5">
                    {/* Profilkarte wie im Entwurf: 56-px-Verlaufsquadrat mit
                        Initialen, Name in 20 px Space Grotesk, Adresse in
                        Monospace, Rolle als Akzentfeld rechts.

                        Sie steht über JEDEM Unterbereich — man sieht immer, als
                        wer man gerade schaltet. Bei Rechteverwaltung ist das
                        kein Schmuck. */}
                    {user && (
                        <div className="karte flex flex-wrap items-center gap-[18px] p-6">
                            <span
                                aria-hidden
                                className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 font-display text-xl font-bold text-white shadow-[0_8px_24px_hsl(var(--accent-500)/0.36)]"
                            >
                                {initialen(user.username || user.email)}
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <span className="truncate font-display text-xl font-semibold">
                                    {user.username || '—'}
                                </span>
                                <span className="truncate font-mono text-[12px] text-text-muted">
                                    {user.email}
                                </span>
                            </div>
                            {user.role && (
                                <span className="shrink-0 rounded-lg border border-accent-500/[0.28] bg-accent-500/[0.14] px-[11px] py-[7px] font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent-500">
                                    {user.role}
                                </span>
                            )}
                        </div>
                    )}
                    <Outlet />
                </section>
            </div>
        </div>
    );
}
