/**
 * useSystemHealth — backend health snapshot, polls every 15s.
 *
 * Differences from previous stub shape:
 *   - SystemHealth shape is now { redis, db, botApi, timestamp? }.
 *     The legacy `database` field is renamed to `db`; `scraper` is no
 *     longer part of /api/admin/health (use useScraperHealth instead).
 *   - `checkedAt` is now `timestamp` and may be undefined.
 */

import { useQuery } from '@tanstack/react-query';
import { getSystemHealth } from '@/api/health';
import type { SystemHealth } from '@/api/types';

export function useSystemHealth(): {
    health: SystemHealth | null;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey: ['admin', 'system', 'health'] as const,
        queryFn: () => getSystemHealth(),
        refetchInterval: 15_000,
        staleTime: 10_000,
        gcTime: 5 * 60_000,
    });
    return {
        health: q.data ?? null,
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}
