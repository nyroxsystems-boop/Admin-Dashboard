/**
 * TenantsListView — Multi-Tenant overview list.
 *
 * Features:
 *   - Search + status filter (active / inactive / payment-status)
 *   - Bulk select via checkbox column (bulk deactivate with confirm)
 *   - Right-Click context menu (Edit / Audit / Impersonate / Disable)
 *   - Status-LED per row
 *   - Quick-Action: + New Tenant (routes to /tenants/new)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Building2, ClipboardList, CreditCard, PauseCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

import {
    useTenants,
    useDeactivateTenant,
    useActivateTenant,
    useSuspendTenant,
    useUnsuspendTenant,
    useDeleteTenant,
    useRestoreTenant,
    usePurgeTenant,
} from '@/hooks/useTenants';
import { useImpersonate } from '@/hooks/useImpersonate';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermissions } from '@/auth/usePermissions';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import {
    FilterPille,
    HAUPT_AKTION,
    SUCH_EINGABE,
    SUCH_FELD,
    SeitenKopf,
    TABELLE_KOPF,
    TABELLE_KOPF_ZELLE,
    TABELLE_ZEILE,
    TABELLE_ZELLE,
    TabellenKarte,
} from '@/components/ui/seite';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Button } from '@/components/ui/button';
import type { Tenant } from '@/api/types';
import {
    presentTenantPaymentStatus,
    type TenantPaymentTone,
} from './tenantStatus';
import {
    removeSuccessfulTenantSelections,
    settleTenantLifecycleBatch,
} from './tenantLifecycle';
import { SEITEN_RAND } from '@/components/ui/seite';
import { cn } from '@/lib/utils';
import { directorySummary, filterDirectory, setupComplete, setupLabel, csvField, type DirectoryStatus as StatusFilter, type DirectorySetup, type DirectoryKind } from './tenantDirectory';

type LifecycleAction = 'activate' | 'deactivate';


/** A tenant counts as payment-suspended when the billing lockout is active. */
function isSuspended(t: Pick<Tenant, 'payment_status'>): boolean {
    return t.payment_status?.trim().toLowerCase() === 'suspended';
}

const PAYMENT_TONE_CLASS: Record<TenantPaymentTone, string> = {
    success: 'bg-status-success/10 text-status-success',
    info: 'bg-accent-500/[0.12] text-accent-500',
    warning: 'bg-status-warning/10 text-status-warning',
    danger: 'bg-status-danger-muted text-status-danger',
    neutral: 'bg-surface text-text-secondary border border-border',
};

