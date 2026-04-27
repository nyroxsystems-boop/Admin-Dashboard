/**
 * useOemErrors — list of unresolved OEM-resolution errors.
 *
 * Replaces the localStorage error-review system that lived in the old
 * ErrorReviewView. Backed by /api/admin/oem-errors.
 */

import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query';
import { listOemErrors, resolveOemError, type OemErrorEntry } from '@/api/oem';

const ERRORS_KEY = ['admin', 'oem', 'errors'] as const;

export function useOemErrors(): {
    entries: OemErrorEntry[];
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey: ERRORS_KEY,
        queryFn: () => listOemErrors(),
        staleTime: 30_000,
        gcTime: 5 * 60_000,
    });
    return {
        entries: q.data ?? [],
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}

export function useResolveOemError(): UseMutationResult<
    { success: boolean },
    Error,
    string | number
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => resolveOemError(id),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ERRORS_KEY });
        },
    });
}

export type { OemErrorEntry };
