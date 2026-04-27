/**
 * OrdersView — global order management across all tenants.
 */
import { useState } from 'react';
import { toast } from 'sonner';

import { useOrders, useUpdateOrderStatus } from '@/hooks/useOrders';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { formatDateTime } from '@/utils/format/date';
import type { Order, OrderStatus } from '@/api/types';

const STATUSES: OrderStatus[] = [
    'new',
    'in_progress',
    'awaiting_parts',
    'ready',
    'done',
    'archived',
    'cancelled',
];

const DESTRUCTIVE: OrderStatus[] = ['archived', 'cancelled'];

export default function OrdersView(): JSX.Element {
    const { orders, isLoading, error, refetch } = useOrders();
    const updateStatusMut = useUpdateOrderStatus();
    const [pendingChange, setPendingChange] = useState<{
        order: Order;
        next: OrderStatus;
    } | null>(null);

    if (isLoading) return <LoadingState label="Lade Orders…" />;
    if (error)
        return <ErrorState message="Orders konnten nicht geladen werden." onRetry={refetch} />;

    function applyStatusChange(order: Order, next: OrderStatus): void {
        if (DESTRUCTIVE.includes(next)) {
            setPendingChange({ order, next });
            return;
        }
        updateStatusMut.mutate(
            { id: order.id, status: next },
            {
                onSuccess: () => toast.success('Status aktualisiert.'),
                onError: (e) =>
                    toast.error(e instanceof Error ? e.message : 'Update fehlgeschlagen.'),
            },
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">Orders</h1>
                <p className="text-sm text-text-secondary">{orders.length} Orders insgesamt.</p>
            </header>

            {orders.length === 0 ? (
                <EmptyState title="Keine Orders" description="Es liegen aktuell keine Orders vor." />
            ) : (
                <div className="rounded-md border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-surface/60 text-left">
                            <tr>
                                <th className="px-3 py-2">ID</th>
                                <th className="px-3 py-2">Merchant</th>
                                <th className="px-3 py-2">Kunde</th>
                                <th className="px-3 py-2">Teil</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Erstellt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((o) => (
                                <tr key={o.id} className="border-t border-border">
                                    <td className="px-3 py-2 font-mono text-xs">{o.id}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{o.merchant_id}</td>
                                    <td className="px-3 py-2">
                                        <div>{o.customer_name ?? '—'}</div>
                                        <div className="text-xs text-text-muted">
                                            {o.customer_contact ?? ''}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-xs">
                                        {o.requested_part_name ?? '—'}
                                        {o.oem_number && (
                                            <span className="ml-1 font-mono text-text-muted">
                                                ({o.oem_number})
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <select
                                            value={o.status}
                                            onChange={(e) =>
                                                applyStatusChange(o, e.target.value as OrderStatus)
                                            }
                                            className="h-7 px-2 rounded-md border border-border bg-surface text-xs"
                                        >
                                            {STATUSES.map((s) => (
                                                <option key={s} value={s}>
                                                    {s}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-text-secondary">
                                        {formatDateTime(o.created_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ConfirmDialog
                open={!!pendingChange}
                onOpenChange={(open) => !open && setPendingChange(null)}
                title={
                    pendingChange
                        ? `Order auf "${pendingChange.next}" setzen?`
                        : 'Status ändern?'
                }
                description="Dieser Status-Wechsel ist destruktiv. Bitte bestätige."
                tone="danger"
                onConfirm={async () => {
                    if (!pendingChange) return;
                    try {
                        await updateStatusMut.mutateAsync({
                            id: pendingChange.order.id,
                            status: pendingChange.next,
                        });
                        toast.success('Status aktualisiert.');
                    } catch (err) {
                        toast.error(
                            err instanceof Error ? err.message : 'Update fehlgeschlagen.',
                        );
                    }
                    setPendingChange(null);
                }}
            />
        </div>
    );
}
