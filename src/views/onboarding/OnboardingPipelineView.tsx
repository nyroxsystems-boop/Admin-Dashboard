/**
 * OnboardingPipelineView — the operator's onboarding console.
 *
 * Answers "which of my tenants is stuck?" at a glance: a risk lamp per tenant
 * (at-risk → setup → configured → live), Time-to-Value, WhatsApp wiring and
 * plan. This is the visibility the operator never had — activation was measured
 * nowhere before. Data: GET /api/admin/onboarding-pipeline.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, MessageCircle, CheckCircle2, AlertTriangle, Clock, Settings2 } from 'lucide-react';
import { LoadingState } from '@/components/feedback/LoadingState';
import {
    NEBEN_AKTION,
    SeitenKopf,
    TABELLE_KOPF,
    TABELLE_KOPF_ZELLE,
    TABELLE_ZEILE,
    TABELLE_ZELLE,
    TabellenKarte,
} from '@/components/ui/seite';
import { STUFEN_TON, STUFE_GESAMT } from '@/utils/onboardingStufen';
import { getOnboardingPipeline, type OnboardingPipeline, type OnboardingRisk } from '@/api/onboarding';
import { SEITEN_RAND } from '@/components/ui/seite';
import { cn } from '@/lib/utils';
import { KACHEL, KACHEL_ZAHL } from '@/components/ui/dichte';

/**
 * Symbol je Stufe. Farbe und Beschriftung kommen aus STUFEN_TON — der einen
 * Quelle, die auch die Übersicht benutzt (siehe utils/onboardingStufen.ts).
 */
const RISK_ICON: Record<OnboardingRisk, typeof CheckCircle2> = {
    live: CheckCircle2,
    configured: Settings2,
    setup: Clock,
    'at-risk': AlertTriangle,
};

