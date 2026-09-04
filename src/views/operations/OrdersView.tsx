/**
 * OrdersView — globale Order-Verwaltung über alle Händler (P5.4).
 * Deutsche Status-Badges (kein rohes <select>), Händlername statt roher merchant_id,
 * Suche + Status-/Händler-Filter + Pagination + Drill-in-Drawer.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';

import { useOrders, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useTenants } from '@/hooks/useTenants';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { formatDateTime } from '@/utils/format/date';
import { ORDER_STATUSES, orderStatusBadge, orderStatusLabel } from '@/lib/orderStatus';
import type { Order, OrderStatus } from '@/api/types';
import { SEITEN_RAND } from '@/components/ui/seite';
import { cn } from '@/lib/utils';

const DESTRUCTIVE: OrderStatus[] = ['archived', 'cancelled'];
const PAGE_SIZE = 25;

export default function OrdersView(): JSX.Element {
    const { orders, isLoading, error, refetch } = useOrders();
    const { tenants } = useTenants();
    const updateStatusMut = useUpdateOrderStatus();

    const [pendingChange, setPendingChange] = useState<{ order: Order; next: OrderStatus } | null>(null);
    const [drill, setDrill] = useState<Order | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
    const [merchantFilter, setMerchantFilter] = useState<string>('all');
    const [page, setPage] = useState(0);

    const tenantName = useMemo(() => {
        const m = new Map<string, string>();
        for (const t of tenants) m.set(String(t.id), t.name);
        return m;
    }, [tenants]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return orders.filter((o) => {
            if (statusFilter !== 'all' && o.status !== statusFilter) return false;
            if (merchantFilter !== 'all' && String(o.merchant_id) !== merchantFilter) return false;
            if (!q) return true;
            return [o.id, o.customer_name, o.customer_contact, o.requested_part_name, o.oem_number]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q));
        });
    }, [orders, search, statusFilter, merchantFilter]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    // Filter-Wechsel → zurück auf Seite 1.
    function resetAnd(fn: () => void): void {
        fn();
        setPage(0);
    }

    function applyStatusChange(order: Order, next: OrderStatus): void {
        if (next === order.status) return;
        if (DESTRUCTIVE.includes(next)) {
            setPendingChange({ order, next });
            return;
        }
        updateStatusMut.mutate(
            { id: order.id, status: next },
            {
                onSuccess: () => toast.success('Status aktualisiert.'),
                onError: (e) => toast.error(e instanceof Error ? e.message : 'Update fehlgeschlagen.'),
            },
        );
    }

    if (isLoading) return <LoadingState label="Lade Orders…" />;
    if (error) return <ErrorState message="Orders konnten nicht geladen werden." onRetry={refetch} />;

    const merchantsInData = Array.from(new Set(orders.map((o) => String(o.merchant_id))));

    return (
        <div className={cn(SEITEN_RAND)}>
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">Orders</h1>
                <p className="text-sm text-text-secondary">
                    {filtered.length} von {orders.length} Orders.
                </p>
            </header>

            {/* Filterleiste */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
                    <Input
                        value={search}
                        onChange={(e) => resetAnd(() => setSearch(e.target.value))}
                        placeholder="Suche: ID, Kunde, Telefon, Teil, OEM…"
                        className="pl-8"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => resetAnd(() => setStatusFilter(e.target.value as OrderStatus | 'all'))}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                >
                    <option value="all">Alle Status</option>
                    {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {orderStatusLabel(s)}
                        </option>
                    ))}
                </select>
                <select
                    value={merchantFilter}
                    onChange={(e) => resetAnd(() => setMerchantFilter(e.target.value))}
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                >
                    <option value="all">Alle Händler</option>
                    {merchantsInData.map((mid) => (
                        <option key={mid} value={mid}>
                            {tenantName.get(mid) ?? mid}
                        </option>
                    ))}
                </select>
            </div>

            {filtered.length === 0 ? (
                <EmptyState title="Keine Orders" description="Kein Treffer für die aktuellen Filter." />
            ) : (
                <>
                    <div className="rounded-md border border-border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-surface/60 text-left">
                                <tr>
                                    <th className="px-3 py-2">ID</th>
                                    <th className="px-3 py-2">Händler</th>
                                    <th className="px-3 py-2">Kunde</th>
                                    <th className="px-3 py-2">Teil</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Erstellt</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.map((o) => (
                                    <tr
                                        key={o.id}
                                        className="border-t border-border cursor-pointer hover:bg-elevated/40"
                                        onClick={() => setDrill(o)}
                                    >
                                        <td className="px-3 py-2 font-mono text-xs">{String(o.id).slice(0, 8)}</td>
                                        <td className="px-3 py-2">
                                            <Link
                                                to={`/tenants/${o.merchant_id}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-accent-500 hover:underline"
                                            >
                                                {tenantName.get(String(o.merchant_id)) ?? (
                                                    <span className="font-mono text-xs">{o.merchant_id}</span>
                                                )}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2">
                                            <div>{o.customer_name ?? '—'}</div>
                                            <div className="text-xs text-text-muted">{o.customer_contact ?? ''}</div>
                                        </td>
                                        <td className="px-3 py-2 text-xs">
                                            {o.requested_part_name ?? '—'}
                                            {o.oem_number && (
                                                <span className="ml-1 font-mono text-text-muted">({o.oem_number})</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${orderStatusBadge(o.status)}`}
                                                    >
                                                        {orderStatusLabel(o.status)}
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start">
                                                    {ORDER_STATUSES.map((s) => (
                                                        <DropdownMenuItem key={s} onSelect={() => applyStatusChange(o, s)}>
                                                            {orderStatusLabel(s)}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-text-secondary">
                                            {formatDateTime(o.created_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {pageCount > 1 && (
                        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-text-secondary">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={safePage === 0}
                                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40"
                            >
                                <ChevronLeft className="size-3" /> Zurück
                            </button>
                            <span className="font-mono">
                                {safePage + 1} / {pageCount}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                                disabled={safePage >= pageCount - 1}
                                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40"
                            >
                                Weiter <ChevronRight className="size-3" />
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Drill-in-Drawer */}
            <Sheet open={!!drill} onOpenChange={(open) => !open && setDrill(null)}>
                <SheetContent className="overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>Order {drill ? String(drill.id).slice(0, 8) : ''}</SheetTitle>
                        <SheetDescription>{drill?.requested_part_name ?? '—'}</SheetDescription>
                    </SheetHeader>
                    {drill && (
                        <dl className="grid grid-cols-2 gap-2 p-6 text-sm">
                            <dt className="text-text-secondary">Status</dt>
                            <dd>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${orderStatusBadge(drill.status)}`}>
                                    {orderStatusLabel(drill.status)}
                                </span>
                            </dd>
                            <dt className="text-text-secondary">Händler</dt>
                            <dd>
                                <Link to={`/tenants/${drill.merchant_id}`} className="inline-flex items-center gap-1 text-accent-500 hover:underline">
                                    {tenantName.get(String(drill.merchant_id)) ?? String(drill.merchant_id)}
                                    <ExternalLink className="size-3" />
                                </Link>
                            </dd>
                            <dt className="text-text-secondary">Kunde</dt>
                            <dd>{drill.customer_name ?? '—'}</dd>
                            <dt className="text-text-secondary">Kontakt</dt>
                            <dd className="font-mono text-xs">{drill.customer_contact ?? '—'}</dd>
                            <dt className="text-text-secondary">OEM</dt>
                            <dd className="font-mono text-xs">{drill.oem_number ?? '—'}</dd>
                            <dt className="text-text-secondary">Fahrzeug</dt>
                            <dd>{drill.vehicle_description ?? '—'}</dd>
                            <dt className="text-text-secondary">Order-ID</dt>
                            <dd className="font-mono text-xs break-all">{drill.id}</dd>
                            <dt className="text-text-secondary">Erstellt</dt>
                            <dd>{formatDateTime(drill.created_at)}</dd>
                            <dt className="text-text-secondary">Aktualisiert</dt>
                            <dd>{formatDateTime(drill.updated_at)}</dd>
                            {drill.notes && (
                                <>
                                    <dt className="text-text-secondary">Notizen</dt>
                                    <dd className="whitespace-pre-wrap">{drill.notes}</dd>
                                </>
                            )}
                        </dl>
                    )}
                </SheetContent>
            </Sheet>

            <ConfirmDialog
                open={!!pendingChange}
                onOpenChange={(open) => !open && setPendingChange(null)}
                title={pendingChange ? `Order auf „${orderStatusLabel(pendingChange.next)}" setzen?` : 'Status ändern?'}
                description="Dieser Status-Wechsel ist destruktiv. Bitte bestätige."
                tone="danger"
                onConfirm={async () => {
                    if (!pendingChange) return;
                    try {
                        await updateStatusMut.mutateAsync({ id: pendingChange.order.id, status: pendingChange.next });
                        toast.success('Status aktualisiert.');
                        setPendingChange(null); // nur bei Erfolg schließen → Retry bleibt möglich
                    } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Update fehlgeschlagen.');
                    }
                }}
            />
        </div>
    );
}
