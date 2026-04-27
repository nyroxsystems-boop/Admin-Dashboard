/**
 * useInbox — paginated inbox listing + mailbox switching + reply.
 *
 * Differences from previous stub shape:
 *   - Items are InboxMessage from src/api/types.ts, with snake_case fields:
 *     id, from, subject, body, received_at, is_read, mailbox.
 *     The legacy `InboxItem` shape (status / preview / receivedAt) is gone.
 *   - activeMailbox is now a free-form string (mailbox.id from listMailboxes),
 *     not the literal union 'orders' | 'support' | 'invoices'.
 *   - Mailboxes are fetched separately via useMailboxes.
 *   - Pagination uses cursor (returned by listInboxMessages).
 */

import { useState } from 'react';
import {
    useQuery,
    useMutation,
    useQueryClient,
    useInfiniteQuery,
    type UseMutationResult,
} from '@tanstack/react-query';
import {
    listInboxMessages,
    listMailboxes,
    markInboxRead,
    replyInboxMessage,
    type InboxQuery,
} from '@/api/inbox';
import type { InboxMessage } from '@/api/types';

export type InboxItem = InboxMessage;

const READ_OPTIONS = { staleTime: 30_000, gcTime: 5 * 60_000 } as const;

export function useInbox(query: InboxQuery = {}): {
    items: InboxMessage[];
    isLoading: boolean;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
    fetchNextPage: () => void;
    error: unknown;
    activeMailbox: string;
    setActiveMailbox: (m: string) => void;
    refetch: () => void;
} {
    const [activeMailbox, setActiveMailbox] = useState<string>(query.mailbox ?? '');

    const q = useInfiniteQuery({
        queryKey: ['admin', 'inbox', { ...query, mailbox: activeMailbox || undefined }] as const,
        queryFn: ({ pageParam }) =>
            listInboxMessages({
                ...query,
                mailbox: activeMailbox || query.mailbox,
                cursor: pageParam ?? undefined,
            }),
        initialPageParam: null as string | null,
        getNextPageParam: (last) => {
            if (last.hasMore === false) return undefined;
            return last.cursor ?? undefined;
        },
        ...READ_OPTIONS,
    });

    const items = q.data?.pages.flatMap((p) => p.messages) ?? [];
    return {
        items,
        isLoading: q.isLoading,
        isFetchingNextPage: q.isFetchingNextPage,
        hasNextPage: !!q.hasNextPage,
        fetchNextPage: () => void q.fetchNextPage(),
        error: q.error,
        activeMailbox,
        setActiveMailbox,
        refetch: () => void q.refetch(),
    };
}

export function useMailboxes(): {
    mailboxes: Array<{ id: string; name: string; unread: number }>;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey: ['admin', 'inbox', 'mailboxes'] as const,
        queryFn: async () => {
            const res = await listMailboxes();
            return res.mailboxes;
        },
        ...READ_OPTIONS,
    });
    return {
        mailboxes: q.data ?? [],
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}

export interface MarkInboxReadInput {
    id: string;
    isRead?: boolean;
}

export function useMarkInboxRead(): UseMutationResult<
    { success: boolean },
    Error,
    MarkInboxReadInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, isRead = true }) => markInboxRead(id, isRead),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['admin', 'inbox'] });
        },
    });
}

export interface ReplyInboxInput {
    id: string;
    body: string;
}

export function useReplyInbox(): UseMutationResult<
    { success: boolean },
    Error,
    ReplyInboxInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }) => replyInboxMessage(id, body),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['admin', 'inbox'] });
        },
    });
}
