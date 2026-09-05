import type { InboxMessage } from '@/api/types';

/** Keep the operator in flow after an item leaves the current result set. */
export function nextInboxMessageId(items: Pick<InboxMessage, 'id'>[], currentId: string): string | null {
    const index = items.findIndex(item => item.id === currentId);
    if (index < 0 || items.length < 2) return null;
    return items[index + 1]?.id ?? items[index - 1]?.id ?? null;
}
export function inboxAttention(message: Pick<InboxMessage, 'direction' | 'assignment_status' | 'received_at'>, now = Date.now()): { label: string; urgent: boolean } | null {
    if (message.direction !== 'inbound' || message.assignment_status === 'done') return null;
    const received = Date.parse(message.received_at);
    if (!Number.isFinite(received) || received > now) return null;
    const days = Math.floor((now - received) / 86_400_000);
    if (days < 1) return null;
    return { label: `Seit ${days} Tag${days === 1 ? '' : 'en'} offen`, urgent: days >= 3 };
}
