/**
 * useOemRegistry — paginated OEM-records list + CRUD.
 *
 * Differences from previous stub shape:
 *   - OemRecord has many more fields (part_category, part_description, model,
 *     model_code, year_from, year_to, engine, sources). See src/api/types.ts.
 *   - Returns full pagination payload (records / total / page / limit / totalPages
 *     / filters) — `entries` getter still flattens to records[] for back-compat.
 *   - filter accepts the full OemSearchParams shape (page, limit, search, brand,
 *     category, modelCode, year, yearFrom, yearTo, sortBy, sortOrder)
 *   - source is `sources: string` (was `'verified'|'predicted'|'user-submitted'`)
 */

import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query';
import {
    getOemRecords,
    createOemRecord,
    updateOemRecord,
    deleteOemRecord,
    bulkDeleteOemRecords,
    type OemSearchParams,
} from '@/api/oem';
import type { OemRecord, OemRecordsResponse } from '@/api/types';

const REGISTRY_KEY = ['admin', 'oem', 'registry'] as const;

function stableStringify(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
    const o = obj as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
}

export function useOemRegistry(filter: OemSearchParams = {}): {
    data: OemRecordsResponse | null;
    entries: OemRecord[];
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey: [...REGISTRY_KEY, stableStringify(filter)] as const,
        queryFn: () => getOemRecords(filter),
        staleTime: 30_000,
        gcTime: 5 * 60_000,
    });
    return {
        data: q.data ?? null,
        entries: q.data?.records ?? [],
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}

export type CreateOemRecordInput = Omit<OemRecord, 'id' | 'created_at' | 'sources'>;

export function useCreateOemRecord(): UseMutationResult<
    { success: boolean; id: number },
    Error,
    CreateOemRecordInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => createOemRecord(input),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: REGISTRY_KEY });
        },
    });
}

export interface UpdateOemRecordInput {
    id: number;
    patch: Partial<OemRecord>;
}

export function useUpdateOemRecord(): UseMutationResult<
    { success: boolean },
    Error,
    UpdateOemRecordInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, patch }) => updateOemRecord(id, patch),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: REGISTRY_KEY });
        },
    });
}

export function useDeleteOemRecord(): UseMutationResult<{ success: boolean }, Error, number> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => deleteOemRecord(id),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: REGISTRY_KEY });
        },
    });
}

export function useBulkDeleteOemRecords(): UseMutationResult<
    { success: boolean; deleted: number },
    Error,
    number[]
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (ids) => bulkDeleteOemRecords(ids),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: REGISTRY_KEY });
        },
    });
}
