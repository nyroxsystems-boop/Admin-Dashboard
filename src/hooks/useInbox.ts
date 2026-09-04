/** React Query hooks for the Resend-backed admin mailbox. */
import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query';

import {
    listInboxMessages,
    listMailboxes,
    markAsNotSpam,
    markAsSpam,
    markInboxRead,
    moveInboxMessage,
    replyInboxMessage,
    restoreInboxMessage,
    sendInboxEmail,
    type InboxQuery,
    type MailboxSummary,
    type MovableFolder,
    type SendInboxEmailInput,
} from '@/api/inbox';
import type { InboxMessage } from '@/api/types';
import { useAuth } from '@/context/AuthContext';

export type InboxItem = InboxMessage;

// KEIN eigenes gcTime: die globale Ablagezeit (30 Minuten, App.tsx) gilt —
// die Postfachzahlen speisen auch die Uebersicht und die Glocke.
const READ_OPTIONS = { staleTime: 15_000 } as const;

export function useInbox(query: InboxQuery = {}) {
    const q = useInfiniteQuery({
        queryKey: ['admin', 'inbox', 'messages', query] as const,
        queryFn: ({ pageParam }) => listInboxMessages({
            ...query,
            cursor: pageParam ?? undefined,
        }),
        initialPageParam: null as string | null,
        getNextPageParam: (last) => last.hasMore ? (last.cursor ?? undefined) : undefined,
        ...READ_OPTIONS,
    });

    return {
        items: q.data?.pages.flatMap((page) => page.messages) ?? [],
        isLoading: q.isLoading,
        isFetching: q.isFetching,
        isFetchingNextPage: q.isFetchingNextPage,
        hasNextPage: Boolean(q.hasNextPage),
        fetchNextPage: () => void q.fetchNextPage(),
        error: q.error,
        refetch: () => void q.refetch(),
    };
}

export function useMailboxes(): {
    mailboxes: MailboxSummary[];
    sendingAddresses: string[];
    transport: 'resend' | null;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const { user } = useAuth();
    const q = useQuery({
        // Postfachdaten sind personenbezogen. Die Admin-ID im Schluessel
        // verhindert, dass beim Kontowechsel auch nur kurz das persoenliche
        // Postfach des vorherigen Benutzers aus dem Cache erscheint.
        queryKey: ['admin', 'inbox', 'mailboxes', user?.id ?? 'anonymous'] as const,
        queryFn: listMailboxes,
        ...READ_OPTIONS,
    });
    return {
        mailboxes: q.data?.mailboxes ?? [],
        sendingAddresses: q.data?.sendingAddresses ?? [],
        transport: q.data?.transport ?? null,
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

export interface MoveInboxInput {
    id: string;
    folder: MovableFolder;
}

export function useMoveInboxMessage(): UseMutationResult<
    { success: boolean; folder: string },
    Error,
    MoveInboxInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, folder }) => moveInboxMessage(id, folder),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['admin', 'inbox'] });
        },
    });
}

export function useRestoreInboxMessage(): UseMutationResult<
    { success: boolean },
    Error,
    string
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => restoreInboxMessage(id),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['admin', 'inbox'] });
        },
    });
}

export interface MarkSpamInput {
    id: string;
    blockSender: boolean;
}

export function useMarkAsSpam(): UseMutationResult<
    { success: boolean; blocked: boolean },
    Error,
    MarkSpamInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, blockSender }) => markAsSpam(id, blockSender),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['admin', 'inbox'] });
        },
    });
}

export function useMarkAsNotSpam(): UseMutationResult<{ success: boolean }, Error, string> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => markAsNotSpam(id),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['admin', 'inbox'] });
        },
    });
}

export function useSendInboxEmail(): UseMutationResult<
    { success: boolean; messageId: string },
    Error,
    SendInboxEmailInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: sendInboxEmail,
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['admin', 'inbox'] });
        },
    });
}

export interface ReplyInboxInput {
    id: string;
    to: string;
    subject: string;
    body: string;
    from?: string;
}

export function useReplyInbox(): UseMutationResult<
    { success: boolean },
    Error,
    ReplyInboxInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: replyInboxMessage,
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['admin', 'inbox'] });
        },
    });
}
