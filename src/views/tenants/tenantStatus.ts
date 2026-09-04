import type { TenantPaymentStatus } from '@/api/types';

export type TenantPaymentTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export interface TenantPaymentPresentation {
    label: string;
    tone: TenantPaymentTone;
}

/**
 * Human-readable payment state used by both tenant list and detail. The
 * backend deliberately distinguishes lifecycle states such as trial, overdue
 * and suspended; collapsing every non-suspended value to "Aktiv" hid overdue
 * customers from operators.
 */
export function presentTenantPaymentStatus(
    value: TenantPaymentStatus | null | undefined,
): TenantPaymentPresentation {
    const status = value?.trim().toLowerCase() ?? '';

    switch (status) {
        case 'active':
            return { label: 'Aktiv', tone: 'success' };
        case 'paid':
            return { label: 'Bezahlt', tone: 'success' };
        case 'trial':
            return { label: 'Testphase', tone: 'info' };
        case 'overdue':
            return { label: 'Überfällig', tone: 'warning' };
        case 'suspended':
            return { label: 'Gesperrt', tone: 'danger' };
        case 'pending':
            return { label: 'Ausstehend', tone: 'neutral' };
        case '':
            return { label: 'Nicht gesetzt', tone: 'neutral' };
        default:
            // Preserve an unknown backend value instead of lying about it.
            return { label: value?.trim() || 'Nicht gesetzt', tone: 'neutral' };
    }
}

