import { describe, expect, it } from 'vitest';
import { inboxAttention, nextInboxMessageId } from './inboxWorkspace';

describe('inbox workspace', () => {
    it('continues with the following item or the previous item at the end', () => {
        const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
        expect(nextInboxMessageId(items, 'a')).toBe('b');
        expect(nextInboxMessageId(items, 'b')).toBe('c');
        expect(nextInboxMessageId(items, 'c')).toBe('b');
        expect(nextInboxMessageId(items, 'missing')).toBeNull();
    });
    it('flags only old inbound work and distinguishes urgent items', () => {
        const now = Date.parse('2026-09-05T12:00:00Z');
        expect(inboxAttention({ direction: 'inbound', assignment_status: 'open', received_at: '2026-09-04T11:00:00Z' }, now)).toEqual({ label: 'Seit 1 Tag offen', urgent: false });
        expect(inboxAttention({ direction: 'inbound', assignment_status: 'in_progress', received_at: '2026-09-01T11:00:00Z' }, now)).toEqual({ label: 'Seit 4 Tagen offen', urgent: true });
        expect(inboxAttention({ direction: 'inbound', assignment_status: 'done', received_at: '2026-08-01T11:00:00Z' }, now)).toBeNull();
        expect(inboxAttention({ direction: 'outbound', assignment_status: 'open', received_at: '2026-08-01T11:00:00Z' }, now)).toBeNull();
    });
});
