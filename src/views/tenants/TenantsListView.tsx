/**
 * TenantsListView — Multi-Tenant overview list.
 *
 * Features:
 *   - Search + status filter (active / inactive / payment-status)
 *   - Bulk select via checkbox column
 *   - Right-Click context menu (Edit / Audit / Impersonate / Disable)
 *   - Status-LED + (placeholder) Sparkline per row
 *   - Quick-Action: + New Tenant (routes to /tenants/new)
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

import {
    useTenants,
    useDeleteTenant,
    useDeactivateTenant,
    useActivateTenant,
} from '@/hooks/useTenants';
import { useImpersonate } from '@/hooks/useImpersonate';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Tenant } from '@/api/types';

type StatusFilter = 'all' | 'active' | 'inactive' | 'trial' | 'overdue';

function StatusLED({ active }: { active: boolean }): JSX.Element {
    const color = active ? '#4ADE80' : '#F87171';
    return (
        <span
            className="inline-block size-1.5 rounded-full"
            style={{ background: color, boxShadow: `0 0 6px ${color}` }}
            aria-label={active ? 'aktiv' : 'inaktiv'}
        />
    );
}

function Sparkline({ data }: { data: number[] }): JSX.Element {
    if (data.length === 0) {
        return <svg viewBox="0 0 80 20" className="w-20 h-5" aria-hidden="true" />;
    }
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const w = 80;
    const h = 20;
    const step = w / Math.max(data.length - 1, 1);
    const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-5" aria-hidden="true">
            <polyline fill="none" stroke="var(--accent-500, #1D6FE8)" strokeWidth="1.2" points={points} />
        </svg>
    );
}

export default function TenantsListView(): JSX.Element {
    const nav = useNavigate();
    const { tenants, isLoading, error, refetch } = useTenants();
    const deleteMut = useDeleteTenant();
    const deactivateMut = useDeactivateTenant();
    const activateMut = useActivateTenant();
    const impersonateMut = useImpersonate();

    const [search, setSearch] = useState('');
    const debounced = useDebounce(search, 200);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tenantId: number } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Tenant | null>(null);

    const filtered = useMemo(() => {
        return tenants.filter((t) => {
            if (statusFilter === 'active' && !t.is_active) return false;
            if (statusFilter === 'inactive' && t.is_active) return false;
            if (statusFilter === 'trial' && t.payment_status !== 'trial') return false;
            if (statusFilter === 'overdue' && t.payment_status !== 'overdue') return false;
            if (
                debounced &&
                !t.name.toLowerCase().includes(debounced.toLowerCase()) &&
                !t.slug.includes(debounced.toLowerCase())
            )
                return false;
            return true;
        });
    }, [tenants, debounced, statusFilter]);

    function toggleSelect(id: number): void {
        setSelected((s) => {
            const next = new Set(s);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function handleContextMenu(e: React.MouseEvent, tenantId: number): void {
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY, tenantId });
    }

    function handleImpersonate(tenantId: number): void {
        impersonateMut.mutate(
            { tenantId },
            {
                onSuccess: () => {
                    toast.success('Impersonation gestartet.');
                },
                onError: () => {
                    toast.message('Impersonation noch nicht verfügbar.');
                },
            }
        );
    }

    if (isLoading) return <LoadingState label="Lade Tenants…" />;
    if (error) return <ErrorState message="Tenants konnten nicht geladen werden." onRetry={refetch} />;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto" onClick={() => setCtxMenu(null)}>
            <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-display font-semibold tracking-tight">Tenants</h1>
                    <p className="text-sm text-text-secondary">{tenants.length} insgesamt</p>
                </div>
                <Link to="/tenants/new">
                    <Button size="sm">
                        <Plus className="size-4" /> Neuer Tenant
                    </Button>
                </Link>
            </header>

            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="relative">
                    <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
                    <Input
                        type="search"
                        placeholder="Suche nach Name oder Slug…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 w-64"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="h-9 px-2 rounded-md bg-surface border border-border text-sm"
                    aria-label="Status filter"
                >
                    <option value="all">Alle Status</option>
                    <option value="active">Aktiv</option>
                    <option value="inactive">Inaktiv</option>
                    <option value="trial">Trial</option>
                    <option value="overdue">Überfällig</option>
                </select>
                {selected.size > 0 && (
                    <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-md bg-elevated border border-accent-500/40">
                        <span className="text-xs font-mono">{selected.size} ausgewählt</span>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                selected.forEach((id) => deactivateMut.mutate(id));
                                setSelected(new Set());
                            }}
                        >
                            Deaktivieren
                        </Button>
                    </div>
                )}
            </div>

            {filtered.length === 0 ? (
                <EmptyState
                    title="Keine Tenants gefunden"
                    description="Passe deine Filter an oder erstelle einen neuen Tenant."
                    actionLabel="Neuer Tenant"
                    onAction={() => nav('/tenants/new')}
                />
            ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                        <thead className="bg-surface/60 text-left">
                            <tr>
                                <th className="px-3 py-2 w-6">
                                    <input
                                        type="checkbox"
                                        aria-label="Alle auswählen"
                                        checked={selected.size === filtered.length && filtered.length > 0}
                                        onChange={(e) =>
                                            setSelected(
                                                e.target.checked
                                                    ? new Set(filtered.map((t) => t.id))
                                                    : new Set(),
                                            )
                                        }
                                    />
                                </th>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">User</th>
                                <th className="px-3 py-2">Devices</th>
                                <th className="px-3 py-2">Payment</th>
                                <th className="px-3 py-2">Trend</th>
                                <th className="px-3 py-2">Onboarding</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((t) => (
                                <tr
                                    key={t.id}
                                    className="border-t border-border hover:bg-elevated/40 cursor-pointer"
                                    onClick={() => nav(`/tenants/${t.id}`)}
                                    onContextMenu={(e) => handleContextMenu(e, t.id)}
                                >
                                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            aria-label={`Tenant ${t.name} auswählen`}
                                            checked={selected.has(t.id)}
                                            onChange={() => toggleSelect(t.id)}
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <StatusLED active={t.is_active} />
                                            <div>
                                                <div className="font-medium">{t.name}</div>
                                                <div className="text-xs text-text-muted font-mono">{t.slug}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-xs uppercase tracking-wider">
                                        {t.is_active ? 'Aktiv' : 'Inaktiv'}
                                    </td>
                                    <td className="px-3 py-2 font-mono">
                                        {t.user_count}/{t.max_users}
                                    </td>
                                    <td className="px-3 py-2 font-mono">
                                        {t.device_count}/{t.max_devices}
                                    </td>
                                    <td className="px-3 py-2 text-xs uppercase">
                                        {t.payment_status ?? '—'}
                                    </td>
                                    <td className="px-3 py-2">
                                        <Sparkline data={[]} />
                                    </td>
                                    <td className="px-3 py-2 text-xs text-text-secondary">
                                        {t.onboarding_status ?? '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {ctxMenu && (
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
                    <button
                        className="w-full text-left px-3 py-1.5 hover:bg-elevated"
                        onClick={() => {
                            const t = tenants.find((x) => x.id === ctxMenu.tenantId);
                            if (t) {
                                if (t.is_active) deactivateMut.mutate(t.id);
                                else activateMut.mutate(t.id);
                            }
                            setCtxMenu(null);
                        }}
                    >
                        Deaktivieren / Aktivieren
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
                    <div className="my-1 border-t border-border" />
                    <button
                        className="w-full text-left px-3 py-1.5 hover:bg-elevated text-danger"
                        onClick={() => {
                            const t = tenants.find((x) => x.id === ctxMenu.tenantId) ?? null;
                            setConfirmDelete(t);
                            setCtxMenu(null);
                        }}
                    >
                        Löschen
                    </button>
                </div>
            )}

            <ConfirmDialog
                open={!!confirmDelete}
                onOpenChange={(open) => !open && setConfirmDelete(null)}
                title={confirmDelete ? `${confirmDelete.name} löschen?` : 'Löschen?'}
                description="Dieser Vorgang kann rückgängig gemacht werden (Soft-Delete, 30 Tage)."
                tone="danger"
                confirmLabel="Löschen"
                onConfirm={async () => {
                    if (confirmDelete) {
                        try {
                            await deleteMut.mutateAsync(confirmDelete.id);
                            toast.success(`${confirmDelete.name} gelöscht.`);
                        } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
                        }
                    }
                    setConfirmDelete(null);
                }}
            />
        </div>
    );
}
