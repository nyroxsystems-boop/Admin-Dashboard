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
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
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
    ZeilenMarke,
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

type StatusFilter = 'all' | 'active' | 'inactive' | 'trial' | 'overdue' | 'deleted';
type LifecycleAction = 'activate' | 'deactivate';


/** A tenant counts as payment-suspended when the billing lockout is active. */
function isSuspended(t: Pick<Tenant, 'payment_status'>): boolean {
    return t.payment_status?.trim().toLowerCase() === 'suspended';
}

const PAYMENT_TONE_CLASS: Record<TenantPaymentTone, string> = {
    success: 'bg-status-success/10 text-status-success',
    info: 'bg-accent-500/12 text-accent-500',
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
    { wert: 'overdue', label: 'Überfällig' },
    { wert: 'deleted', label: 'Gelöscht' },
];

/**
 * Initialen für das Symbolfeld der Zeile.
 *
 * Zwei Buchstaben aus den ersten beiden Wörtern; bei einem Wort die ersten
 * zwei Zeichen. "A-V-G Autozubehör" wird so zu "AA" und nicht zu "A-".
 */
function initialen(name: string): string {
    const teile = name.split(/[\s\-_.]+/).filter(Boolean);
    if (teile.length === 0) return '—';
    if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase();
    return (teile[0][0] + teile[1][0]).toUpperCase();
}

/**
 * Auslastungszelle: Zahl über einem 4-px-Balken.
 *
 * Steht so im Entwurf. Der Balken trägt die Aussage, die die Zahl allein nicht
 * hat: "4/10" und "4/6" lesen sich fast gleich, sind aber 40 % gegen 67 %.
 */
function Auslastung({ wert, von, balken }: { wert: number; von: number; balken: string }): JSX.Element {
    const anteil = von > 0 ? Math.min(100, Math.round((wert / von) * 100)) : 0;
    return (
        <span className="flex flex-col gap-[5px]">
            <span className="font-mono text-xs tabular-nums text-text-secondary">
                {wert}/{von}
            </span>
            <span
                className="flex h-1 overflow-hidden rounded-sm bg-overlay/[0.06]"
                role="img"
                aria-label={`${anteil} Prozent belegt`}
            >
                <span className={cn('h-full rounded-sm', balken)} style={{ width: `${anteil}%` }} />
            </span>
        </span>
    );
}

