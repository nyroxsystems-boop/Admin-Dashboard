/**
 * Inbox API — adapts the bot-service /api/inbox/* shape into the dashboard's
 * paginated InboxPage. The backend has NO /api/admin/inbox prefix and NO
 * /mailboxes endpoint — we synthesize one mailbox ("shared") so the UI
 * keeps its tab structure.
 */

import { apiFetch } from './client';
import { InboxMessageSchema } from './types';
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
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('offset', query.cursor); // backend uses offset
    if (query.unreadOnly) params.set('unread', '1');
    const qs = params.toString();
    const raw = await apiFetch<unknown>(`/api/inbox/emails${qs ? `?${qs}` : ''}`);

    // Be tolerant: backend may return [] or {emails: []} or {items: []}.
    let arr: unknown[] = [];
    if (Array.isArray(raw)) arr = raw;
    else if (raw && typeof raw === 'object') {
        const r = raw as Record<string, unknown>;
        if (Array.isArray(r.emails)) arr = r.emails;
        else if (Array.isArray(r.items)) arr = r.items;
        else if (Array.isArray(r.messages)) arr = r.messages;
    }
    const parsed = z.array(InboxMessageSchema).safeParse(arr);
    return {
        messages: parsed.success ? parsed.data : [],
        cursor: null,
        hasMore: false,
    };
}

export async function markInboxRead(id: string, _isRead = true): Promise<{ success: boolean }> {
    await apiFetch(`/api/inbox/email/${id}/read`, { method: 'PATCH' });
    return { success: true };
}

/**
 * The bot-service has no /mailboxes endpoint. Surface a single static
 * "shared" mailbox so the UI keeps its tab structure.
 */
export async function listMailboxes(): Promise<{
    mailboxes: Array<{ id: string; name: string; unread: number }>;
}> {
    return Promise.resolve({
        mailboxes: [{ id: 'shared', name: 'Shared Inbox', unread: 0 }],
    });
}

export async function replyInboxMessage(
    id: string,
    body: string
): Promise<{ success: boolean }> {
    await apiFetch(`/api/inbox/email/send`, {
        method: 'POST',
        body: JSON.stringify({ replyToUid: id, body }),
    });
    return { success: true };
}
