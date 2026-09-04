/**
 * useAuditLogs — cursor-paginated infinite query against /api/admin/audit-log.
 *
 * Differences from previous stub shape:
 *   - AuditLog field names use snake_case (admin_username, action_type,
 *     entity_type, entity_id, ip_address, etc.) — see src/api/types.ts
 *   - Page returns { logs, cursor, hasMore } instead of { items, nextCursor }
 *   - useExportAuditCsv added — returns Blob via mutation
 */

import {
    useInfiniteQuery,
    useMutation,
    type UseMutationResult,
} from '@tanstack/react-query';
import { getAuditLog, exportAuditLogCsv, type AuditLogQuery } from '@/api/audit';
import type { AuditLog } from '@/api/types';

const PAGE_SIZE = 25;

export function useAuditLogs(query: AuditLogQuery = {}): {
    entries: AuditLog[];
    isLoading: boolean;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
    fetchNextPage: () => void;
    refetch: () => void;
    error: unknown;
} {
    const q = useInfiniteQuery({
        queryKey: ['admin', 'audit', query] as const,
        queryFn: ({ pageParam }) =>
            getAuditLog({
                ...query,
                limit: query.limit ?? PAGE_SIZE,
                cursor: pageParam ?? undefined,
            }),
        initialPageParam: null as string | null,
        getNextPageParam: (last) => {
            if (last.hasMore === false) return undefined;
            return last.cursor ?? undefined;
        },
        staleTime: 30_000,
        /**
         * KEIN eigenes gcTime: die globale Ablagezeit (30 Minuten, App.tsx)
         * wurde genau fuer den Rueckweg aus dem Mailprogramm gesetzt. Ein
         * 5-Minuten-Wert hier hebelte sie wieder aus — wer laenger als fuenf
         * Minuten Post gelesen hat, bekam wieder Skelette statt Zahlen.
         */
    });
    const entries: AuditLog[] = q.data?.pages.flatMap((p) => p.logs) ?? [];
    return {
        entries,
        isLoading: q.isLoading,
        isFetchingNextPage: q.isFetchingNextPage,
        hasNextPage: !!q.hasNextPage,
        fetchNextPage: () => void q.fetchNextPage(),
        refetch: () => void q.refetch(),
        error: q.error,
    };
}

export function useExportAuditCsv(): UseMutationResult<Blob, Error, AuditLogQuery | undefined> {
    return useMutation({
        mutationFn: (query) => exportAuditLogCsv(query ?? {}),
    });
}
