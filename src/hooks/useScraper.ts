/**
 * useScraper — PartsLink24 health + on-demand lookup.
 *
 * Differences from previous stub shape:
 *   - The old `jobs[]` listing is gone (no listJobs endpoint exists).
 *     Bulk-job status is exposed by the dedicated scraper endpoints in
 *     src/api/scraper.ts and is consumed by views directly.
 *   - useScraperHealth polls /api/health every 15s.
 *   - useScraperLookup is a mutation wrapping lookupPartslink24.
 *   - The legacy `useScraper(autoRefresh)` shape is preserved minimally
 *     for back-compat — it now exposes `health` instead of `jobs`.
 */

import {
    useQuery,
    useMutation,
    type UseMutationResult,
    type UseQueryResult,
} from '@tanstack/react-query';
import {
    getPartslinkHealth,
    lookupPartslink24,
    type PartslinkResult,
} from '@/api/scraper';

export interface ScraperJob {
    id: string;
    target: string;
    status: 'queued' | 'running' | 'done' | 'error';
    progress: number;
    rowsScraped: number;
    startedAt: string | null;
    finishedAt: string | null;
}

export interface ScraperHealth {
    status: string;
    service: string;
}

export function useScraperHealth(
    autoRefresh = true,
    enabled = true
): UseQueryResult<ScraperHealth, Error> {
    return useQuery({
        queryKey: ['admin', 'scraper', 'health'] as const,
        queryFn: () => getPartslinkHealth(),
        refetchInterval: autoRefresh && enabled ? 15_000 : false,
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        enabled,
    });
}

export interface ScraperLookupInput {
    vin: string;
    part: string;
    brand?: string;
}

export function useScraperLookup(): UseMutationResult<
    PartslinkResult,
    Error,
    ScraperLookupInput
> {
    return useMutation({
        mutationFn: (input) => lookupPartslink24(input),
    });
}

/**
 * Legacy compatibility wrapper. Surfaces the health poll under a
 * `useScraper`-shaped object so old views keep compiling. New code should
 * call `useScraperHealth` and `useScraperLookup` directly.
 */
export function useScraper(autoRefresh = true): {
    health: ScraperHealth | null;
    isLoading: boolean;
    isLive: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useScraperHealth(autoRefresh);
    return {
        health: q.data ?? null,
        isLoading: q.isLoading,
        isLive: autoRefresh,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}
