import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { listAppointments } from '@/api/appointments';
import { getOnboardingPipeline } from '@/api/onboarding';
import { getAccessRequestHistory } from '@/api/accessRequests';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useMailboxes } from '@/hooks/useInbox';
import { zaehleUngeleseneMails } from '@/hooks/useOffeneSachen';
import { usePermissions } from '@/auth/usePermissions';
import { SEITEN_RAND, SeitenKopf, HAUPT_AKTION, NEBEN_AKTION } from '@/components/ui/seite';
import { auditZeile } from '@/utils/auditLabels';
import { formatRelative } from '@/utils/format/date';
import { formatCurrency } from '@/utils/format/number';
import { terminfenster } from './terminfenster';
import { merchantNextStep, merchantQueue, nextAppointments } from './operationsQueue';

const textLink = 'inline-flex items-center gap-1 text-sm font-medium text-accent-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500';
const sectionHeader = 'flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4';

/** Keep return-to-dashboard timing without tying first paint to a data request. */
function measureReturn(): void {
    const marks = performance.getEntriesByName('dashboard-klick', 'mark');
    if (!marks.length) return;
    const duration = Math.round(performance.now() - marks[marks.length - 1].startTime);
    performance.clearMarks('dashboard-klick');
    performance.clearMarks('dashboard-klick-handler');
    if (duration < 60_000) console.warn(`[Messung] Mail → Dashboard: ${duration} ms`);
}

function DataMessage({ children, retry, alert = false }: { children: ReactNode; retry?: () => void; alert?: boolean }): JSX.Element {
    return <div role={alert ? 'alert' : 'status'} className="flex flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-text-secondary">
        <span>{children}</span>{retry && <button type="button" onClick={retry} className={textLink}>Erneut laden</button>}
    </div>;
}

