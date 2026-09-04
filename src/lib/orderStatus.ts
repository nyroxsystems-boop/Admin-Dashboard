/**
 * Order-Status — deutsche Labels + Badge-Farben (P5.4). Single source, damit
 * keine rohen Enums (in_progress …) mehr in der UI auftauchen.
 */
import type { OrderStatus } from '@/api/types';

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; badge: string }> = {
    new: { label: 'Neu', badge: 'bg-accent-500/12 text-accent-500' },
    in_progress: { label: 'In Bearbeitung', badge: 'bg-status-info-muted text-status-info' },
    awaiting_parts: { label: 'Wartet auf Teile', badge: 'bg-status-warning-muted text-status-warning' },
    ready: { label: 'Bereit', badge: 'bg-status-success-muted text-status-success' },
    done: { label: 'Erledigt', badge: 'bg-status-success-muted text-status-success' },
    archived: { label: 'Archiviert', badge: 'bg-elevated text-text-muted' },
    cancelled: { label: 'Storniert', badge: 'bg-status-danger-muted text-status-danger' },
};

export const ORDER_STATUSES: OrderStatus[] = [
    'new',
    'in_progress',
    'awaiting_parts',
    'ready',
    'done',
    'archived',
    'cancelled',
];

export function orderStatusLabel(s: string): string {
    return (ORDER_STATUS_META as Record<string, { label: string }>)[s]?.label ?? s;
}

export function orderStatusBadge(s: string): string {
    return (ORDER_STATUS_META as Record<string, { badge: string }>)[s]?.badge ?? 'bg-elevated text-text-muted';
}
