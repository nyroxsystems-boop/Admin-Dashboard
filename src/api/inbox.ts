/**
 * Inbox API — list mailboxes, fetch messages, mark read/unread.
 */

import { apiFetch } from './client';
import { InboxMessageSchema, parseApiResponse } from './types';
import { z } from 'zod';

export interface InboxQuery {
    mailbox?: string;
    limit?: number;
    cursor?: string;
    unreadOnly?: boolean;
}

const InboxPageSchema = z.object({
    messages: z.array(InboxMessageSchema),
    cursor: z.string().nullish(),
    hasMore: z.boolean().optional(),
});
export type InboxPage = z.infer<typeof InboxPageSchema>;

export async function listInboxMessages(query: InboxQuery = {}): Promise<InboxPage> {
    const params = new URLSearchParams();
    if (query.mailbox) params.set('mailbox', query.mailbox);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.unreadOnly) params.set('unread', '1');
    const qs = params.toString();
    const raw = await apiFetch<unknown>(`/api/admin/inbox${qs ? `?${qs}` : ''}`);
    return parseApiResponse(InboxPageSchema, raw);
}

export async function markInboxRead(id: string, isRead = true): Promise<{ success: boolean }> {
    return apiFetch(`/api/admin/inbox/${id}/read`, {
        method: 'PATCH',
        body: JSON.stringify({ is_read: isRead }),
    });
}

export async function listMailboxes(): Promise<{ mailboxes: Array<{ id: string; name: string; unread: number }> }> {
    return apiFetch('/api/admin/inbox/mailboxes');
}

export async function replyInboxMessage(
    id: string,
    body: string
): Promise<{ success: boolean }> {
    return apiFetch(`/api/admin/inbox/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ body }),
    });
}