export default function TenantsListView(): JSX.Element {
    const nav = useNavigate();
    const [search, setSearch] = useState('');
    const debounced = useDebounce(search, 200);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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

    const filtered = useMemo(() => {
        return tenants.filter((t) => {
            if (showDeleted) {
                if (!t.deleted) return false;
            } else if (t.deleted) {
                return false;
            }
            if (statusFilter === 'active' && !t.is_active) return false;
            if (statusFilter === 'inactive' && t.is_active) return false;
            const paymentStatus = t.payment_status?.trim().toLowerCase();
            if (statusFilter === 'trial' && paymentStatus !== 'trial') return false;
            if (statusFilter === 'overdue' && paymentStatus !== 'overdue') return false;
            if (
                debounced &&
                !t.name.toLowerCase().includes(debounced.toLowerCase()) &&
                !t.slug.includes(debounced.toLowerCase())
            )
                return false;
            return true;
        });
    }, [tenants, debounced, statusFilter, showDeleted]);

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
        const feld = (v: unknown) => {
            const t = String(v ?? '');
            return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
        };
        const zeilen = filtered.map((t) => [
            t.name, t.slug, t.is_active ? 'Aktiv' : 'Inaktiv',
            t.user_count, t.max_users, t.device_count, t.max_devices,
            t.onboarding_status ?? '',
        ].map(feld).join(';'));
        const inhalt = '\uFEFF' + [kopf.join(';'), ...zeilen].join('\r\n');
        const url = URL.createObjectURL(new Blob([inhalt], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `kunden-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Für die Beileile: dieselben Zahlen, die der Entwurf dort nennt.
    const nutzerGesamt = tenants.reduce((n, t) => n + (t.user_count ?? 0), 0);
    const geraeteGesamt = tenants.reduce((n, t) => n + (t.device_count ?? 0), 0);

    return (
        <div className={cn(SEITEN_RAND)} onClick={() => setCtxMenu(null)}>
            <SeitenKopf
                className="mb-[22px]"
                titel="Kunden"
                // Der Entwurf nennt hier "2 Mandanten · 3 Nutzer · 8 Geräte
                // gebunden" — dieselbe Zeile, aber gerechnet statt geschrieben.
                beileile={`${tenants.length} ${tenants.length === 1 ? 'Mandant' : 'Mandanten'} · ${nutzerGesamt} ${nutzerGesamt === 1 ? 'Nutzer' : 'Nutzer'} · ${geraeteGesamt} ${geraeteGesamt === 1 ? 'Gerät' : 'Geräte'} gebunden`}
                aktionen={
                    <Link to="/tenants/new" className={HAUPT_AKTION}>
                        <Plus className="size-[15px]" /> Neuer Kunde
                    </Link>
                }
            />

            <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
                <label className={SUCH_FELD}>
                    <Search className="size-4 shrink-0 text-text-muted" aria-hidden />
                    <input
                        type="search"
                        placeholder="Suche nach Name oder Slug"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={SUCH_EINGABE}
                        aria-label="Kunden durchsuchen"
                    />
                </label>
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
                {selectedLifecycleIds.length > 0 && (
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

            {filtered.length === 0 ? (
                <EmptyState
                    title="Keine Kunden gefunden"
                    description="Passe deine Filter an oder erstelle einen neuen Kunden."
                    actionLabel="Neuer Kunde"
                    onAction={() => nav('/tenants/new')}
                />
            ) : (
                <TabellenKarte>
                    <table className="w-full min-w-[940px] text-sm">
                        <thead className={TABELLE_KOPF}>
                            <tr>
                                <th className={cn(TABELLE_KOPF_ZELLE, 'w-6 pr-0')}>
                                    <input
                                        type="checkbox"
                                        aria-label="Alle auswählen"
                                        checked={
                                            selectableFiltered.length > 0
                                            && selectableFiltered.every((tenant) =>
                                                selected.has(tenant.id),
                                            )
                                        }
                                        disabled={bulkLifecycleBusy || selectableFiltered.length === 0}
                                        onChange={(e) =>
                                            setSelected(
                                                e.target.checked
                                                    ? new Set(selectableFiltered.map((t) => t.id))
                                                    : new Set(),
                                            )
                                        }
                                    />
                                </th>
                                <th className={TABELLE_KOPF_ZELLE}>Kunde</th>
                                <th className={TABELLE_KOPF_ZELLE}>Status</th>
                                <th className={TABELLE_KOPF_ZELLE}>Nutzer</th>
                                <th className={TABELLE_KOPF_ZELLE}>Geräte</th>
                                <th className={TABELLE_KOPF_ZELLE}>Zahlung</th>
                                <th className={TABELLE_KOPF_ZELLE}>Onboarding</th>
                                <th className={cn(TABELLE_KOPF_ZELLE, "text-right")}>Zugang</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((t) => (
                                <tr
                                    key={t.id}
                                    className={cn(TABELLE_ZEILE, 'cursor-pointer')}
                                    onClick={() => nav(`/tenants/${t.id}`)}
                                    onContextMenu={(e) => handleContextMenu(e, t.id)}
                                >
                                    <td className={cn(TABELLE_ZELLE, 'pr-0')} onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            aria-label={`Kunde ${t.name} auswählen`}
                                            checked={selected.has(t.id)}
                                            disabled={bulkLifecycleBusy || t.deleted}
                                            onChange={() => toggleSelect(t.id)}
                                        />
                                    </td>
                                    <td className={TABELLE_ZELLE}>
                                        {/* Symbolfeld mit Initialen wie im Entwurf. Die
                                            Betriebsanzeige sitzt als Punkt darauf, statt
                                            eine eigene Spalte zu brauchen. */}
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="relative shrink-0">
                                                <ZeilenMarke>{initialen(t.name)}</ZeilenMarke>
                                                <span
                                                    aria-hidden
                                                    className={cn(
                                                        'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-canvas',
                                                        t.is_active ? 'bg-success' : 'bg-text-faint',
                                                    )}
                                                />
                                            </span>
                                            <div className="flex min-w-0 flex-col gap-1">
                                                <div className="flex min-w-0 items-center gap-1.5">
                                                    <span className="truncate text-[12.5px] font-bold text-text-primary">{t.name}</span>
                                                    {t.is_demo && (
                                                        <span className="shrink-0 rounded-md bg-accent-500/[0.16] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-accent-500">
                                                            Demo
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="truncate font-mono text-[11px] text-text-muted">{t.slug}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={TABELLE_ZELLE}>
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase',
                                                t.is_active ? 'text-success' : 'text-text-muted',
                                            )}
                                        >
                                            <span
                                                aria-hidden
                                                className={cn(
                                                    'size-1.5 shrink-0 rounded-full',
                                                    t.is_active
                                                        ? 'bg-success shadow-[0_0_8px_hsl(var(--success))]'
                                                        : 'bg-text-faint',
                                                )}
                                            />
                                            {t.is_active ? 'Aktiv' : 'Inaktiv'}
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
                                        {t.onboarding_status ?? '—'}
                                    </td>
                                    <td
                                        className={cn(TABELLE_ZELLE, 'text-right')}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex items-center justify-end gap-[7px]">
                                            {!t.deleted ? (
                                                <Button
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
                                                </Button>
                                            ) : null}
                                            {t.deleted ? (
                                                <Button
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
                                                </Button>
                                            ) : null}
                                            {t.deleted ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="ml-2 text-status-danger"
                                                    disabled={purgeMut.isPending}
                                                    onClick={() => setConfirmPurge(t)}
                                                >
                                                    Endgültig löschen
                                                </Button>
                                            ) : isSuspended(t) ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={unsuspendMut.isPending}
                                                    onClick={() => handleUnsuspend(t)}
                                                >
                                                    Reaktivieren
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setConfirmSuspend(t)}
                                                >
                                                    Sperren
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {/* Fusszeile wie im Entwurf: Zählung links, Ausgabe rechts. */}
                    <div className="flex min-w-[940px] items-center gap-3 px-5 py-4">
                        <span className="text-[11px] font-medium text-text-faint">
                            {filtered.length} von {tenants.length} {tenants.length === 1 ? 'Mandant' : 'Mandanten'}
                        </span>
                        <span className="flex-1" />
                        <button
                            type="button"
                            onClick={csvExportieren}
                            className="text-xs font-semibold text-accent-500 transition-colors hover:text-accent-200"
                        >
                            CSV exportieren
                        </button>
                    </div>
                </TabellenKarte>
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
                    {!contextTenant.deleted && (
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
                        className="w-full text-left px-3 py-1.5 hover:bg-elevated"
                        onClick={() => {
                            const t = tenants.find((x) => x.id === ctxMenu.tenantId);
                            if (t) {
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
                        className="w-full text-left px-3 py-1.5 hover:bg-elevated"
                        onClick={() => {
                            handleImpersonate(ctxMenu.tenantId);
                            setCtxMenu(null);
                        }}
                    >
                        Impersonate
                    </button>
                    <button
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
