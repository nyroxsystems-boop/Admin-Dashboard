/**
 * Outreach — Rundmails an ausgewählte Empfänger.
 *
 * ─── Warum die Ansicht so aufgebaut ist ────────────────────────────────────
 *
 * Eine Rundmail geht an Hunderte Adressen und ist nicht zurückholbar. Die
 * Ansicht ist deshalb nicht auf Tempo gebaut, sondern darauf, dass man vor dem
 * Absenden sieht, was passiert:
 *
 *  - Die **Empfängerzahl steht am Knopf**, nicht in einer Zeile darüber. Wer
 *    „An 217 Empfänger senden" liest, klickt anders als bei „Senden".
 *  - **Abgemeldete werden angezeigt**, aber sind nicht anwählbar. Sie
 *    wegzulassen wäre bequemer, würde aber verschleiern, warum eine bekannte
 *    Firma fehlt.
 *  - Die **Vorschau zeigt den echten Marken-Rahmen**, nicht den rohen Text.
 *    Was hier steht, kommt so beim Empfänger an.
 *  - Nach dem Versand steht das **Ergebnis je Zahl** da: zugestellt,
 *    fehlgeschlagen, übersprungen. Eine Erfolgsmeldung ohne Zahlen wäre eine
 *    Behauptung.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Mail, Search, Send, Users, X } from 'lucide-react';

import { ladeEmpfaenger, ladeKampagnen, sendeKampagne, type Empfaenger } from '@/api/outreach';
import { RichEmailEditor } from '@/components/mail/RichEmailEditor';
import { KARTE_INNEN, SEITEN_TITEL } from '@/components/ui/dichte';
import { SEITEN_RAND } from '@/components/ui/seite';
import { useMailboxes } from '@/hooks/useInbox';
import { cn } from '@/lib/utils';

export default function OutreachView(): JSX.Element {
    const qc = useQueryClient();
    const { sendingAddresses } = useMailboxes();

    const [suche, setSuche] = useState('');
    const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
    const [absender, setAbsender] = useState('');
    const [betreff, setBetreff] = useState('');
    const [inhalt, setInhalt] = useState({ html: '', text: '' });
    const [leerung, setLeerung] = useState(0);

    const empfaengerAbfrage = useQuery({
        queryKey: ['admin', 'outreach', 'empfaenger', suche] as const,
        queryFn: () => ladeEmpfaenger(suche),
        staleTime: 60_000,
    });
    const kampagnen = useQuery({
        queryKey: ['admin', 'outreach', 'kampagnen'] as const,
        queryFn: ladeKampagnen,
        staleTime: 30_000,
    });

    const alle = useMemo(() => empfaengerAbfrage.data ?? [], [empfaengerAbfrage.data]);
    const waehlbar = useMemo(() => alle.filter((e) => !e.abgemeldet), [alle]);

    /**
     * Der gewählte Absender muss ein Postfach sein, aus dem man senden DARF.
     * Das Backend prüft es noch einmal — hier steht es, damit gar nicht erst
     * etwas Unmögliches auswählbar ist.
     */
    const absenderWahl = absender || sendingAddresses[0] || '';

    const versand = useMutation({
        mutationFn: () => sendeKampagne({
            betreff: betreff.trim(),
            html: inhalt.html,
            text: inhalt.text,
            absender: absenderWahl,
            empfaenger: [...gewaehlt],
        }),
        onSuccess: () => {
            setGewaehlt(new Set());
            setBetreff('');
            setInhalt({ html: '', text: '' });
            setLeerung((n) => n + 1);
            void qc.invalidateQueries({ queryKey: ['admin', 'outreach', 'kampagnen'] });
        },
    });

    const umschalten = (email: string): void => {
        setGewaehlt((vorher) => {
            const neu = new Set(vorher);
            if (neu.has(email)) neu.delete(email); else neu.add(email);
            return neu;
        });
    };

    const alleWaehlen = (): void => {
        setGewaehlt((vorher) =>
            vorher.size === waehlbar.length ? new Set() : new Set(waehlbar.map((e) => e.email)));
    };

    const bereit = betreff.trim().length > 0
        && (inhalt.text.trim().length > 0 || inhalt.html.trim().length > 0)
        && gewaehlt.size > 0
        && absenderWahl.length > 0;

    return (
        <div className={SEITEN_RAND}>
            <header className="mb-1">
                <h1 className={cn('font-display font-semibold leading-[1.1] tracking-[-0.02em] text-text-primary', SEITEN_TITEL)}>
                    Outreach
                </h1>
                <p className="mt-1.5 text-[13px] leading-[1.45] text-text-tertiary">
                    Rundmails an ausgewählte Empfänger — im Partsunion-Rahmen, aus einem eurer Postfächer.
                </p>
            </header>

            {/* Jede Spalte verwaltet ihre Höhe selbst. So kann die lange
                Empfängerliste rechts den Verlauf links nicht mehr nach unten
                drücken und dort künstlichen Leerraum erzeugen. */}
            <div className="mt-5 grid items-start gap-3.5 lg:grid-cols-[1fr_380px]">
                <div className="flex min-w-0 flex-col gap-2">
                    {/* ─── Die Mail ─────────────────────────────────────── */}
                    <section className={cn('karte flex flex-col gap-3.5', KARTE_INNEN)}>
                    <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                                Absender
                            </span>
                            <span className="relative">
                                <select
                                    value={absenderWahl}
                                    onChange={(e) => setAbsender(e.target.value)}
                                    className={cn(
                                        'h-9 w-full appearance-none rounded-[10px] border border-overlay/[0.10]',
                                        'bg-overlay/[0.035] py-0 pl-3 pr-9 text-[13px] text-text-primary shadow-none',
                                        'transition-colors hover:border-overlay/20 hover:bg-overlay/[0.055]',
                                        'focus-visible:border-accent-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20',
                                    )}
                                >
                                    {sendingAddresses.length === 0 && <option value="">Kein Postfach mit Senderecht</option>}
                                    {sendingAddresses.map((a) => <option key={a} value={a}>{a}</option>)}
                                </select>
                                <ChevronDown
                                    aria-hidden
                                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
                                />
                            </span>
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                                Betreff
                            </span>
                            <input
                                value={betreff}
                                onChange={(e) => setBetreff(e.target.value)}
                                placeholder="z. B. Unsere Öffnungszeiten über die Feiertage"
                                className="h-9 rounded-lg border border-border-subtle bg-canvas px-2.5 text-[13px] text-text-primary placeholder:text-text-muted"
                            />
                        </label>
                    </div>

                    {/* Der Editor haelt seinen Inhalt selbst; `leerung` erzwingt
                        nach dem Versand einen frischen Editor, sonst stuende der
                        eben verschickte Text noch da. */}
                    <RichEmailEditor key={leerung} onChange={setInhalt} />

                    {versand.data && (
                        /* Zahlen statt "erfolgreich": eine Erfolgsmeldung ohne
                           Zahlen waere eine Behauptung. */
                        <p className="rounded-lg border border-success/25 bg-success/[0.07] px-3 py-2 text-[13px] text-success">
                            {versand.data.zugestellt} zugestellt
                            {versand.data.fehlgeschlagen > 0 && `, ${versand.data.fehlgeschlagen} fehlgeschlagen`}
                            {versand.data.uebersprungen > 0 && `, ${versand.data.uebersprungen} abgemeldet übersprungen`}.
                        </p>
                    )}
                    {versand.isError && (
                        <p className="rounded-lg border border-danger/25 bg-danger/[0.07] px-3 py-2 text-[13px] text-danger">
                            {(versand.error as Error)?.message || 'Der Versand ist fehlgeschlagen.'}
                        </p>
                    )}

                    <button
                        type="button"
                        disabled={!bereit || versand.isPending}
                        onClick={() => versand.mutate()}
                        className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-accent-500 px-4 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
                    >
                        <Send className="size-4" />
                        {versand.isPending
                            ? 'Wird versendet…'
                            : `An ${gewaehlt.size} ${gewaehlt.size === 1 ? 'Empfänger' : 'Empfänger'} senden`}
                    </button>
                    </section>

                    {/* ─── Was bisher rausging ─────────────────────────── */}
                    <section>
                        <h2 className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                            Bisherige Versendungen
                        </h2>
                        <div className={cn('karte', KARTE_INNEN)}>
                            {(kampagnen.data ?? []).length === 0 ? (
                                <p className="text-[12px] text-text-muted">Noch nichts versendet.</p>
                            ) : (
                                <ul className="flex flex-col gap-1.5">
                                    {(kampagnen.data ?? []).map((k) => (
                                        <li key={k.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle pb-1.5 last:border-0 last:pb-0">
                                            <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{k.betreff}</span>
                                            <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
                                                {k.zugestellt_zahl}/{k.empfaenger_zahl}
                                                {k.fehler_zahl > 0 && <span className="text-danger"> · {k.fehler_zahl} Fehler</span>}
                                            </span>
                                            <span className="font-mono text-[11px] text-text-muted">
                                                {k.versendet_am ? new Date(k.versendet_am).toLocaleString('de-DE', {
                                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                                                }) : 'nicht versendet'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>
                </div>

                {/* ─── Empfänger ────────────────────────────────────────── */}
                <section className={cn('karte flex flex-col gap-3', KARTE_INNEN)}>
                    <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-text-primary">
                            <Users className="size-4 text-text-tertiary" />
                            Empfänger
                        </span>
                        <button
                            type="button"
                            onClick={alleWaehlen}
                            className="text-[12px] text-accent-500 hover:underline"
                        >
                            {gewaehlt.size === waehlbar.length && waehlbar.length > 0 ? 'Keine' : 'Alle'}
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
                        <input
                            value={suche}
                            onChange={(e) => setSuche(e.target.value)}
                            placeholder="Firma oder Adresse"
                            className="h-9 w-full rounded-lg border border-border-subtle bg-canvas pl-8 pr-2.5 text-[13px] text-text-primary placeholder:text-text-muted"
                        />
                    </div>

                    <ul className="flex max-h-[520px] min-h-0 flex-col gap-0.5 overflow-y-auto pr-0.5">
                        {empfaengerAbfrage.isLoading && (
                            <li className="px-2 py-3 text-[12px] text-text-muted">Wird geladen…</li>
                        )}
                        {!empfaengerAbfrage.isLoading && alle.length === 0 && (
                            <li className="px-2 py-3 text-[12px] text-text-muted">Keine Firma mit Adresse gefunden.</li>
                        )}
                        {alle.map((e) => (
                            <EmpfaengerZeile
                                key={e.email}
                                daten={e}
                                gewaehlt={gewaehlt.has(e.email)}
                                onUmschalten={() => umschalten(e.email)}
                            />
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}

/** Eine Zeile in der Empfängerliste. Abgemeldete sind sichtbar, aber tot. */
function EmpfaengerZeile({
    daten, gewaehlt, onUmschalten,
}: {
    daten: Empfaenger;
    gewaehlt: boolean;
    onUmschalten: () => void;
}): JSX.Element {
    if (daten.abgemeldet) {
        return (
            <li className="flex items-center gap-2 rounded-md px-2 py-1.5 opacity-50">
                <X className="size-3.5 shrink-0 text-text-muted" />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-text-secondary line-through">{daten.firma}</span>
                    <span className="block truncate font-mono text-[10px] text-text-muted">{daten.email}</span>
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-text-muted">abgemeldet</span>
            </li>
        );
    }
    return (
        <li>
            <label className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-overlay/[0.05]',
                gewaehlt && 'bg-accent-500/[0.10]',
            )}>
                <input
                    type="checkbox"
                    checked={gewaehlt}
                    onChange={onUmschalten}
                    className="size-3.5 shrink-0 accent-[hsl(var(--accent-500))]"
                />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-text-primary">{daten.firma}</span>
                    <span className="block truncate font-mono text-[10px] text-text-muted">{daten.email}</span>
                </span>
                <Mail className="size-3 shrink-0 text-text-faint" />
            </label>
        </li>
    );
}
