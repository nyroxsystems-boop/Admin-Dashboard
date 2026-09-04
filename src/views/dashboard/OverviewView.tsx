/**
 * OverviewView — Startseite des Admin-Dashboards.
 *
 * Neu aufgebaut: Vorher war das eine reine Kennzahlenwand. Eine Startseite
 * sollte aber die Frage „was mache ich als Nächstes" beantworten, nicht nur
 * „wie stehen die Zahlen".
 *
 * Aufbau von oben nach unten:
 *   1. Begrüßung mit Systemzustand — sofort sichtbar, ob etwas klemmt
 *   2. Was liegt an — ungelesene Post, offene Zugangsanfragen: die Dinge,
 *      die auf jemanden warten
 *   3. Kennzahlen mit Verlauf
 *   4. Bereiche — die Einstiegspunkte, seit die Seitenleiste schlank ist
 *   5. Letzte Änderungen aus dem Audit-Log
 *
 * Das Mailsystem steht bewusst weit oben: es ist seit der Umstellung das
 * einzige Mailprogramm der Firma und läuft als eigene Anwendung unter /mail.
 */
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    Building2,
    Calendar,
    CalendarCheck2,
    Clock,
    KeyRound,
    Mail,
    Rocket,
    Search,
    Settings,
    ShoppingCart,
    TrendingUp,
    Users,
    type LucideIcon,
} from 'lucide-react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { terminfenster, wochenStart } from './terminfenster';
import { HERO, HERO_TITEL, KACHEL, KACHEL_ZAHL, KARTE_INNEN } from '@/components/ui/dichte';

import { listAppointments, type Appointment } from '@/api/appointments';
import { getOnboardingPipeline } from '@/api/onboarding';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useMailboxes } from '@/hooks/useInbox';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/auth/usePermissions';
import { ErrorState } from '@/components/feedback/ErrorState';
import { formatCurrency } from '@/utils/format/number';
import { formatRelative } from '@/utils/format/date';
import { auditZeile } from '@/utils/auditLabels';
import { STUFEN_TON, STUFE_GESAMT } from '@/utils/onboardingStufen';
import { cn } from '@/lib/utils';
import { SEITEN_RAND } from '@/components/ui/seite';

/**
 * Zahl, die beim Erscheinen hochzaehlt.
 *
 * Beachtet die Systemeinstellung "Bewegung reduzieren". Wer sie gesetzt hat,
 * tut das meist aus einem Grund — Schwindel, Migraene, Aufmerksamkeit. Eine
 * zappelnde Zahl ist dann keine nette Geste, sondern eine Zumutung. In dem
 * Fall steht der Wert sofort da.
 */
/**
 * Die Zahl steht sofort da. Punkt.
 *
 * Hier stand ein Zaehlwerk: 0,9 Sekunden von 0 zum Zielwert. Erst bei jedem
 * Aufbau, dann — mein Fix — nur beim "ersten der Sitzung". Der Denkfehler:
 * nach jedem Neuladen IST es der erste der Sitzung. Der Nutzer laedt neu,
 * klickt auf Dashboard, und die Show laeuft wieder. Sein Wunsch war
 * woertlich: "ich will da drauf klicken und direkt beim dashboard sein."
 *
 * Der Filmstreifen der Probemessung hat es belegt: eine Sekunde nach der
 * Ankunft standen die Kennzahlen noch auf 0|0|0|0, die echten Werte waren
 * laengst im Cache. Ein Zaehlwerk ist fuer den Betrachter nicht von Ladezeit
 * zu unterscheiden — es IST wahrgenommene Ladezeit, 0,9 Sekunden davon.
 *
 * Der Name bleibt, damit die Aufrufstellen unveraendert sind; animiert wird
 * nichts mehr.
 */
function AnimatedCounter({ value, format }: { value: number; format?: (n: number) => string }): JSX.Element {
    return <span className="font-mono tabular-nums">{format ? format(value) : Math.round(value).toString()}</span>;
}


/**
 * Verlaufslinie mit Flaeche darunter und markiertem Endpunkt.
 *
 * Eine blosse Linie liest sich als Zierde. Erst die Flaeche macht klar, dass
 * es um eine Menge geht, und der Punkt zeigt, wo "jetzt" ist — sonst sucht das
 * Auge das Ende der Linie.
 *
 * Die Farbe folgt der Richtung: steigend im Akzent, fallend gedaempft. Nicht
 * rot — bei manchen Kennzahlen ist Sinken voellig in Ordnung, und eine rote
 * Linie behauptete etwas, das wir nicht wissen.
 */
