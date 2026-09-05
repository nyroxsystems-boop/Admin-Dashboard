import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, Search, Plus, CheckCircle2, Circle } from 'lucide-react';
import { getOnboardingPipeline, type OnboardingHealthRow, type OnboardingRisk } from '@/api/onboarding';
import { STUFEN_TON } from '@/utils/onboardingStufen';
import { usePermissions } from '@/auth/usePermissions';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { SEITEN_RAND, SeitenKopf, HAUPT_AKTION, NEBEN_AKTION, TabellenKarte, TABELLE_KOPF, TABELLE_KOPF_ZELLE, TABELLE_ZEILE, TABELLE_ZELLE } from '@/components/ui/seite';
import { cn } from '@/lib/utils';

function nextStep(tenant: OnboardingHealthRow): string {
    if (!tenant.dpaAcceptedAt) return 'Auftragsverarbeitung dokumentieren';
    if (!tenant.planId) return 'Tarif und Vertrag zuordnen';
    if (!tenant.whatsappConfigured) return 'WhatsApp verbinden und testen';
    if (tenant.risk !== 'live') return 'Einrichtung prüfen und Übergabe freigeben';
    return 'Betrieb und letzte Bestellungen prüfen';
}

export default function OnboardingPipelineView(): JSX.Element {
    const query = useQuery({ queryKey: ['admin', 'onboarding-pipeline'], queryFn: getOnboardingPipeline, staleTime: 30_000 });
    const { can } = usePermissions();
    const [risk, setRisk] = useState<OnboardingRisk | 'all'>('all');
    const [search, setSearch] = useState('');
    const [missing, setMissing] = useState('all');
    const [sort, setSort] = useState('attention');
    const tenants = useMemo(() => (query.data?.tenants ?? []).filter(tenant =>
        (risk === 'all' || tenant.risk === risk)
        && tenant.name.toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE').trim())
        && (missing === 'all' || (missing === 'dpa' && !tenant.dpaAcceptedAt) || (missing === 'whatsapp' && !tenant.whatsappConfigured) || (missing === 'plan' && !tenant.planId)),
    ).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'de')
        : sort === 'oldest' ? (b.ageDays ?? 0) - (a.ageDays ?? 0)
        : Number(b.risk === 'at-risk') - Number(a.risk === 'at-risk') || Number(a.risk === 'live') - Number(b.risk === 'live') || (b.ageDays ?? 0) - (a.ageDays ?? 0)), [query.data, risk, search, missing, sort]);
    const counts: { key: OnboardingRisk | 'all'; label: string; value: number | undefined }[] = [
        { key: 'all', label: 'Alle Händler', value: query.data?.summary.total },
        { key: 'at-risk', label: 'Handlungsbedarf', value: query.data?.summary.atRisk },
        { key: 'setup', label: 'In Einrichtung', value: query.data?.summary.setup },
        { key: 'configured', label: 'Konfiguriert', value: query.data?.summary.configured },
        { key: 'live', label: 'Aktiviert', value: query.data?.summary.live },
    ];
    return <div className={SEITEN_RAND}>
        <SeitenKopf className="mb-6" titel="Einrichtungen" beileile="Voraussetzungen prüfen und Händler zur Übergabe vorbereiten." aktionen={<>
            <button className={NEBEN_AKTION} type="button" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw size={15} className={query.isFetching ? 'animate-spin' : ''} />Aktualisieren</button>
            {can('tenants.create') && <Link to="/tenants/new" className={HAUPT_AKTION}><Plus size={16} />Händler einrichten</Link>}
        </>} />
        <div aria-label="Einrichtungen filtern" className="mb-5 flex gap-1 overflow-x-auto border-b border-border">{counts.map(item => <button key={item.key} type="button" aria-pressed={risk === item.key} onClick={() => setRisk(item.key)} className={cn('flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium', risk === item.key ? 'border-accent-600 text-accent-600' : 'border-transparent text-text-secondary hover:text-text-primary')}><span>{item.label}</span><span className="rounded border border-border px-1.5 py-0.5 text-xs tabular-nums">{item.value ?? '—'}</span></button>)}</div>
        <div className="mb-4 flex flex-wrap gap-3">
            <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3"><Search size={16} className="text-text-muted" /><input className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Händler suchen" placeholder="Händler suchen…" value={search} onChange={event => setSearch(event.target.value)} /></label>
            <select aria-label="Fehlende Voraussetzung" className="h-10 rounded-md border border-border bg-surface px-3 text-sm" value={missing} onChange={event => setMissing(event.target.value)}><option value="all">Alle Voraussetzungen</option><option value="dpa">AVV fehlt</option><option value="whatsapp">WhatsApp fehlt</option><option value="plan">Tarif fehlt</option></select>
            <select aria-label="Sortierung" className="h-10 rounded-md border border-border bg-surface px-3 text-sm" value={sort} onChange={event => setSort(event.target.value)}><option value="attention">Handlungsbedarf zuerst</option><option value="oldest">Älteste Einrichtung zuerst</option><option value="name">Händlername A–Z</option></select>
        </div>
        {query.isLoading ? <LoadingState label="Einrichtungen werden geladen…" /> : query.error ? <ErrorState title="Einrichtungen nicht verfügbar" message="Die Händlerdaten konnten nicht geladen werden." onRetry={() => void query.refetch()} /> : <>
            <p className="mb-3 text-xs text-text-muted">{tenants.length} von {query.data?.tenants.length ?? 0} Händlern · Aktivierung wird anhand des ersten Verkaufs gemessen. Die interne Freigabe ist im Händlerdatensatz dokumentiert.</p>
            <TabellenKarte><table className="w-full min-w-[950px]"><thead className={TABELLE_KOPF}><tr>{['Händler', 'Aktivierung', 'Voraussetzungen', 'Nächster Schritt', 'Offen seit', ''].map((label, index) => <th key={`${label}:${index}`} className={TABELLE_KOPF_ZELLE} scope="col">{label}</th>)}</tr></thead><tbody>{tenants.map(tenant => <tr key={tenant.tenantId} className={TABELLE_ZEILE}>
                <td className={TABELLE_ZELLE}><Link to={`/tenants/${tenant.tenantId}`} className="font-semibold text-text-primary hover:text-accent-500">{tenant.name}</Link><p className="mt-1 text-xs text-text-muted">{tenant.planId || 'Noch kein Tarif'}</p></td>
                <td className={TABELLE_ZELLE}><span className={cn('inline-flex rounded-md border px-2 py-1 text-xs font-medium', STUFEN_TON[tenant.risk].feld)}>{STUFEN_TON[tenant.risk].label}</span></td>
                <td className={TABELLE_ZELLE}><div className="space-y-1.5">{[{ label: 'WhatsApp', done: tenant.whatsappConfigured }, { label: 'AVV', done: Boolean(tenant.dpaAcceptedAt) }].map(check => <span key={check.label} className={cn('flex items-center gap-1.5 text-xs', check.done ? 'text-success' : 'text-text-muted')}>{check.done ? <CheckCircle2 size={13} /> : <Circle size={13} />}{check.label}</span>)}</div></td>
                <td className={TABELLE_ZELLE}><span className="text-sm">{nextStep(tenant)}</span></td>
                <td className={TABELLE_ZELLE}>{tenant.risk === 'live' ? 'Abgeschlossen' : tenant.ageDays == null ? '—' : `${tenant.ageDays} Tagen`}</td>
                <td className={TABELLE_ZELLE}><Link to={`/tenants/${tenant.tenantId}?tab=onboarding`} className="whitespace-nowrap text-sm font-medium text-accent-500 hover:underline">Einrichtung öffnen →</Link></td>
            </tr>)}{tenants.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-sm text-text-muted">Keine Händler für diese Auswahl. <button type="button" className="ml-2 font-medium text-accent-600 hover:underline" onClick={() => { setSearch(''); setRisk('all'); setMissing('all'); }}>Filter zurücksetzen</button></td></tr>}</tbody></table></TabellenKarte>
        </>}
    </div>;
}