/** Zahlungsstatus-Badge ohne Informationsverlust (Trial/Overdue/Suspended). */
function PaymentStatusBadge({ tenant }: { tenant: Tenant }): JSX.Element {
    const payment = presentTenantPaymentStatus(tenant.payment_status);
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_TONE_CLASS[payment.tone]}`}
        >
            <span className="inline-block size-1.5 rounded-full bg-current" aria-hidden="true" />
            {payment.label}
        </span>
    );
}

/** Filterpillen der Kunden-Ansicht — Reihenfolge wie im Entwurf. */
const STATUS_FILTER: { wert: StatusFilter; label: string }[] = [
    { wert: 'all', label: 'Alle' },
    { wert: 'active', label: 'Aktiv' },
    { wert: 'inactive', label: 'Inaktiv' },
    { wert: 'trial', label: 'Trial' },
    { wert: 'overdue', label: 'Zahlung klären' },
    { wert: 'deleted', label: 'Gelöscht' },
];

/**
 * Initialen für das Symbolfeld der Zeile.
 *
 * Zwei Buchstaben aus den ersten beiden Wörtern; bei einem Wort die ersten
 * zwei Zeichen. "A-V-G Autozubehör" wird so zu "AA" und nicht zu "A-".
 */

/**
 * Auslastungszelle: Zahl über einem 4-px-Balken.
 *
 * Steht so im Entwurf. Der Balken trägt die Aussage, die die Zahl allein nicht
 * hat: "4/10" und "4/6" lesen sich fast gleich, sind aber 40 % gegen 67 %.
 */
function Auslastung({ wert, von, balken }: { wert: number; von: number; balken: string }): JSX.Element {
    const valid = Number.isFinite(wert) && wert >= 0 && Number.isFinite(von) && von > 0;
    const ratio = valid ? wert / von : 0;
    return <div className="w-20 space-y-1.5">
        <span className="whitespace-nowrap text-sm tabular-nums text-text-secondary">{Number.isFinite(wert) ? wert : '—'} <span className="text-text-muted">/ {Number.isFinite(von) ? von : '—'}</span></span>
        {valid && <div aria-hidden className="h-1 overflow-hidden rounded-full bg-elevated"><div className={cn('h-full rounded-full', ratio > 1 ? 'bg-status-danger' : ratio >= 0.9 ? 'bg-status-warning' : balken)} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>}
    </div>;
}

export default function TenantsListView(): JSX.Element {
    const nav = useNavigate();
    const { can } = usePermissions();
    const [params, setParams] = useSearchParams();
    const latestParams = useRef(params);
    useEffect(() => { latestParams.current = params; }, [params]);
    const search = params.get('q') ?? '';
    // Router parameter setters do not queue updates like React state. Merge
    // rapid consecutive controls against the last requested URL, not a stale render.
    const changeFilter = (key: string, value: string) => {
        const next = new URLSearchParams(latestParams.current);
        if (!value || value === 'all') next.delete(key); else next.set(key, value);
        next.delete('page');
        latestParams.current = next;
        setParams(next, { replace: true });
    };
    const setSearch = (value: string) => changeFilter('q', value);
    const debounced = useDebounce(search, 200);
    const statusFilter: StatusFilter = STATUS_FILTER.some(filter => filter.wert === params.get('status')) ? params.get('status') as StatusFilter : 'all';
    const setStatusFilter = (value: StatusFilter) => changeFilter('status', value);
    const sort = ['name', 'attention', 'newest'].includes(params.get('sort') ?? '') ? params.get('sort')! : 'name';
    const setSort = (value: string) => changeFilter('sort', value);
    const setup: DirectorySetup = ['open', 'completed'].includes(params.get('setup') ?? '') ? params.get('setup') as DirectorySetup : 'all';
    const kind: DirectoryKind = ['customer', 'demo'].includes(params.get('kind') ?? '') ? params.get('kind') as DirectoryKind : 'all';
    const pageSize = [25, 50, 100].includes(Number(params.get('size'))) ? Number(params.get('size')) : 25;
    // Der "Gelöscht"-Filter lädt die Liste inkl. Soft-Deleted-Tombstones,
    // damit Restore möglich ist; alle anderen Filter sehen sie nie.
    const showDeleted = statusFilter === 'deleted';
    const { tenants, isLoading, error, refetch } = useTenants({ includeDeleted: showDeleted });
    const deactivateMut = useDeactivateTenant();
    const activateMut = useActivateTenant();
    const suspendMut = useSuspendTenant();
    const unsuspendMut = useUnsuspendTenant();
    const deleteMut = useDeleteTenant();
    const restoreMut = useRestoreTenant();
    const purgeMut = usePurgeTenant();
    const impersonateMut = useImpersonate();

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tenantId: string } | null>(null);
    const [confirmSuspend, setConfirmSuspend] = useState<Tenant | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Tenant | null>(null);
    const [confirmPurge, setConfirmPurge] = useState<Tenant | null>(null);
    const [confirmLifecycle, setConfirmLifecycle] = useState<{
        tenant: Tenant;
        action: LifecycleAction;
    } | null>(null);
    const [confirmBulkDeactivate, setConfirmBulkDeactivate] = useState(false);
    const [bulkLifecycleBusy, setBulkLifecycleBusy] = useState(false);

    const filtered = useMemo(() => filterDirectory(tenants, { search: debounced, status: statusFilter, setup, kind, sort }), [tenants, debounced, statusFilter, setup, kind, sort]);
    const summary = useMemo(() => directorySummary(tenants), [tenants]);
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const requestedPage = Number(params.get('page'));
    const page = Math.min(pages, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
    const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
    const setPage = (value: number) => { const next = new URLSearchParams(latestParams.current); next.set('page', String(value)); latestParams.current = next; setParams(next, { replace: true }); };
    const hasFilters = Boolean(search || statusFilter !== 'all' || setup !== 'all' || kind !== 'all');
    const listState = { tenantListSearch: params.toString() };

    const selectableFiltered = useMemo(
        () => filtered.filter((tenant) => !tenant.deleted),
        [filtered],
    );
    const selectedLifecycleIds = useMemo(
        () => selectableFiltered.filter((tenant) => selected.has(tenant.id)).map((tenant) => tenant.id),
        [selectableFiltered, selected],
    );
    const contextTenant = ctxMenu
        ? tenants.find((tenant) => tenant.id === ctxMenu.tenantId) ?? null
        : null;

    function toggleSelect(id: string): void {
        setSelected((s) => {
            const next = new Set(s);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function handleContextMenu(e: React.MouseEvent, tenantId: string): void {
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY, tenantId });
    }

    function handleUnsuspend(tenant: Tenant): void {
        if (!can('billing.manage')) return;
        unsuspendMut.mutate(tenant.id, {
            onSuccess: () => toast.success(`${tenant.name} reaktiviert.`),
            onError: (err) =>
                toast.error(err instanceof Error ? err.message : 'Reaktivieren fehlgeschlagen.'),
        });
    }

    function handleImpersonate(tenantId: string): void {
        impersonateMut.mutate(
            { tenantId },
            {
                onSuccess: () => {
                    toast.success('Impersonation gestartet.');
                },
                onError: (err) => {
                    toast.error(
                        err instanceof Error ? err.message : 'Impersonation fehlgeschlagen.',
                    );
                },
            }
        );
    }

    async function handleLifecycleConfirm(): Promise<void> {
        if (!confirmLifecycle) return;
        const { tenant, action } = confirmLifecycle;
        try {
            if (action === 'deactivate') await deactivateMut.mutateAsync(tenant.id);
            else await activateMut.mutateAsync(tenant.id);

            toast.success(
                action === 'deactivate'
                    ? `${tenant.name} deaktiviert.`
                    : `${tenant.name} aktiviert.`,
            );
            setConfirmLifecycle(null);
        } catch (err) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : action === 'deactivate'
                      ? 'Deaktivieren fehlgeschlagen.'
                      : 'Aktivieren fehlgeschlagen.',
            );
        }
    }

    async function handleBulkDeactivate(): Promise<void> {
        const targetIds = selectedLifecycleIds;
        if (targetIds.length === 0) {
            setConfirmBulkDeactivate(false);
            return;
        }

        setBulkLifecycleBusy(true);
        try {
            const { successfulIds, failures } = await settleTenantLifecycleBatch(
                targetIds,
                (id) => deactivateMut.mutateAsync(id),
            );
            // Only completed rows leave the selection. Failed rows remain
            // selected so the operator can retry without reconstructing it.
            setSelected((current) =>
                removeSuccessfulTenantSelections(current, successfulIds),
            );

            if (failures.length === 0) {
                toast.success(`${successfulIds.length} Kunden deaktiviert.`);
            } else if (successfulIds.length === 0) {
                toast.error(
                    `Keiner der ${failures.length} Kunden konnte deaktiviert werden. Auswahl bleibt bestehen.`,
                );
            } else {
                toast.warning(
                    `${successfulIds.length} deaktiviert, ${failures.length} fehlgeschlagen. Fehlgeschlagene bleiben ausgewählt.`,
                );
            }
            setConfirmBulkDeactivate(false);
        } finally {
            setBulkLifecycleBusy(false);
        }
    }

    if (isLoading) return <LoadingState label="Lade Kunden…" />;
    if (error) return <ErrorState message="Kunden konnten nicht geladen werden." onRetry={refetch} />;

    /**
     * CSV der gefilterten Liste — der Entwurf zeigt den Knopf, ohne zu sagen,
     * was er tut. Ausgegeben wird genau das, was gerade in der Tabelle steht:
     * ein Export, der etwas anderes liefert als die Ansicht, stiftet Verwirrung.
     *
     * Semikolon als Trenner und BOM davor, weil Excel in deutscher
     * Voreinstellung sonst alles in eine Spalte legt und Umlaute zerlegt.
     */
    const csvExportieren = () => {
        const kopf = ['Name', 'Slug', 'Status', 'Nutzer', 'Max Nutzer', 'Geräte', 'Max Geräte', 'Onboarding'];
        const zeilen = filtered.map((t) => [
            t.name, t.slug, t.is_active ? 'Aktiv' : 'Inaktiv',
            t.user_count, t.max_users, t.device_count, t.max_devices,
            t.onboarding_status ?? '',
        ].map(csvField).join(';'));
        const inhalt = '\uFEFF' + [kopf.join(';'), ...zeilen].join('\r\n');
        const url = URL.createObjectURL(new Blob([inhalt], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `kunden-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const workViews = [
        { label: 'Alle Händler', count: summary.total, query: '', icon: Building2, tone: 'text-accent-500 bg-accent-500/10', active: !hasFilters },
        { label: 'Einrichtung offen', count: summary.setup, query: 'setup=open', icon: ClipboardList, tone: 'text-status-info bg-status-info/10', active: setup === 'open' && statusFilter === 'all' && !search && kind === 'all' },
        { label: 'Zahlung klären', count: summary.payment, query: 'status=overdue&sort=attention', icon: CreditCard, tone: 'text-status-warning bg-status-warning/10', active: statusFilter === 'overdue' && setup === 'all' && !search && kind === 'all' },
        { label: 'Inaktive Konten', count: summary.inactive, query: 'status=inactive', icon: PauseCircle, tone: 'text-text-secondary bg-elevated', active: statusFilter === 'inactive' && setup === 'all' && !search && kind === 'all' },
    ];

    return (
        <div className={cn(SEITEN_RAND)} onClick={() => setCtxMenu(null)}>
            <SeitenKopf
                className="mb-[22px]"
                titel="Händlerübersicht"
                beileile={`Kundenakten, Einrichtung und Kontostatus · ${summary.users} Nutzer · ${summary.devices} Geräte`}
                aktionen={
                    can('tenants.create') && <Link to="/tenants/new" className={HAUPT_AKTION}>
                        <Plus className="size-[15px]" /> Händler einrichten
                    </Link>
                }
            />

            <section aria-label="Händler-Arbeitsansichten" className="mb-5">
                <p className="mb-2 text-xs text-text-muted">Arbeitsvorrat · alle nicht gelöschten Konten</p>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {workViews.map(({ label, count, query, icon: Icon, tone, active }) => <button
                        key={label} type="button" aria-pressed={active}
                        onClick={() => { const next = new URLSearchParams(query); if (pageSize !== 25) next.set('size', String(pageSize)); latestParams.current = next; setParams(next, { replace: true }); }}
                        className={cn('group rounded-xl border bg-surface p-4 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500', active ? 'border-accent-500 ring-1 ring-accent-500/20' : 'border-border-subtle hover:border-border-strong')}
                    >
                        <div className="flex items-center justify-between gap-2"><span className={cn('flex size-9 items-center justify-center rounded-lg', tone)}><Icon className="size-4" aria-hidden /></span><ArrowUpRight className="size-4 text-text-muted group-hover:text-accent-500" aria-hidden /></div>
                        <span className="mt-3 block font-display text-2xl font-semibold tabular-nums text-text-primary">{count}</span>
                        <span className="mt-1 block text-xs font-medium text-text-secondary">{label}</span>
                    </button>)}
                </div>
            </section>

            <section aria-label="Händler filtern" className="mb-4 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2.5">
                <label className={SUCH_FELD}>
                    <Search className="size-4 shrink-0 text-text-muted" aria-hidden />
                    <input
                        type="search"
                        placeholder="Name, Kennung oder WhatsApp suchen"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={SUCH_EINGABE}
                        aria-label="Kunden durchsuchen"
                    />
                </label>
                <select aria-label="Händler sortieren" value={sort} onChange={event => setSort(event.target.value)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm"><option value="name">Name A–Z</option><option value="attention">Zahlungsprobleme zuerst</option><option value="newest">Zuletzt angelegt</option></select>
                <label className="flex items-center gap-2 text-xs text-text-muted">Einrichtung<select aria-label="Einrichtung filtern" value={setup} onChange={event => changeFilter('setup', event.target.value)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary"><option value="all">Alle Stände</option><option value="open">Noch offen</option><option value="completed">Abgeschlossen</option></select></label>
                <label className="flex items-center gap-2 text-xs text-text-muted">Kontotyp<select aria-label="Kontotyp filtern" value={kind} onChange={event => changeFilter('kind', event.target.value)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary"><option value="all">Alle Konten</option><option value="customer">Händler</option><option value="demo">Demo</option></select></label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
                {/* Pillen statt Auswahlliste — so steht es im Entwurf. Der
                    Vorteil ist nicht nur Optik: man sieht die gewählte Lage,
                    ohne die Liste aufzuklappen, und wechselt mit einem Klick
                    statt mit zweien. */}
                {STATUS_FILTER.map((f) => (
                    <FilterPille
                        key={f.wert}
                        aktiv={statusFilter === f.wert}
                        onClick={() => setStatusFilter(f.wert)}
                    >
                        {f.label}
                    </FilterPille>
                ))}
                {hasFilters && <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>Filter zurücksetzen</Button>}
                {selectedLifecycleIds.length > 0 && can('tenants.deactivate') && (
                    <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-md bg-elevated border border-accent-500/40">
                        <span className="text-xs font-mono">
                            {selectedLifecycleIds.length} ausgewählt
                        </span>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={bulkLifecycleBusy}
                            onClick={() => setConfirmBulkDeactivate(true)}
                        >
                            Deaktivieren
                        </Button>
                    </div>
                )}
            </div>
            </section>

            {filtered.length === 0 ? (
                <EmptyState
                    title="Keine Kunden gefunden"
                    description={hasFilters ? 'Für diese Kombination sind keine Händler vorhanden. Setze die Filter zurück, um alle Konten zu sehen.' : 'Richte den ersten Händler über den geführten Einrichtungsprozess ein.'}
                    actionLabel={hasFilters ? 'Alle Händler anzeigen' : can('tenants.create') ? 'Händler einrichten' : undefined}
                    onAction={() => hasFilters ? setParams({}) : nav('/tenants/new')}
                />
            ) : (
                <div className="space-y-3">
                <p role="status" className="text-xs text-text-muted">{filtered.length} Treffer · {visible.length} auf dieser Seite{selectedLifecycleIds.length > visible.length ? ` · ${selectedLifecycleIds.length} über alle Ergebnisse ausgewählt` : ''}</p>
                <TabellenKarte>
                    <table className="w-full min-w-[940px] text-sm">
                        <caption className="sr-only">Händler mit Kontostatus, Nutzung, Zahlung und Einrichtungsstand</caption>
                        <thead className={TABELLE_KOPF}>
                            <tr>
                                <th className={cn(TABELLE_KOPF_ZELLE, 'w-6 pr-0')}>
                                    <input
                                        type="checkbox"
                                        aria-label="Alle auswählen"
                                        title="Alle gefilterten Händler über sämtliche Seiten auswählen"
                                        checked={
                                            selectableFiltered.length > 0
                                            && selectableFiltered.every((tenant) =>
                                                selected.has(tenant.id),
                                            )
                                        }
                                        disabled={!can('tenants.deactivate') || bulkLifecycleBusy || selectableFiltered.length === 0}
                                        onChange={(e) =>
                                            setSelected(
                                                e.target.checked
                                                    ? new Set(selectableFiltered.map((t) => t.id))
                                                    : new Set(),
                                            )
                                        }
                                    />
                                </th>
                                <th className={TABELLE_KOPF_ZELLE}>Händler</th>
                                <th className={TABELLE_KOPF_ZELLE}>Status</th>
                                <th className={TABELLE_KOPF_ZELLE}>Nutzer</th>
                                <th className={TABELLE_KOPF_ZELLE}>Geräte</th>
                                <th className={TABELLE_KOPF_ZELLE}>Zahlung</th>
                                <th className={TABELLE_KOPF_ZELLE}>Onboarding</th>
                                <th className={cn(TABELLE_KOPF_ZELLE, "text-right")}>Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((t) => (
                                <tr
                                    key={t.id}
                                    className={cn(TABELLE_ZEILE, 'cursor-pointer')}
                                    onClick={() => nav(`/tenants/${encodeURIComponent(t.id)}`, { state: listState })}
                                    onContextMenu={(e) => handleContextMenu(e, t.id)}
                                >
                                    <td className={cn(TABELLE_ZELLE, 'pr-0')} onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            aria-label={`Kunde ${t.name} auswählen`}
                                            checked={selected.has(t.id)}
                                            disabled={!can('tenants.deactivate') || bulkLifecycleBusy || t.deleted}
                                            onChange={() => toggleSelect(t.id)}
                                        />
                                    </td>
                                    <td className={TABELLE_ZELLE}>
                                        {/* Symbolfeld mit Initialen wie im Entwurf. Die
                                            Betriebsanzeige sitzt als Punkt darauf, statt
                                            eine eigene Spalte zu brauchen. */}
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span aria-hidden className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold', t.deleted || !t.is_active ? 'bg-elevated text-text-muted' : 'bg-accent-500/10 text-accent-500')}>{t.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('de')}</span>
                                            <div className="flex min-w-0 flex-col gap-1">
                                                <div className="flex min-w-0 items-center gap-1.5">
                                                    <Link to={'/tenants/' + encodeURIComponent(t.id)} state={listState} onClick={event => event.stopPropagation()} className="truncate text-sm font-medium text-text-primary hover:text-accent-600 hover:underline">{t.name}</Link>
                                                    {t.is_demo && (
                                                        <span className="shrink-0 rounded-md bg-accent-500/[0.16] px-1.5 py-0.5 text-xs font-medium text-accent-500">
                                                            Demo
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="truncate text-xs text-text-muted">{t.slug}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={TABELLE_ZELLE}>
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-1.5 text-xs font-medium',
                                                t.is_active && !t.deleted ? 'text-success' : 'text-text-muted',
                                            )}
                                        >
                                            <span
                                                aria-hidden
                                                className={cn(
                                                    'size-1.5 shrink-0 rounded-full',
                                                    t.is_active && !t.deleted
                                                        ? 'bg-success'
                                                        : 'bg-text-faint',
                                                )}
                                            />
                                            {t.deleted ? 'Gelöscht' : t.is_active ? 'Aktiv' : 'Inaktiv'}
                                        </span>
                                    </td>
                                    {/* Zahl UND Balken, wie im Entwurf: die Zahl sagt
                                        wie viele, der Balken wie voll. "4/10" und
                                        "4/6" lesen sich gleich, sind aber sehr
                                        unterschiedlich ausgelastet. */}
                                    <td className={TABELLE_ZELLE}>
                                        <Auslastung wert={t.user_count} von={t.max_users} balken="bg-accent-500" />
                                    </td>
                                    <td className={TABELLE_ZELLE}>
                                        <Auslastung wert={t.device_count} von={t.max_devices} balken="bg-text-tertiary" />
                                    </td>
                                    <td className={TABELLE_ZELLE}>
                                        <PaymentStatusBadge tenant={t} />
                                    </td>
                                    <td className={cn(TABELLE_ZELLE, 'text-[12px] text-text-muted')}>
                                        <span className={cn('inline-flex items-center gap-1.5', setupComplete(t) ? 'text-status-success' : 'text-text-secondary')}>
                                            {setupComplete(t) ? <CheckCircle2 className="size-3.5" aria-hidden /> : <ClipboardList className="size-3.5 text-status-info" aria-hidden />}
                                            {setupLabel(t.onboarding_status)}
                                        </span>
                                    </td>
                                    <td
                                        className={cn(TABELLE_ZELLE, 'text-right')}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" aria-label={`Aktionen für ${t.name}`}><MoreHorizontal size={18} /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-52">
                                            <DropdownMenuItem onSelect={() => nav(`/tenants/${encodeURIComponent(t.id)}`, { state: listState })}>Kundenakte öffnen</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => nav(`/tenants/${encodeURIComponent(t.id)}?tab=onboarding`, { state: listState })}>Einrichtung öffnen</DropdownMenuItem>
                                            {!t.deleted && can(t.is_active ? 'tenants.deactivate' : 'tenants.activate') ? (
                                                <DropdownMenuItem asChild><Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={
                                                        bulkLifecycleBusy
                                                        || activateMut.isPending
                                                        || deactivateMut.isPending
                                                    }
                                                    onClick={() =>
                                                        setConfirmLifecycle({
                                                            tenant: t,
                                                            action: t.is_active
                                                                ? 'deactivate'
                                                                : 'activate',
                                                        })
                                                    }
                                                >
                                                    {t.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                                </Button></DropdownMenuItem>
                                            ) : null}
                                            {t.deleted && can('tenants.delete') ? (
                                                <DropdownMenuItem asChild><Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={restoreMut.isPending}
                                                    onClick={() =>
                                                        restoreMut.mutate(t.id, {
                                                            onSuccess: () =>
                                                                toast.success(
                                                                    `${t.name} wiederhergestellt.`,
                                                                ),
                                                            onError: (err) =>
                                                                toast.error(
                                                                    err instanceof Error
                                                                        ? err.message
                                                                        : 'Wiederherstellen fehlgeschlagen.',
                                                                ),
                                                        })
                                                    }
                                                >
                                                    Wiederherstellen
                                                </Button></DropdownMenuItem>
                                            ) : null}
                                            {can('tenants.delete') && t.deleted ? (
                                                <DropdownMenuItem asChild><Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="ml-2 text-status-danger"
                                                    disabled={purgeMut.isPending}
                                                    onClick={() => setConfirmPurge(t)}
                                                >
                                                    Endgültig löschen
                                                </Button></DropdownMenuItem>
                                            ) : !t.deleted && can('billing.manage') && (isSuspended(t) ? (
                                                <DropdownMenuItem asChild><Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={unsuspendMut.isPending}
                                                    onClick={() => handleUnsuspend(t)}
                                                >
                                                    Reaktivieren
                                                </Button></DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem asChild><Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setConfirmSuspend(t)}
                                                >
                                                    Sperren
                                                </Button></DropdownMenuItem>
                                            ))}
</DropdownMenuContent></DropdownMenu>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TabellenKarte>
                    {/* Fusszeile wie im Entwurf: Zählung links, Ausgabe rechts. */}
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                        <span className="text-xs font-medium text-text-muted">
                            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} von {filtered.length} Händlern
                        </span>
                        <span className="flex-1" />
                        <select aria-label="Händler pro Seite" className="h-9 rounded-md border border-border bg-surface px-2 text-xs" value={pageSize} onChange={event => changeFilter('size', event.target.value)}><option value={25}>25 pro Seite</option><option value={50}>50 pro Seite</option><option value={100}>100 pro Seite</option></select>
                        <nav aria-label="Ergebnisseiten" className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Zurück</Button><span className="text-xs tabular-nums">{page} / {pages}</span><Button size="sm" variant="outline" disabled={page === pages} onClick={() => setPage(page + 1)}>Weiter</Button></nav>
                        <button
                            type="button"
                            onClick={csvExportieren}
                            className="text-xs font-semibold text-accent-500 transition-colors hover:text-accent-200"
                        >
                            CSV exportieren
                        </button>
                    </div>
                </div>
            )}

            {ctxMenu && contextTenant && (
                <div
                    className="fixed z-50 rounded-md border border-border bg-surface shadow-lg py-1 text-sm min-w-[180px]"
                    style={{ top: ctxMenu.y, left: ctxMenu.x }}
                    role="menu"
                >
                    <button
                        className="w-full text-left px-3 py-1.5 hover:bg-elevated"
                        onClick={() => {
                            nav(`/tenants/${ctxMenu.tenantId}`);
                            setCtxMenu(null);
                        }}
                    >
                        Bearbeiten
                    </button>
                    {!contextTenant.deleted && can(contextTenant.is_active ? 'tenants.deactivate' : 'tenants.activate') && (
                        <button
                            className="w-full text-left px-3 py-1.5 hover:bg-elevated"
                            onClick={() => {
                                setConfirmLifecycle({
                                    tenant: contextTenant,
                                    action: contextTenant.is_active ? 'deactivate' : 'activate',
                                });
                                setCtxMenu(null);
                            }}
                        >
                            {contextTenant.is_active ? 'Deaktivieren…' : 'Aktivieren…'}
                        </button>
                    )}
                    <button
                        disabled={!can('billing.manage') || contextTenant.deleted}
                        className="w-full text-left px-3 py-1.5 hover:bg-elevated"
                        onClick={() => {
                            const t = tenants.find((x) => x.id === ctxMenu.tenantId);
                            if (t) {
                                if (!can('billing.manage') || t.deleted) return;
                                if (isSuspended(t)) handleUnsuspend(t);
                                else setConfirmSuspend(t);
                            }
                            setCtxMenu(null);
                        }}
                    >
                        Sperren / Reaktivieren
                    </button>
                    <button
                        className="w-full text-left px-3 py-1.5 hover:bg-elevated"
                        onClick={() => {
                            nav(`/audit?tenant=${ctxMenu.tenantId}`);
                            setCtxMenu(null);
                        }}
                    >
                        Audit anzeigen
                    </button>
                    <button
                        disabled={!can('tenants.impersonate') || contextTenant.deleted}
                        className="w-full text-left px-3 py-1.5 hover:bg-elevated"
                        onClick={() => {
                            handleImpersonate(ctxMenu.tenantId);
                            setCtxMenu(null);
                        }}
                    >
                        Impersonate
                    </button>
                    <button
                        disabled={!can('tenants.delete') || contextTenant.deleted}
                        className="w-full text-left px-3 py-1.5 hover:bg-elevated text-status-danger"
                        onClick={() => {
                            const t = tenants.find((x) => x.id === ctxMenu.tenantId);
                            if (t) setConfirmDelete(t);
                            setCtxMenu(null);
                        }}
                    >
                        Löschen…
                    </button>
                </div>
            )}

            <ConfirmDialog
                open={!!confirmDelete}
                onOpenChange={(open) => !open && setConfirmDelete(null)}
                title={confirmDelete ? `${confirmDelete.name} löschen?` : 'Löschen?'}
                description={'Soft-Delete: Der Zugang wird sofort gesperrt und der Kunde aus Liste und KPIs entfernt. Alle Daten bleiben erhalten — Wiederherstellung jederzeit über den Filter „Gelöscht".'}
                tone="danger"
                confirmLabel="Löschen"
                loading={deleteMut.isPending}
                onConfirm={async () => {
                    if (confirmDelete) {
                        try {
                            await deleteMut.mutateAsync(confirmDelete.id);
                            toast.success(`${confirmDelete.name} gelöscht (wiederherstellbar).`);
                        } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
                        }
                    }
                    setConfirmDelete(null);
                }}
            />

            <ConfirmDialog
                open={!!confirmPurge}
                onOpenChange={(open) => !open && setConfirmPurge(null)}
                title={confirmPurge ? `${confirmPurge.name} endgültig löschen?` : 'Endgültig löschen?'}
                description={'IRREVERSIBEL: Owner-E-Mail/Benutzername, Firmenname/-E-Mail und die WhatsApp-Nummer werden anonymisiert/freigegeben, damit der Händler neu onboardet werden kann. Aufträge/Rechnungen bleiben aus GoBD-Gründen bestehen. Nur für bereits gelöschte Kunden.'}
                tone="danger"
                confirmLabel="Endgültig löschen"
                loading={purgeMut.isPending}
                onConfirm={async () => {
                    if (confirmPurge) {
                        try {
                            await purgeMut.mutateAsync(confirmPurge.id);
                            toast.success(`${confirmPurge.name} gepurged — E-Mail/Nummer wieder frei.`);
                        } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Purge fehlgeschlagen.');
                        }
                    }
                    setConfirmPurge(null);
                }}
            />

            <ConfirmDialog
                open={!!confirmSuspend}
                onOpenChange={(open) => !open && setConfirmSuspend(null)}
                title={confirmSuspend ? `${confirmSuspend.name} sperren?` : 'Sperren?'}
                description="Diesen Kunden wegen offener Zahlung sperren? Der Zugang wird sofort blockiert."
                tone="danger"
                confirmLabel="Sperren"
                loading={suspendMut.isPending}
                onConfirm={async () => {
                    if (confirmSuspend) {
                        try {
                            await suspendMut.mutateAsync(confirmSuspend.id);
                            toast.success(`${confirmSuspend.name} gesperrt.`);
                        } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Sperren fehlgeschlagen.');
                        }
                    }
                    setConfirmSuspend(null);
                }}
            />

            <ConfirmDialog
                open={!!confirmLifecycle}
                onOpenChange={(open) => !open && setConfirmLifecycle(null)}
                title={
                    confirmLifecycle
                        ? `${confirmLifecycle.tenant.name} ${confirmLifecycle.action === 'deactivate' ? 'deaktivieren' : 'aktivieren'}?`
                        : 'Status ändern?'
                }
                description={
                    confirmLifecycle?.action === 'deactivate'
                        ? 'Der Händler und seine Benutzer können sich danach nicht mehr anmelden.'
                        : 'Der Händlerzugang wird wieder freigeschaltet. Bestehende Sitzungen bleiben aus Sicherheitsgründen beendet.'
                }
                tone={confirmLifecycle?.action === 'deactivate' ? 'danger' : 'default'}
                confirmLabel={
                    confirmLifecycle?.action === 'deactivate' ? 'Deaktivieren' : 'Aktivieren'
                }
                loading={
                    !bulkLifecycleBusy && (deactivateMut.isPending || activateMut.isPending)
                }
                onConfirm={handleLifecycleConfirm}
            />

            <ConfirmDialog
                open={confirmBulkDeactivate}
                onOpenChange={(open) => !open && setConfirmBulkDeactivate(false)}
                title={`${selectedLifecycleIds.length} Kunden deaktivieren?`}
                description="Die Händler können sich danach nicht mehr anmelden."
                tone="danger"
                confirmLabel="Deaktivieren"
                loading={bulkLifecycleBusy}
                onConfirm={handleBulkDeactivate}
            />
        </div>
    );
}