function Sparkline({ data, steigend }: { data: number[]; steigend: boolean }): JSX.Element {
    if (data.length === 0) return <svg className="h-5 w-full" aria-hidden />;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const w = 200;
    const h = 40;
    const step = w / Math.max(data.length - 1, 1);
    const punkte = data.map((v, i) => [i * step, h - ((v - min) / range) * h] as const);
    const linie = punkte.map(([x, y]) => `${x},${y}`).join(' ');
    const flaeche = `0,${h} ${linie} ${w},${h}`;
    const [ex, ey] = punkte[punkte.length - 1];
    const farbe = steigend ? 'hsl(var(--accent-500))' : 'hsl(var(--text-muted))';
    const id = `spark-${steigend ? 'auf' : 'ab'}`;

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="h-5 w-full overflow-visible" aria-hidden="true" preserveAspectRatio="none">
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={farbe} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={farbe} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon fill={`url(#${id})`} points={flaeche} />
            <polyline
                fill="none"
                stroke={farbe}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={linie}
                vectorEffect="non-scaling-stroke"
            />
            <circle cx={ex} cy={ey} r="2.5" fill={farbe} vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

/** Veraenderung vom ersten zum letzten Wert, in Prozent. Null bei zu wenig Daten. */
function veraenderung(daten: number[] | undefined): number | null {
    if (!daten || daten.length < 2) return null;
    const [erst, letzt] = [daten[0], daten[daten.length - 1]];
    if (erst === 0) return letzt === 0 ? 0 : null;
    return ((letzt - erst) / Math.abs(erst)) * 100;
}

/**
 * Name für die Begrüßung.
 *
 * Die Vorlage zeigt "Gute Nacht, Aaron." und der Name MUSS sich nach der
 * Anmeldung richten. Heute stehen in `admin_users` bereits saubere Vornamen
 * (Aaron, Elias, Bardia, Fecat), `username` genügt also.
 *
 * Die Rückfallregeln sind für später: wird irgendwann ein Konto als
 * `aaron.vogt` oder mit E-Mail als Kennung angelegt, soll da nicht
 * "Gute Nacht, aaron.vogt@partsunion.de." stehen.
 */
function anzeigeName(user: { username?: string | null; email?: string | null } | null): string | null {
    const roh = user?.username?.trim() || user?.email?.trim();
    if (!roh) return null;
    // Vor dem @, Punkte und Unterstriche als Worttrenner, nur den Vornamen.
    const vorne = roh.split('@')[0].split(/[._-]+/).filter(Boolean)[0];
    if (!vorne) return null;
    return vorne[0].toUpperCase() + vorne.slice(1);
}

/**
 * Ein Satz zur Lage — statt des festen Satzes aus dem Entwurf.
 *
 * In der Vorlage stand "Posteingang ist gelesen, keine offenen
 * Zugangsanfragen. Nächster Termin in 3 Tagen — A-V-G Autozubehör." Das war
 * Beispieltext. Fest verdrahtet wäre er eine Behauptung, die auch dann noch
 * dasteht, wenn 40 Mails ungelesen sind.
 */
interface TagesfokusModell {
    label: string;
    titel: string;
    detail: string;
    to?: string;
    icon: LucideIcon;
}

function gleicherTag(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

/**
 * Persönlicher Tagesfokus statt einer globalen Posteingangszahl.
 *
 * Ein Termin gehört zum Benutzer, wenn er ihm zugewiesen ist. Bei älteren,
 * noch unzugewiesenen Terminen gilt der Ersteller als zuständig. Termine
 * anderer Kollegen dürfen hier nie als persönliche Aufgabe erscheinen.
 */
function tagesfokus(
    termine: Appointment[],
    jetzt: Date,
    user: { id: string; username?: string | null } | null,
    ungelesen: number,
): TagesfokusModell {
    const userId = user?.id ? String(user.id) : '';
    const userName = user?.username?.trim().toLocaleLowerCase('de-DE') || '';
    const istPersoenlich = (termin: Appointment): boolean => {
        if (!userId && !userName) return false;
        if (termin.assignee_id) {
            return String(termin.assignee_id) === userId
                || termin.assignee_name?.trim().toLocaleLowerCase('de-DE') === userName;
        }
        return String(termin.created_by_id || '') === userId
            || termin.created_by_name?.trim().toLocaleLowerCase('de-DE') === userName;
    };
    const erledigt = new Set(['cancelled', 'declined', 'completed', 'no_show']);
    const kommende = termine
        .filter((termin) => istPersoenlich(termin)
            && !erledigt.has(termin.status)
            && new Date(termin.start_at) >= jetzt)
        .sort((a, b) => a.start_at.localeCompare(b.start_at));
    const heute = kommende.filter((termin) => gleicherTag(new Date(termin.start_at), jetzt));
    const naechsterHeute = heute[0];

    if (naechsterHeute) {
        const beginn = new Date(naechsterHeute.start_at);
        const detail = [
            naechsterHeute.customer_name,
            naechsterHeute.location,
            heute.length > 1 ? `danach noch ${heute.length - 1}` : null,
        ].filter(Boolean).join(' · ') || 'Details im Kalender';
        return {
            label: `Dein nächster Termin · ${beginn.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
            titel: naechsterHeute.title,
            detail,
            to: '/calendar',
            icon: CalendarCheck2,
        };
    }

    const naechster = kommende[0];
    if (naechster) {
        const beginn = new Date(naechster.start_at);
        return {
            label: 'Dein Tagesfokus',
            titel: 'Heute keine Termine',
            detail: `Nächster Termin: ${beginn.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })} um ${beginn.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · ${naechster.title}`,
            to: '/calendar',
            icon: CalendarCheck2,
        };
    }

    if (ungelesen > 0) {
        return {
            label: 'Dein Tagesfokus',
            titel: 'Posteingang kurz aufräumen',
            detail: `${ungelesen} ungelesene ${ungelesen === 1 ? 'Nachricht wartet' : 'Nachrichten warten'} auf dich.`,
            to: '/mail',
            icon: Mail,
        };
    }

    return {
        label: 'Dein Tagesfokus',
        titel: 'Heute ist alles erledigt',
        detail: 'Keine persönlichen Termine oder offenen Nachrichten.',
        icon: CalendarCheck2,
    };
}

function Tagesfokus({ fokus }: { fokus: TagesfokusModell }): JSX.Element {
    const Icon = fokus.icon;
    const inhalt = (
        <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-500/[0.12] text-accent-500">
                <Icon className="size-[17px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-accent-500">
                    {fokus.label}
                </span>
                <span className="mt-1 block truncate font-display text-[15px] font-semibold text-text-primary">
                    {fokus.titel}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-text-muted">{fokus.detail}</span>
            </span>
            {fokus.to && <ArrowRight className="size-4 shrink-0 text-text-faint" aria-hidden />}
        </>
    );

    const klasse = 'flex items-center gap-3 lg:border-l lg:border-overlay/[0.09] lg:py-1 lg:pl-8';
    return fokus.to ? (
        <Link to={fokus.to} className={cn(klasse, 'group rounded-xl transition-colors hover:text-text-primary')}>
            {inhalt}
        </Link>
    ) : <div className={klasse}>{inhalt}</div>;
}

/**
 * Betrag für eine Kennzahlenkarte — ohne Cent.
 *
 * Die Karten sind im Entwurf mindestens 228 px breit und die Zahl steht in
 * 34 px Monospace. "48.320,00 €" sind elf Zeichen und liefen aus der Karte
 * heraus (nachgemessen: 199 px Inhalt in 188 px Platz). Im Entwurf standen dort
 * "14" und "4" — kurze Zahlen; unsere echten Beträge sind länger.
 *
 * Die Cent gehören ohnehin nicht in eine Übersichtskachel. Wer sie braucht,
 * schaut in die Berichte; hier zählt die Größenordnung.
 */
function betragKurz(n: number): string {
    return formatCurrency(n, 'de-DE', 'EUR', 0);
}

function greeting(): string {
    const hour = new Date().getHours();
    if (hour < 5) return 'Gute Nacht';
    if (hour < 11) return 'Guten Morgen';
    if (hour < 18) return 'Guten Tag';
    return 'Guten Abend';
}

/**
 * Schnellzugriff im Begrüßungsbereich.
 *
 * Dunkler als die Karte darunter (`bg-canvas/55`), damit die Kacheln sich vom
 * Akzentverlauf des Begrüssungsbereichs abheben statt darin zu verschwimmen —
 * so macht es die Vorlage auch.
 */
/**
 * Abschnittsmarke: Mono-Versalien, dahinter eine auslaufende Linie.
 *
 * Die Linie steht so im Entwurf und tut mehr als sie aussieht: sie trennt die
 * Abschnitte ohne einen vollen Strich, der die Seite in Kästen zerlegen würde.
 */
function AbschnittMarke({ children, aktion }: { children: string; aktion?: ReactNode }): JSX.Element {
    return (
        <div className="mb-3.5 flex items-baseline gap-3">
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                {children}
            </h2>
            <span
                aria-hidden
                className="h-px flex-1 bg-gradient-to-r from-overlay/[0.09] to-transparent"
            />
            {aktion}
        </div>
    );
}

/**
 * Wochenstreifen — sieben Tage mit Terminzahl.
 *
 * Der Balken unter jedem Tag zeigt die Auslastung im Verhältnis zum vollsten
 * Tag der Woche, nicht zu einer festen Obergrenze. Bei einem Termin am Dienstag
 * und keinem sonst wäre ein Balken gegen "10 Termine" nur ein Strich, den
 * niemand sieht.
 */
function WochenStreifen({ termine, heute }: { termine: Appointment[]; heute: Date }): JSX.Element {
    // Montag dieser Woche — dieselbe Quelle wie der Abruf (terminfenster.ts).
    const start = wochenStart(heute);

    const tage = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const n = termine.filter((t) => {
            const ts = new Date(t.start_at);
            return ts.getFullYear() === d.getFullYear()
                && ts.getMonth() === d.getMonth()
                && ts.getDate() === d.getDate();
        }).length;
        return { d, n, istHeute: d.toDateString() === heute.toDateString() };
    });
    const max = Math.max(1, ...tage.map((t) => t.n));

    return (
        <div className="grid grid-cols-7 gap-2">
            {tage.map(({ d, n, istHeute }) => (
                <div
                    key={d.toISOString()}
                    className={cn(
                        'flex flex-col items-center gap-2.5 rounded-[13px] border px-1.5 py-3',
                        istHeute
                            ? 'border-accent-500/40 bg-accent-500/10'
                            : 'border-overlay/[0.06] bg-overlay/[0.025]',
                    )}
                >
                    <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
                        {d.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2)}
                    </span>
                    <span
                        className={cn(
                            'font-display text-[17.5px] font-semibold leading-none',
                            // Auch hier durchscheinend (bg-accent-500/10) —
                            // deckendes Weiss wäre im Hellmodus unsichtbar.
                            istHeute ? 'text-accent-500' : n > 0 ? 'text-text-primary' : 'text-text-muted',
                        )}
                    >
                        {d.getDate()}
                    </span>
                    <span className="flex h-[5px] w-full overflow-hidden rounded-[3px] bg-overlay/[0.05]">
                        {n > 0 && (
                            <span
                                className={cn('h-full rounded-[3px]', istHeute ? 'bg-accent-500' : 'bg-accent-600')}
                                style={{ width: `${(n / max) * 100}%` }}
                            />
                        )}
                    </span>
                    <span
                        className={cn(
                            'font-mono text-[10px] font-medium',
                            n > 0 ? 'text-text-tertiary' : 'text-text-faint',
                        )}
                    >
                        {n > 0 ? n : '–'}
                    </span>
                </div>
            ))}
        </div>
    );
}

/** Farbe je Terminart — dieselben Töne wie im Entwurf. */
const TERMIN_TON: Record<string, { balken: string; feld: string }> = {
    quali: { balken: 'bg-accent-500', feld: 'bg-accent-500/[0.16] text-accent-500' },
    sales: { balken: 'bg-success', feld: 'bg-success/[0.14] text-success' },
    call: { balken: 'bg-warning', feld: 'bg-warning/[0.14] text-warning' },
    other: { balken: 'bg-text-faint', feld: 'bg-overlay/[0.06] text-text-muted' },
};
const TERMIN_ART: Record<string, string> = {
    quali: 'QUALI', sales: 'SALES', call: 'CALL', other: 'TERMIN',
};

/** Die nächsten Termine — im Entwurf "ANSTEHEND". */
function AnstehendeTermine({ termine }: { termine: Appointment[] }): JSX.Element {
    if (termine.length === 0) {
        return (
            <p className="py-4 text-center text-[12px] text-text-muted">
                Keine Termine in den nächsten Tagen.
            </p>
        );
    }
    return (
        <div className="flex flex-col">
            {termine.map((t) => {
                const d = new Date(t.start_at);
                const ton = TERMIN_TON[t.type] ?? TERMIN_TON.other;
                const abgesagt = t.status === 'cancelled' || t.status === 'declined';
                return (
                    <Link
                        key={t.id}
                        to="/calendar"
                        className="flex items-center gap-3.5 rounded-[11px] px-2.5 py-3 transition-colors hover:bg-overlay/[0.04]"
                    >
                        <span className="flex w-[52px] shrink-0 flex-col items-center gap-0.5">
                            <span className="font-display text-[14px] font-bold leading-none text-text-primary">
                                {d.getDate()}
                            </span>
                            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-text-faint">
                                {d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')}
                            </span>
                        </span>
                        <span aria-hidden className={cn('h-[34px] w-0.5 shrink-0 rounded-sm', ton.balken)} />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span
                                className={cn(
                                    'truncate text-[12.5px] font-semibold',
                                    abgesagt ? 'text-text-muted line-through' : 'text-text-primary',
                                )}
                            >
                                {t.title}
                            </span>
                            <span className="truncate text-[11px] font-medium text-text-muted">
                                {[
                                    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                                    t.customer_name,
                                    t.assignee_name,
                                ].filter(Boolean).join(' · ')}
                            </span>
                        </span>
                        <span className={cn('shrink-0 rounded-[7px] px-2 py-1.5 font-mono text-[10px] font-bold', ton.feld)}>
                            {TERMIN_ART[t.type] ?? 'TERMIN'}
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}

/**
 * Onboarding-Pipeline als Stufenbalken.
 *
 * Die Stufen kommen aus /api/admin/onboarding-pipeline und heissen dort
 * total/setup/configured/live/atRisk — im Entwurf stehen genau diese fünf.
 */
function OnboardingStufen(): JSX.Element {
    const { data } = useQuery({
        queryKey: ['admin', 'onboarding', 'pipeline'] as const,
        queryFn: () => getOnboardingPipeline(),
        staleTime: 60_000,
        retry: false,
    });

    const s = data?.summary;
    // Farben aus utils/onboardingStufen.ts — dieselbe Quelle wie die
    // Onboarding-Ansicht. Getrennt gepflegt liefen sie sofort auseinander.
    const stufen = [
        { label: STUFE_GESAMT.label, n: s?.total ?? 0, farbe: STUFE_GESAMT.balken },
        { label: STUFEN_TON.setup.label, n: s?.setup ?? 0, farbe: STUFEN_TON.setup.balken },
        { label: STUFEN_TON.configured.label, n: s?.configured ?? 0, farbe: STUFEN_TON.configured.balken },
        { label: STUFEN_TON.live.label, n: s?.live ?? 0, farbe: STUFEN_TON.live.balken },
        { label: STUFEN_TON['at-risk'].label, n: s?.atRisk ?? 0, farbe: STUFEN_TON['at-risk'].balken },
    ];
    const max = Math.max(1, ...stufen.map((x) => x.n));

    return (
        <div className="flex flex-col gap-3.5">
            <h3 className="font-display text-[16px] font-semibold">Onboarding-Pipeline</h3>
            {!data ? (
                <p className="text-[12px] text-text-muted">Wird geladen…</p>
            ) : (
                stufen.map((st) => (
                    <div key={st.label} className="flex items-center gap-3">
                        <span className="min-w-0 shrink basis-[104px] truncate text-xs font-medium text-text-tertiary">
                            {st.label}
                        </span>
                        <span className="flex h-2 min-w-6 flex-1 overflow-hidden rounded-[5px] bg-overlay/[0.05]">
                            {st.n > 0 && (
                                <span className={cn('h-full rounded-[5px]', st.farbe)} style={{ width: `${(st.n / max) * 100}%` }} />
                            )}
                        </span>
                        <span
                            className={cn(
                                'w-6 shrink-0 text-right font-mono text-[12px] font-bold tabular-nums',
                                st.n > 0 ? 'text-text-primary' : 'text-text-faint',
                            )}
                        >
                            {st.n}
                        </span>
                    </div>
                ))
            )}
        </div>
    );
}

/** Eine Zeile im Systemfeld: Punkt, Bezeichnung, Zustand als Wort. */
function SystemZeile({ label, status }: { label: string; status: 'ok' | 'degraded' | 'down' }): JSX.Element {
    const ton = {
        ok: { punkt: 'bg-success shadow-[0_0_8px_hsl(var(--success))]', wort: 'Normal' },
        degraded: { punkt: 'bg-warning shadow-[0_0_8px_hsl(var(--warning))]', wort: 'Eingeschränkt' },
        down: { punkt: 'bg-danger shadow-[0_0_8px_hsl(var(--danger))]', wort: 'Ausfall' },
    }[status];
    return (
        <div className="flex items-center gap-2.5">
            <span aria-hidden className={cn('size-[7px] shrink-0 rounded-full', ton.punkt)} />
            <span className="flex-1 text-[12px] font-medium text-text-secondary">{label}</span>
            <span className="font-mono text-[11px] font-medium text-text-muted">{ton.wort}</span>
        </div>
    );
}

interface AreaCard {
    to: string;
    label: string;
    hint: string;
    icon: LucideIcon;
    superAdmin?: boolean;
}

const AREAS: AreaCard[] = [
    { to: '/tenants', label: 'Kunden', hint: 'Mandanten, Limits, Zugänge', icon: Building2 },
    { to: '/onboarding', label: 'Onboarding', hint: 'Neue Kunden einrichten', icon: Rocket },
    { to: '/access-requests', label: 'Zugänge', hint: 'Anfragen an Großhändler', icon: KeyRound },
    { to: '/calendar', label: 'Kalender', hint: 'Termine und Rückrufe', icon: Calendar },
    { to: '/oem-finder', label: 'OEM-Finder', hint: 'Teilenummern nachschlagen', icon: Search },
    { to: '/einstellungen', label: 'Einstellungen', hint: 'Admins, Rechte, Audit, Wartung', icon: Settings },
];

/**
 * Rueckweg-Messung: vom Klick auf "Dashboard" bis zum ersten gezeichneten
 * Bild dieser Ansicht — die Zahl, um die es in drei Fehlerrunden ging.
 *
 * Sie landet als eine Zeile in der Konsole, mit Aufschluesselung, welche
 * Abfragen zu dem Zeitpunkt schon im Cache lagen. Damit unterscheiden wir
 * endlich "die Daten fehlten" von "die Darstellung hat getroedelt" — und
 * niemand raet mehr.
 *
 * Absichtlich dauerhaft drin und nicht nur im Entwicklungsmodus: das Problem
 * zeigt sich beim Nutzer, nicht auf der Entwicklermaschine.
 */
function rueckwegMessen(qc: ReturnType<typeof useQueryClient>): void {
    /**
     * Zwei Bildwechsel abwarten: nach dem zweiten ist der erste Aufbau
     * tatsaechlich auf dem Bildschirm, nicht nur im Speicher.
     *
     * In einem VERSTECKTEN Tab feuert requestAnimationFrame nie — dort faellt
     * die Messung auf setTimeout zurueck, sonst bleibt die Marke liegen und
     * wird beim NAECHSTEN Besuch mitgemessen. Genau das ist bei der ersten
     * Probemessung passiert: Marke gesetzt, Tab unsichtbar, nie ausgewertet.
     */
    const naechstesBild = (fn: () => void): void => {
        if (document.visibilityState === 'hidden') setTimeout(fn, 0);
        else requestAnimationFrame(fn);
    };
    naechstesBild(() => naechstesBild(() => {
        const marken = performance.getEntriesByName('dashboard-klick', 'mark');
        if (marken.length === 0) return; // direkter Aufruf, kein Rueckweg
        const start = marken[marken.length - 1].startTime;
        /**
         * Stau = Hardware-Zeit des Klicks bis zum Lauf des Klick-Handlers.
         * Ist er gross, war der Hauptthread im MAILPROGRAMM blockiert, als
         * der Klick kam — die Ursache liegt dann dort, nicht hier.
         */
        const handler = performance.getEntriesByName('dashboard-klick-handler', 'mark');
        const stau = handler.length > 0
            ? Math.max(0, Math.round(handler[handler.length - 1].startTime - start))
            : 0;
        performance.clearMarks('dashboard-klick');
        performance.clearMarks('dashboard-klick-handler');
        const dauer = Math.round(performance.now() - start);
        // Eine Marke, die aelter ist als eine Minute, stammt von einem Klick,
        // dessen Auswertung nie lief — sie zu melden waere eine Falschmessung.
        if (dauer > 60_000) return;

        const frisch = (schluessel: readonly unknown[]): string => {
            const zustand = qc.getQueryState(schluessel);
            if (!zustand || zustand.dataUpdatedAt === 0) return 'leer';
            return `${Math.round((Date.now() - zustand.dataUpdatedAt) / 1000)}s alt`;
        };

        /**
         * Zweite Zeile: wann war WELCHE Abfrage wirklich da?
         *
         * Zeile 1 misst bis zum ersten Bild. Der Nutzer erlebt "2-3 Sekunden"
         * aber MANCHMAL — vermutlich, bis die Zahlen stehen. Diese Zeile
         * stoppt je Abfrage die Zeit vom Klick bis zur Datenankunft. Steht
         * dort einmal "Kennzahlen 2400ms", ist der Fall geloest; stehen dort
         * lauter kleine Zahlen, war es nicht der Datenweg. Kein Raten mehr.
         */
        const alleSchluessel: ReadonlyArray<readonly [string, readonly unknown[]]> = [
            ['Kennzahlen', ['admin', 'dashboard', 'metrics']],
            ['Zustand', ['admin', 'system', 'health']],
            ['Termine', ['admin', 'appointments', 'uebersicht']],
            ['Audit', ['admin', 'audit', {}]],
            ['Postfaecher', ['admin', 'inbox', 'mailboxes']],
        ];
        const klickEpoch = Date.now() - dauer;
        let versuche = 0;
        const nachlauf = setInterval(() => {
            versuche += 1;
            const offen = alleSchluessel.some(([, k]) => {
                const z = qc.getQueryState(k);
                return z ? z.fetchStatus === 'fetching' : false;
            });
            if (offen && versuche < 100) return;
            clearInterval(nachlauf);
            const teile = alleSchluessel.map(([name, k]) => {
                const z = qc.getQueryState(k);
                if (!z || z.dataUpdatedAt === 0) return `${name} NIE`;
                const seitKlick = z.dataUpdatedAt - klickEpoch;
                return seitKlick <= 0 ? `${name} vorher` : `${name} ${Math.round(seitKlick)}ms`;
            });
            // eslint-disable-next-line no-console
            console.warn(`[Messung] Daten nach Klick: ${teile.join(', ')}`);
        }, 100);

        /**
         * warn statt info: der Produktionsbau entfernt console.info
         * (pure-Liste in vite.config). Eine Messung, die im Produktionsbau
         * verschwindet, misst genau dort nicht, wo das Problem auftritt.
         */
        // eslint-disable-next-line no-console
        console.warn(
            `[Messung] Mail → Dashboard: ${dauer} ms`
            + (stau > 50 ? ` — DAVON ${stau} ms STAU VOR DEM KLICK (Hauptthread im Mailprogramm blockiert)` : '')
            + ' '
            + `(Kennzahlen ${frisch(['admin', 'dashboard', 'metrics'])}, `
            + `Zustand ${frisch(['admin', 'system', 'health'])}, `
            + `Termine ${frisch(['admin', 'appointments', 'uebersicht'])}, `
            + `Audit ${frisch(['admin', 'audit', {}])})`,
        );
    }));
}

export default function OverviewView(): JSX.Element {
    const qcMessung = useQueryClient();
    useEffect(() => {
        rueckwegMessen(qcMessung);
    }, [qcMessung]);

    const { user } = useAuth();
    const { isSuperAdmin } = usePermissions();
    const { metrics, error, refetch } = useDashboardMetrics();
    const { zustand: lebenszeichen } = useSystemHealth();
    const { entries: audit } = useAuditLogs();
    const mailboxes = useMailboxes();

    const ungelesen = mailboxes.mailboxes.find((m) => m.id === 'all')?.unread ?? 0;
    const name = anzeigeName(user);

    // Termine dieser und der kommenden Woche — für den Wochenstreifen und die
    // Liste darunter. Ein Abruf für beides, statt zweimal dasselbe zu holen.
    const { data: termineDaten } = useQuery({
        queryKey: ['admin', 'appointments', 'uebersicht'] as const,
        // Zeitraum aus terminfenster.ts — dieselbe Quelle, aus der das
        // Mailprogramm diesen Abruf vorwaermt. Zwei getrennte Rechnungen
        // wuerden irgendwann auseinanderlaufen, ohne dass es auffaellt.
        queryFn: () => listAppointments(terminfenster()),
        staleTime: 60_000,
        retry: false,
    });
    const termine = termineDaten?.appointments ?? [];
    // Einmal pro Darstellung, damit Datumszeile und Begrüssung nicht aus zwei
    // verschiedenen Momenten stammen.
    const jetzt = new Date();
    const fokus = tagesfokus(termine, jetzt, user, ungelesen);

    if (error && !metrics) {
        return <ErrorState message="Die Übersicht konnte nicht geladen werden." onRetry={refetch} />;
    }

    /**
     * Ohne Daten wird NICHT die ganze Seite weiss.
     *
     * Hier stand `if (isLoading && !metrics) return <LoadingState …>` — die
     * Übersicht verschwand komplett, bis beide Abrufe zurück waren. Beim
     * Rückweg aus dem Mailprogramm war das der sichtbare Teil der Wartezeit:
     * nicht die 100 ms Umlaufzeit, sondern eine leere Seite, die nichts
     * darüber sagt, ob überhaupt etwas passiert.
     *
     * Die Begrüssung braucht keine Abrufe — sie kennt Uhrzeit und angemeldeten
     * Benutzer sofort. Sie steht deshalb sofort da, und darunter zeigen
     * Platzhalter, wo gleich Zahlen erscheinen. Der Wechsel fühlt sich damit
     * unmittelbar an, obwohl die Daten genauso lange brauchen.
     *
     * Der Regelfall ist ohnehin ein anderer: seit gcTime auf einer halben
     * Stunde steht (App.tsx), liegen die Zahlen beim Zurückkommen meistens
     * noch im Zwischenspeicher und stehen ohne jede Wartezeit da.
     */
    const laedt = !metrics;

    const areas = AREAS.filter((a) => !a.superAdmin || isSuperAdmin);

    return (
        <div className={cn(SEITEN_RAND)}>
            {/* ── 1. Begrüßung ── */}
            <section
                className={cn('relative overflow-hidden rounded-[22px] border border-[var(--hero-rand)] bg-[image:var(--hero-verlauf)]', HERO)}
                aria-labelledby="uebersicht-begruessung"
            >
                {/* Lichtschein oben rechts. Rein dekorativ, deshalb aria-hidden
                    und pointer-events-none: er liegt über der Karte. */}
                <span
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-32 size-[420px] rounded-full bg-[radial-gradient(closest-side,var(--hero-schein),transparent)]"
                />
                {/* Ohne Schnellaktionen nutzt der Text die gesamte Breite:
                    Begrüssung links, aktuelle Lage rechts. Die Trennlinie gibt
                    dem breiten Bereich Struktur, ohne wieder eine Kachel
                    einzuführen. Auf kleinen Ansichten stehen beide untereinander. */}
                <div className="relative grid items-center gap-x-8 gap-y-3 lg:grid-cols-[minmax(22rem,1fr)_minmax(18rem,0.65fr)]">
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-accent-500">
                            <span
                                aria-hidden
                                className="size-1.5 shrink-0 rounded-full bg-accent-500 shadow-[0_0_10px_hsl(var(--accent-500))]"
                            />
                            {jetzt.toLocaleDateString('de-DE', {
                                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                            })}
                        </p>
                        <h1
                            id="uebersicht-begruessung"
                            className={cn('font-display font-semibold leading-[1.05] tracking-[-0.025em] text-pretty', HERO_TITEL)}
                        >
                            {greeting()}{name ? `, ${name}` : ''}.
                        </h1>
                    </div>
                    <Tagesfokus fokus={fokus} />
                </div>
            </section>

            {/* ── 2. Kennzahlen ── */}
            <section className="mb-7" aria-label="Kennzahlen">
                <AbschnittMarke>KENNZAHLEN</AbschnittMarke>
                {/* auto-fit statt sm:2 / lg:4 — der Entwurf bemisst die
                    Spaltenzahl am Platz (minmax(228px,1fr)), nicht am Fenster.
                    Mit eingeklappter Seitenleiste passen so vier Karten schon
                    früher, ohne dass es einen eigenen Umbruchpunkt braucht. */}
                <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(228px,100%),1fr))]">
                    <KpiCard icon={Building2} label="Aktive Kunden" value={metrics?.activeTenants ?? 0} laedt={laedt} />
                    <KpiCard icon={Users} label="Nutzer gesamt" value={metrics?.totalUsers ?? 0} laedt={laedt} />
                    <KpiCard
                        icon={ShoppingCart}
                        label="Bestellungen heute"
                        value={metrics?.ordersToday ?? 0}
                        series={metrics?.seriesOrders7d}
                        laedt={laedt}
                    />
                    <KpiCard
                        icon={TrendingUp}
                        label="Umsatz laufender Monat"
                        value={metrics?.revenueMtd ?? 0}
                        format={betragKurz}
                        series={metrics?.seriesRevenue7d}
                        laedt={laedt}
                    />
                </div>
            </section>

            {/* ── 3. Diese Woche · Onboarding · System ── */}
            <section
                className="mb-7 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]"
                aria-label="Woche, Onboarding und Systemzustand"
            >
                <div className={cn('karte flex flex-col gap-3.5', KARTE_INNEN)}>
                    <div className="flex items-center gap-3">
                        <h3 className="font-display text-[16px] font-semibold">Diese Woche</h3>
                        <span className="flex-1" />
                        <Link to="/calendar" className="text-xs font-semibold text-accent-500 hover:text-accent-200">
                            Kalender öffnen →
                        </Link>
                    </div>

                    <WochenStreifen termine={termine} heute={jetzt} />

                    <div aria-hidden className="mt-auto h-px bg-overlay/[0.06]" />

                    <div>
                        <p className="pb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                            Anstehend
                        </p>
                        {/* Nur was noch kommt, höchstens drei — der Rest steht im
                            Kalender. Eine Übersicht, die alles zeigt, zeigt nichts. */}
                        <AnstehendeTermine
                            termine={termine
                                .filter((t) => new Date(t.start_at) >= jetzt)
                                .sort((a, b) => a.start_at.localeCompare(b.start_at))
                                .slice(0, 3)}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-3.5">
                    <div className={cn('karte', KARTE_INNEN)}>
                        <OnboardingStufen />
                    </div>
                    <div className={cn('karte flex flex-1 flex-col gap-3.5', KARTE_INNEN)}>
                        <h3 className="font-display text-[16px] font-semibold">System</h3>
                        {/**
                          * Eine Zeile statt drei — und ein Satz dazu, was das
                          * heisst. Datenbank und Redis standen hier als
                          * Einzelzeilen, obwohl die Adresse, die sie liefern
                          * sollte, nie existiert hat (siehe api/health.ts).
                          * Lieber eine belegbare Auskunft als drei erfundene.
                          */}
                        {lebenszeichen ? (
                            <>
                                <SystemZeile
                                    label="API"
                                    status={lebenszeichen.erreichbar ? 'ok' : 'down'}
                                />
                                <p className="mt-auto pt-1 text-[11px] leading-snug text-text-muted">
                                    Von aussen ist nur erkennbar, ob die API antwortet.
                                    Einzelwerte zu Datenbank und Warteschlange sind bewusst
                                    nicht oeffentlich.
                                </p>
                            </>
                        ) : (
                            <p className="text-[12px] text-text-muted">Zustand wird geprüft…</p>
                        )}
                    </div>
                </div>
            </section>

            {/* ── 4. Bereiche ── */}
            <section className="mb-7" aria-label="Bereiche">
                <AbschnittMarke>BEREICHE</AbschnittMarke>
                {/* Der Entwurf setzt hier fest drei Spalten. Übernommen ab
                    `md`; darunter zwei bzw. eine, sonst wären die Karten auf
                    einem Telefon 130 px breit. */}
                <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3">
                    {areas.map((area) => (
                        <Link
                            key={area.to}
                            to={area.to}
                            className="karte group flex items-center gap-3.5 !rounded-2xl p-5"
                        >
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-overlay/[0.07] bg-overlay/[0.055] text-text-tertiary transition-colors group-hover:border-accent-500/40 group-hover:text-accent-500">
                                <area.icon className="size-[18px]" aria-hidden />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="truncate text-[13.5px] font-bold text-text-primary">{area.label}</span>
                                <span className="text-xs font-medium leading-[1.35] text-text-muted">{area.hint}</span>
                            </span>
                            <ArrowRight
                                className="size-4 shrink-0 text-text-faint transition-transform motion-safe:group-hover:translate-x-0.5"
                                aria-hidden
                            />
                        </Link>
                    ))}
                </div>
            </section>

            {/* ── 6. Letzte Änderungen ── */}
            <section aria-label="Letzte Änderungen">
                <AbschnittMarke
                    aktion={
                        <Link to="/einstellungen/audit" className="text-xs font-semibold text-accent-500 hover:text-accent-200">
                            Audit-Log
                        </Link>
                    }
                >
                    LETZTE ÄNDERUNGEN
                </AbschnittMarke>
                {audit.length === 0 ? (
                    /* Gestrichelter Leerzustand wie im Entwurf: eine leere Karte
                       sieht nach Fehler aus, eine gestrichelte nach "hier kommt
                       noch etwas". */
                    <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-overlay/10 bg-overlay/[0.014] px-6 py-[52px]">
                        <span className="flex size-11 items-center justify-center rounded-[13px] bg-overlay/[0.045] text-text-faint">
                            <Clock className="size-5" aria-hidden />
                        </span>
                        <span className="text-sm font-semibold text-text-tertiary">Noch keine Einträge</span>
                    </div>
                ) : (
                    <ul className="divide-y divide-border-subtle overflow-hidden karte-klein">
                        {audit.slice(0, 6).map((entry, index) => (
                            <li key={entry.id ?? index} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                                <span className="min-w-0 flex-1 truncate text-text-secondary">
                                    <span className="text-text-primary">
                                        {entry.admin_username || entry.admin_user || 'System'}
                                    </span>
                                    {' · '}
                                    {auditZeile(entry)}
                                </span>
                                {(entry.created_at || entry.timestamp) && (
                                    <time className="shrink-0 text-xs text-text-muted">
                                        {formatRelative((entry.created_at || entry.timestamp) as string)}
                                    </time>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function KpiCard({
    icon: Icon,
    label,
    value,
    format,
    series,
    laedt,
}: {
    icon: LucideIcon;
    label: string;
    value: number;
    format?: (n: number) => string;
    series?: number[];
    /**
     * Noch keine Zahl da. Zeigt einen Balken an der Stelle, wo sie erscheint,
     * statt einer 0 — eine 0 wäre eine Aussage, und zwar eine falsche.
     */
    laedt?: boolean;
}): JSX.Element {
    const delta = veraenderung(series);
    const steigend = (delta ?? 0) >= 0;

    return (
        <div
            className={cn(
                // Hoehe und Innenabstand aus dichte.ts — eine Stelle fuer
                // alle Kacheln, siehe Kommentar dort.
                'karte group relative flex h-full flex-col overflow-hidden', KACHEL,
            )}
        >
            {/* Leichter Lichtschein von oben. Gibt der Karte Tiefe, ohne dass
                ein Rahmen oder Schatten noetig waere — beides wirkt in einer
                dunklen Oberflaeche schnell schmutzig. */}
            <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent"
            />

            {/* Verlauf als Streifen am unteren Rand — siehe Begruendung
                weiter unten. `pointer-events-none`, damit er die Karte nicht
                anfassbar macht, wo gar nichts zu klicken ist. */}
            {series && series.length > 1 && (
                <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-5 opacity-70">
                    <Sparkline data={series} steigend={steigend} />
                </span>
            )}

            {/**
              * ─── Beschriftung links, Wert RECHTS ───────────────────────────
              *
              * Der Wert stand unter der Beschriftung. Bei einer Karte, die im
              * Raster rund 390 px breit wird, sass damit alles links oben und
              * rechts daneben blieb die halbe Karte leer — die Flaeche, die im
              * Bild auffiel.
              *
              * Eine ein- bis dreistellige Zahl fuellt keine 390 px. Also nutzt
              * sie die Breite statt der Hoehe: Beschriftung links, Wert am
              * rechten Rand. Die Karte wird dabei flacher, weil beides in
              * EINER Zeile steht.
              *
              * `min-w-0` und `truncate` an der Beschriftung: sonst schiebt ein
              * langer Text wie "Umsatz laufender Monat" den Wert aus der Karte,
              * statt selbst zu kuerzen.
              */}
            <div className="flex flex-1 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-[9px]">
                    <Icon className={cn('size-4 shrink-0', steigend ? 'text-accent-500' : 'text-text-muted')} />
                    <span className="truncate text-xs font-semibold leading-tight text-text-tertiary">{label}</span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {delta !== null && Math.abs(delta) >= 0.5 && (
                        <span
                            className={cn(
                                'rounded-md px-1.5 py-1 font-mono text-[10px] font-bold tabular-nums',
                                steigend ? 'bg-accent-500/[0.16] text-accent-500' : 'bg-overlay/[0.06] text-text-muted',
                            )}
                            title="Veränderung über den gezeigten Zeitraum"
                        >
                            {steigend ? '+' : '−'}{Math.abs(delta).toFixed(0)} %
                        </span>
                    )}

                    {laedt ? (
                        /* Ein Balken in der Breite einer Zahl. Eine 0 waere hier
                           eine Behauptung — und ausgerechnet bei "Aktive Kunden"
                           die falsche, wie der Fehler von heute gezeigt hat. */
                        <div
                            className="h-[clamp(1.375rem,1.9vw,1.75rem)] w-16 animate-pulse rounded-md bg-overlay/[0.08]"
                            role="status"
                            aria-label={`${label} wird geladen`}
                        />
                    ) : (
                        <p className={cn('font-mono font-bold leading-none tracking-[-0.03em] tabular-nums text-text-primary', KACHEL_ZAHL)}>
                            <AnimatedCounter value={value} format={format} />
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
