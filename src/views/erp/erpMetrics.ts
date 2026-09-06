import type { Order, OrderStatus, Tenant } from '@/api/types';

const ACTIVE_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
    'new',
    'in_progress',
    'awaiting_parts',
    'ready',
]);

export interface ErpOrderSummary {
    total: number;
    open: number;
    awaitingParts: number;
    ready: number;
    completed: number;
    olderThan48Hours: number;
    byStatus: Record<OrderStatus, number>;
}

export interface ErpTenantSummary {
    total: number;
    active: number;
    onboardingOpen: number;
    paymentAttention: number;
    users: number;
}

const EMPTY_STATUS: Record<OrderStatus, number> = {
    new: 0,
    in_progress: 0,
    awaiting_parts: 0,
    ready: 0,
    done: 0,
    archived: 0,
    cancelled: 0,
};

export function erpOrderSummary(orders: Order[], now = Date.now()): ErpOrderSummary {
    const byStatus = { ...EMPTY_STATUS };
    let olderThan48Hours = 0;
    for (const order of orders) {
        byStatus[order.status] += 1;
        const createdAt = new Date(order.created_at).getTime();
        if (
            ACTIVE_ORDER_STATUSES.has(order.status)
            && Number.isFinite(createdAt)
            && now - createdAt >= 48 * 60 * 60 * 1000
        ) olderThan48Hours += 1;
    }
    return {
        total: orders.length,
        open: byStatus.new + byStatus.in_progress + byStatus.awaiting_parts + byStatus.ready,
        awaitingParts: byStatus.awaiting_parts,
        ready: byStatus.ready,
        completed: byStatus.done,
        olderThan48Hours,
        byStatus,
    };
}

export function erpTenantSummary(tenants: Tenant[]): ErpTenantSummary {
    return tenants.reduce<ErpTenantSummary>((summary, tenant) => {
        summary.total += 1;
        if (tenant.is_active && !tenant.deleted) summary.active += 1;
        const onboarding = String(tenant.onboarding_status ?? '').toLocaleLowerCase('de-DE');
        if (!['completed', 'complete', 'live', 'done'].includes(onboarding)) summary.onboardingOpen += 1;
        const payment = String(tenant.payment_status ?? '').toLocaleLowerCase('de-DE');
        if (['overdue', 'suspended', 'failed', 'past_due'].includes(payment)) summary.paymentAttention += 1;
        summary.users += tenant.user_count;
        return summary;
    }, { total: 0, active: 0, onboardingOpen: 0, paymentAttention: 0, users: 0 });
}

export function recentOperationalOrders(orders: Order[], limit = 8): Order[] {
    return [...orders]
        .filter((order) => ACTIVE_ORDER_STATUSES.has(order.status))
        .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
        .slice(0, limit);
}
