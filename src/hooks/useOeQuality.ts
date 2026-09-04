/**
 * useOeQuality — React-Query-Hooks für die OE-Qualitäts-Seite.
 *
 *   useOeMetrics()       → Lernschleifen-Metriken (Wissen / Queue / Lookups)
 *   useOeReviewQueue()   → offene Verdachtsfälle
 *   useCloseReviewItem() → Verdachtsfall schließen (dismiss | refute),
 *                          invalidiert Queue UND Metriken.
 */

import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query';

import {
    closeOeReviewItem,
    getOeMetrics,
    getOeReviewQueue,
    getPartslinkComparisons,
    type OeMetrics,
    type PartslinkComparisonItem,
    type PartslinkComparisonStatus,
    type OeReviewCloseAction,
    type OeReviewCloseResponse,
    type OeReviewItem,
} from '@/api/oeQuality';

/** Gemeinsamer Query-Key-Prefix — eine Invalidierung trifft Queue + Metriken. */
const OE_QUALITY_KEY = ['admin', 'oe-quality'] as const;

const READ_OPTIONS = { staleTime: 30_000, gcTime: 5 * 60_000 } as const;

export function useOeMetrics(): {
    metrics: OeMetrics | null;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey: [...OE_QUALITY_KEY, 'metrics'] as const,
        queryFn: () => getOeMetrics(),
        ...READ_OPTIONS,
    });
    return {
        metrics: q.data ?? null,
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}

export function useOeReviewQueue(
    status = 'open',
    limit = 50,
): {
    items: OeReviewItem[];
    /** Backend-`error`-Feld (z. B. Migration 170 nicht aktiv) — KEIN Fetch-Fehler. */
    backendError: string | null;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey: [...OE_QUALITY_KEY, 'queue', { status, limit }] as const,
        queryFn: () => getOeReviewQueue(status, limit),
        ...READ_OPTIONS,
    });
    return {
        items: q.data?.items ?? [],
        backendError: q.data?.error ?? null,
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}

export function usePartslinkComparisons(
    status: PartslinkComparisonStatus = 'mismatch',
    limit = 50,
): {
    items: PartslinkComparisonItem[];
    backendError: string | null;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey: [...OE_QUALITY_KEY, 'partslink-comparisons', { status, limit }] as const,
        queryFn: () => getPartslinkComparisons(status, limit),
        ...READ_OPTIONS,
        refetchInterval: 30_000,
    });
    return {
        items: q.data?.items ?? [],
        backendError: q.data?.error ?? null,
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}

export interface CloseReviewItemInput {
    id: string;
    action: OeReviewCloseAction;
}

export function useCloseReviewItem(): UseMutationResult<
    OeReviewCloseResponse,
    Error,
    CloseReviewItemInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, action }) => closeOeReviewItem(id, action),
        onSuccess: () => {
            // Prefix-Invalidierung: trifft Queue UND Metriken (offene Fälle,
            // Wissens-Total nach refute).
            void qc.invalidateQueries({ queryKey: OE_QUALITY_KEY });
        },
    });
}