export default function OverviewView(): JSX.Element {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const frame = requestAnimationFrame(measureReturn);
        const minute = setInterval(() => setNow(Date.now()), 60_000);
        return () => { cancelAnimationFrame(frame); clearInterval(minute); };
    }, []);
    const { can } = usePermissions();
    const pipeline = useQuery({ queryKey: ['admin', 'onboarding-pipeline'], queryFn: getOnboardingPipeline, staleTime: 30_000 });
    const appointments = useQuery({ queryKey: ['admin', 'appointments', 'uebersicht'], queryFn: () => listAppointments(terminfenster()), staleTime: 60_000, retry: false });
    const access = useQuery({ queryKey: ['admin', 'access-requests', 'verlauf'], queryFn: () => getAccessRequestHistory(), staleTime: 60_000 });
    const metrics = useDashboardMetrics();
    const health = useSystemHealth();
    const audit = useAuditLogs();
    const mailbox = useMailboxes();
    const attention = merchantQueue(pipeline.data?.tenants ?? []);
    const failedAccess = (access.data ?? []).filter(request => request.status === 'failed');
    const upcoming = nextAppointments(appointments.data?.appointments ?? [], now).slice(0, 4);
    const unread = mailbox.isLoading || mailbox.error ? null : zaehleUngeleseneMails(mailbox.mailboxes);
    const refreshing = pipeline.isFetching || appointments.isFetching || access.isFetching;
    const refresh = (): void => {
        void pipeline.refetch(); void appointments.refetch(); void access.refetch();
        metrics.refetch(); health.refetch(); audit.refetch(); mailbox.refetch();
    };
    const facts = [
        { label: 'Händler', value: metrics.metrics?.activeTenants, to: '/tenants' },
        { label: 'Nutzer', value: metrics.metrics?.totalUsers, to: '/tenants' },
        { label: 'Bestellungen heute', value: metrics.metrics?.ordersToday, to: '/orders' },
        { label: 'Umsatz im laufenden Monat', value: metrics.metrics?.revenueMtd == null ? null : formatCurrency(metrics.metrics.revenueMtd), to: '/orders' },
    ];

    return <div className={SEITEN_RAND}>
        <SeitenKopf className="mb-6" titel="Arbeitsübersicht" beileile="Einrichtungen, Rückfragen und die nächsten Termine."
            aktionen={<><button type="button" className={NEBEN_AKTION} disabled={refreshing} onClick={refresh}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />Aktualisieren</button>{can('tenants.create') && <Link to="/tenants/new" className={HAUPT_AKTION}>Händler einrichten</Link>}</>} />

        <div className="mb-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
            <section aria-labelledby="merchant-work-title" className="min-w-0 rounded-lg border border-border bg-surface">
                <header className={sectionHeader}><div className="flex items-center gap-2"><h2 id="merchant-work-title" className="text-base font-semibold">Händler in Bearbeitung</h2>{pipeline.data && <span className="rounded border border-border px-1.5 py-0.5 text-xs tabular-nums text-text-secondary">{attention.length}</span>}</div><Link to="/onboarding" className={textLink}>Alle Einrichtungen<ArrowUpRight size={14} /></Link></header>
                {pipeline.isLoading ? <DataMessage>Einrichtungen werden geladen…</DataMessage> : pipeline.error ? <DataMessage alert retry={() => void pipeline.refetch()}>Einrichtungen konnten nicht aktualisiert werden. Der Bearbeitungsstand ist unbekannt.</DataMessage> : attention.length === 0 ? <DataMessage>Aktuell keine Händler in Einrichtung.</DataMessage> : <div>
                    <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_80px] gap-4 border-b border-border bg-canvas/50 px-5 py-2 text-xs font-medium text-text-muted md:grid"><span>Händler</span><span>Nächster Schritt</span><span>Offen seit</span></div>
                    {attention.slice(0, 7).map(tenant => <Link key={tenant.tenantId} to={'/tenants/' + encodeURIComponent(tenant.tenantId) + '?tab=onboarding'} className="grid gap-2 border-b border-border px-5 py-4 last:border-0 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_80px] md:items-center md:gap-4">
                        <div className="min-w-0"><span className="block truncate font-medium text-text-primary">{tenant.name}</span>{tenant.risk === 'at-risk' && <span className="mt-1 block text-xs text-danger">Betreuung erforderlich</span>}</div>
                        <span className="text-sm text-text-secondary">{merchantNextStep(tenant)}</span><span className="text-xs tabular-nums text-text-muted">{tenant.ageDays == null ? 'Unbekannt' : tenant.ageDays + ' Tage'}</span>
                    </Link>)}
                </div>}
                {pipeline.dataUpdatedAt > 0 && <p className="border-t border-border px-5 py-2.5 text-xs text-text-muted">Datenstand {new Date(pipeline.dataUpdatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · Zuerst Betreuungsbedarf, dann älteste Einrichtung</p>}
            </section>

            <div className="space-y-5 xl:col-start-2 xl:row-span-3">
                <section className="rounded-lg border border-border bg-surface" aria-labelledby="communications-title">
                    <header className={sectionHeader}><h2 id="communications-title" className="text-base font-semibold">Kommunikation</h2></header>
                    <Link to="/mail" className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-canvas"><span><span className="block font-medium">Posteingang</span><span className="mt-1 block text-xs text-text-muted">{unread == null ? 'Postfachstatus nicht verfügbar' : 'Ungelesene Nachrichten in deinen Postfächern'}</span></span><span className="text-lg font-semibold tabular-nums">{unread ?? '—'}</span></Link>
                    <Link to="/access-requests" className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 hover:bg-canvas"><span><span className="block font-medium">Zugangsanfragen</span><span className="mt-1 block text-xs text-text-muted">{access.error ? 'Versandstatus nicht verfügbar' : 'Fehlgeschlagene Zustellungen prüfen'}</span></span><span className={'text-lg font-semibold tabular-nums ' + (failedAccess.length ? 'text-danger' : '')}>{access.isLoading || access.error ? '—' : failedAccess.length}</span></Link>
                </section>
                <section className="rounded-lg border border-border bg-surface" aria-labelledby="appointments-title">
                    <header className={sectionHeader}><h2 id="appointments-title" className="text-base font-semibold">Nächste Termine</h2><Link to="/calendar" className={textLink}>Kalender<ArrowUpRight size={14} /></Link></header>
                    {appointments.isLoading ? <DataMessage>Termine werden geladen…</DataMessage> : appointments.error ? <DataMessage alert retry={() => void appointments.refetch()}>Termine derzeit nicht verfügbar.</DataMessage> : !upcoming.length ? <DataMessage>Keine anstehenden Termine im aktuellen Zweiwochenfenster.</DataMessage> : <ul>{upcoming.map(appointment => <li key={appointment.id} className="border-b border-border last:border-0"><Link to="/calendar" className="block px-5 py-3.5 hover:bg-canvas"><span className="text-xs tabular-nums text-text-muted">{new Date(appointment.start_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{appointment.status === 'proposed' ? ' · Bestätigung ausstehend' : ''}</span><span className="mt-1 block font-medium">{appointment.title || 'Termin'}</span><span className="mt-1 block text-xs text-text-muted">{[appointment.customer_name, appointment.assignee_name].filter(Boolean).join(' · ') || 'Noch nicht zugeordnet'}</span></Link></li>)}</ul>}
                </section>
            </div>
        <section aria-labelledby="platform-facts-title" className="rounded-lg border border-border bg-surface xl:col-start-1">
            <header className={sectionHeader}><h2 id="platform-facts-title" className="text-sm font-semibold text-text-secondary">Plattformzahlen</h2>{Boolean(metrics.error) && <span role="status" className="text-xs text-warning">Aktualisierung fehlgeschlagen; vorhandene Werte können veraltet sein.</span>}</header>
            <dl className="grid grid-cols-2 divide-x divide-border lg:grid-cols-4">{facts.map(fact => <div key={fact.label} className="px-5 py-4"><dt className="text-xs text-text-muted">{fact.label}</dt><dd className="mt-1.5 text-lg font-semibold tabular-nums"><Link to={fact.to} className="hover:text-accent-600">{fact.value ?? '—'}</Link></dd></div>)}</dl>
            {!metrics.isLoading && facts.some(fact => fact.value == null) && <p className="border-t border-border px-5 py-2.5 text-xs text-text-muted">— bedeutet: keine belastbaren Daten verfügbar, nicht null Bestellungen oder Umsatz.</p>}
        </section>

        <section aria-labelledby="activity-title" className="rounded-lg border border-border bg-surface xl:col-start-1">
            <header className={sectionHeader}><h2 id="activity-title" className="text-base font-semibold">Letzte Änderungen</h2>{can('audit.read') && <Link to="/einstellungen/audit" className={textLink}>Protokoll öffnen<ArrowUpRight size={14} /></Link>}</header>
            {audit.isLoading ? <DataMessage>Protokoll wird geladen…</DataMessage> : audit.error ? <DataMessage alert retry={audit.refetch}>Protokoll derzeit nicht verfügbar.</DataMessage> : !audit.entries.length ? <DataMessage>Keine Änderungen im aktuellen Abruf.</DataMessage> : <ul>{audit.entries.slice(0, 5).map(entry => <li key={entry.id} className="flex items-start justify-between gap-4 border-b border-border px-5 py-3 last:border-0"><span className="min-w-0 break-words text-sm">{entry.admin_username || 'System'} · {auditZeile(entry)}</span><time className="shrink-0 text-xs text-text-muted" dateTime={entry.created_at}>{entry.created_at ? formatRelative(entry.created_at) : 'Zeitpunkt unbekannt'}</time></li>)}</ul>}
        </section>
        </div>
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted"><span>{health.isLoading ? 'API-Erreichbarkeit wird geprüft…' : health.error || !health.zustand ? 'API-Erreichbarkeit unbekannt' : health.zustand.erreichbar ? 'API erreichbar' : 'API nicht erreichbar'} · Keine Aussage über einzelne Dienste</span><button type="button" className="hover:text-text-primary hover:underline" onClick={health.refetch}>Erneut prüfen</button></footer>
    </div>;
}