function fmtDate(s: string | null): string {
    if (!s) return '—';
    const t = Date.parse(s);
    if (Number.isNaN(t)) return '—';
    return new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtTta(hours: number | null): string {
    if (hours == null) return '—';
    if (hours < 48) return `${Math.round(hours)} h`;
    return `${Math.round(hours / 24)} T`;
}

export default function OnboardingPipelineView(): JSX.Element {
    const pipelineQ = useQuery({
        queryKey: ['admin', 'onboarding-pipeline'],
        queryFn: getOnboardingPipeline,
        staleTime: 30_000,
    });
    const data: OnboardingPipeline | undefined = pipelineQ.data;
    const loading = pipelineQ.isFetching;
    const error = pipelineQ.error instanceof Error ? pipelineQ.error.message : null;

    if (pipelineQ.isLoading) return <LoadingState label="Lade Onboarding-Pipeline…" />;

    const summary = data?.summary;
    // `ton`/`balken` kommen aus RISK_META, damit Stufenkarte und Statusfeld in
    // der Tabelle DIESELBE Farbe tragen. Zwei Listen mit je eigenen Farben
    // laufen sonst auseinander, und dann heisst "Gefährdet" oben rot und unten
    // orange.
    const cards: Array<{
        key: OnboardingRisk | 'total'; label: string; value: number; ton?: string; balken?: string;
    }> = [
        { key: 'total', label: 'Kunden', value: summary?.total ?? 0, ton: STUFE_GESAMT.zahl, balken: 'bg-overlay/[0.08]' },
        { key: 'at-risk', label: STUFEN_TON['at-risk'].label, value: summary?.atRisk ?? 0, ton: STUFEN_TON['at-risk'].zahl, balken: STUFEN_TON['at-risk'].balken },
        { key: 'setup', label: STUFEN_TON.setup.label, value: summary?.setup ?? 0, ton: STUFEN_TON.setup.zahl, balken: STUFEN_TON.setup.balken },
        { key: 'configured', label: STUFEN_TON.configured.label, value: summary?.configured ?? 0, ton: STUFEN_TON.configured.zahl, balken: STUFEN_TON.configured.balken },
        { key: 'live', label: 'Live (aktiviert)', value: summary?.live ?? 0, ton: STUFEN_TON.live.zahl, balken: STUFEN_TON.live.balken },
    ];

    return (
        <div className={cn(SEITEN_RAND)}>
            <SeitenKopf
                className="mb-[22px]"
                titel="Onboarding-Pipeline"
                beileile={
                    <span className="block max-w-[64ch] text-pretty">
                        Aktivierungs-Status aller Händler — Nordstern ist der erste echte WhatsApp-Verkauf.
                    </span>
                }
                aktionen={
                    <button type="button" onClick={() => void pipelineQ.refetch()} className={NEBEN_AKTION}>
                        <RefreshCw className={cn('size-[15px] shrink-0 text-text-tertiary', loading && 'animate-spin')} />
                        Aktualisieren
                    </button>
                }
            />

            {error && (
                <div className="mb-[22px] rounded-[14px] border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</div>
            )}

            {/* Stufenkarten: grosse Monospace-Zahl, Beschriftung, darunter ein
                3-px-Streifen in der Farbe der Stufe. Der Streifen macht die
                Reihe auf einen Blick lesbar, ohne dass jede Karte einen
                farbigen Rahmen braucht. */}
            <div className="mb-[22px] grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr))]">
                {cards.map((c) => (
                    /**
                      * Beschriftung links, Wert rechts — wie die Kennzahlen der
                      * Uebersicht und die Kacheln im CRM. Vorher stand der Wert
                      * OBEN und die Beschriftung darunter; bei fuenf Kacheln
                      * nebeneinander war jede breiter als ihr Inhalt, und
                      * rechts blieb die halbe Karte leer.
                      *
                      * Die Zahl kommt jetzt aus KACHEL_ZAHL. Sie stand hier auf
                      * 28-38 px, waehrend jede andere Kachel in beiden
                      * Anwendungen 22-28 px benutzt — dieselbe Sorte Karte in
                      * zwei Groessen.
                      */
                    <div
                        key={c.key}
                        className={cn('karte flex flex-col justify-between !rounded-2xl', KACHEL)}
                    >
                        <div className="flex flex-1 items-center justify-between gap-3">
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text-tertiary">
                                {c.label}
                            </span>
                            <span
                                className={cn(
                                    'shrink-0 font-mono font-bold leading-none tracking-[-0.03em] tabular-nums',
                                    KACHEL_ZAHL, c.ton ?? 'text-text-primary',
                                )}
                            >
                                {c.value}
                            </span>
                        </div>
                        <span aria-hidden className={cn('h-[3px] shrink-0 rounded-sm', c.balken ?? 'bg-overlay/[0.08]')} />
                    </div>
                ))}
            </div>

            <TabellenKarte>
                <table className="w-full min-w-[1080px] text-sm">
                    <thead className={TABELLE_KOPF}>
                        <tr>
                            <th className={TABELLE_KOPF_ZELLE}>Händler</th>
                            <th className={TABELLE_KOPF_ZELLE}>Status</th>
                            <th className={TABELLE_KOPF_ZELLE}>WhatsApp</th>
                            <th className={TABELLE_KOPF_ZELLE}>Plan</th>
                            <th className={TABELLE_KOPF_ZELLE}>Angelegt</th>
                            <th className={TABELLE_KOPF_ZELLE}>Aktiviert</th>
                            <th className={TABELLE_KOPF_ZELLE}>Time-to-Value</th>
                            <th className={TABELLE_KOPF_ZELLE}>Letzte Order</th>
                            <th className={TABELLE_KOPF_ZELLE}>AVV</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(data?.tenants ?? []).map((t) => {
                            const meta = STUFEN_TON[t.risk];
                            const Icon = RISK_ICON[t.risk];
                            return (
                                <tr key={t.tenantId} className={TABELLE_ZEILE}>
                                    <td className={TABELLE_ZELLE}>
                                        <Link to={`/tenants/${t.tenantId}`} className="font-bold text-text-primary transition-colors hover:text-accent-500">
                                            {t.name}
                                        </Link>
                                        {t.ageDays != null && t.risk === 'at-risk' && (
                                            <span className="ml-2 text-xs font-semibold text-danger">seit {t.ageDays} T offen</span>
                                        )}
                                    </td>
                                    <td className={TABELLE_ZELLE}>
                                        <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold', meta.feld)}>
                                            <Icon className="w-3 h-3" /> {meta.label}
                                        </span>
                                    </td>
                                    <td className={TABELLE_ZELLE}>
                                        {t.whatsappConfigured ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                                                <MessageCircle className="w-3 h-3" /> verbunden
                                            </span>
                                        ) : (
                                            <span className="text-xs text-text-muted">offen</span>
                                        )}
                                    </td>
                                    <td className={cn(TABELLE_ZELLE, "text-text-muted")}>{t.planId ?? '—'}</td>
                                    <td className={cn(TABELLE_ZELLE, "text-text-muted")}>{fmtDate(t.createdAt)}</td>
                                    <td className={cn(TABELLE_ZELLE, "text-text-muted")}>{fmtDate(t.activatedAt)}</td>
                                    <td className={cn(TABELLE_ZELLE, "text-text-muted")}>{fmtTta(t.timeToActivationHours)}</td>
                                    <td className={cn(TABELLE_ZELLE, "text-text-muted")}>{fmtDate(t.lastOrderAt)}</td>
                                    <td className={TABELLE_ZELLE}>
                                        {t.dpaAcceptedAt ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400" title={`${t.dpaVersion ?? ''} · ${fmtDate(t.dpaAcceptedAt)}`}>
                                                <CheckCircle2 className="w-3 h-3" /> erfasst
                                            </span>
                                        ) : (
                                            <span className="text-xs text-amber-400">offen</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {(data?.tenants ?? []).length === 0 && !loading && (
                            <tr><td colSpan={9} className="px-4 py-10 text-center text-text-muted">Keine Kunden.</td></tr>
                        )}
                    </tbody>
                </table>
            </TabellenKarte>
        </div>
    );
}
