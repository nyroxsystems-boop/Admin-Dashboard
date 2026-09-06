import { describe, expect, it } from 'vitest';
import type { Order, Tenant } from '@/api/types';
import { erpOrderSummary, erpTenantSummary, recentOperationalOrders } from './erpMetrics';

function order(id: string, status: Order['status'], createdAt: string, updatedAt = createdAt): Order {
    return { id, status, created_at: createdAt, updated_at: updatedAt, merchant_id: 'tenant-1' };
}

function tenant(id: string, patch: Partial<Tenant> = {}): Tenant {
    return {
        id,
        name: id,
        slug: id,
        user_count: 2,
        max_users: 5,
        device_count: 1,
        max_devices: 5,
        is_active: true,
        onboarding_status: 'completed',
        payment_status: 'paid',
        whatsapp_number: null,
        logo_url: null,
        ...patch,
    };
}

describe('ERP-Arbeitskennzahlen', () => {
    it('trennt aktive Aufträge, Teilewartezeit und überalterte Vorgänge', () => {
        const now = new Date('2026-09-06T12:00:00Z').getTime();
        const result = erpOrderSummary([
            order('new', 'new', '2026-09-03T10:00:00Z'),
            order('parts', 'awaiting_parts', '2026-09-06T10:00:00Z'),
            order('ready', 'ready', '2026-09-05T10:00:00Z'),
            order('done', 'done', '2026-09-01T10:00:00Z'),
        ], now);
        expect(result).toMatchObject({ total: 4, open: 3, awaitingParts: 1, ready: 1, completed: 1, olderThan48Hours: 1 });
    });

    it('meldet offene Einrichtung und Zahlungsprobleme ohne Demo-Kennzahlen zu erfinden', () => {
        const result = erpTenantSummary([
            tenant('live'),
            tenant('setup', { onboarding_status: 'pending' }),
            tenant('payment', { payment_status: 'past_due', is_active: false }),
        ]);
        expect(result).toEqual({ total: 3, active: 2, onboardingOpen: 1, paymentAttention: 1, users: 6 });
    });

    it('zeigt nur operative Aufträge und sortiert nach letzter Änderung', () => {
        expect(recentOperationalOrders([
            order('done', 'done', '2026-09-01T10:00:00Z'),
            order('older', 'new', '2026-09-01T10:00:00Z'),
            order('newer', 'ready', '2026-09-01T10:00:00Z', '2026-09-05T10:00:00Z'),
        ]).map((entry) => entry.id)).toEqual(['newer', 'older']);
    });
});
