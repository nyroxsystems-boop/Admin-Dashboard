/**
 * useDashboardMetrics — KPI tiles + 7-day trend series for the home dashboard.
 *
 * Differences from previous stub shape:
 *   - Backed by getAdminStats() which returns AdminStats {
 *       total_tenants, total_users, total_devices, tenants[], history?, kpis?
 *     }
 *   - We adapt that into the legacy DashboardMetrics shape so existing
 *     views keep working:
 *       activeTenants  ← kpis.team.tenantCount ?? total_tenants
 *       totalUsers     ← kpis.team.activeUsers ?? total_users
 *       ordersToday    ← kpis.sales.ordersToday ?? 0
 *       revenueMtd     ← kpis.sales.revenue ?? 0
 *       seriesOrders7d ← history.map(h => h.orders).slice(-7)
 *       seriesRevenue7d← history.map(h => h.revenue).slice(-7)
 *   - The raw `stats` is also exposed for views that want full access.
 */

import { useQuery } from '@tanstack/react-query';
import { getAdminStats } from '@/api/tenants';
import type { AdminStats } from '@/api/types';

export interface DashboardMetrics {
    activeTenants: number;
    totalUsers: number;
    ordersToday: number;
    revenueMtd: number;
    seriesOrders7d: number[];
    seriesRevenue7d: number[];
}

function adapt(stats: AdminStats): DashboardMetrics {
    const team = stats.kpis?.team;
    const sales = stats.kpis?.sales;
    const history = stats.history ?? [];
    const tail = history.slice(-7);
    return {
        activeTenants: team?.tenantCount ?? stats.total_tenants ?? 0,
        totalUsers: team?.activeUsers ?? stats.total_users ?? 0,
        ordersToday: sales?.ordersToday ?? 0,
        revenueMtd: sales?.revenue ?? 0,
        seriesOrders7d: tail.map((h) => h.orders),
        seriesRevenue7d: tail.map((h) => h.revenue),
    };
}

export function useDashboardMetrics(): {
    metrics: DashboardMetrics | null;
    stats: AdminStats | null;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey: ['admin', 'dashboard', 'metrics'] as const,
        queryFn: () => getAdminStats(),
        staleTime: 30_000,
        gcTime: 5 * 60_000,
    });
    return {
        metrics: q.data ? adapt(q.data) : null,
        stats: q.data ?? null,
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}
