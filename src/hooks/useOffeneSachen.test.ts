import { describe, expect, it } from 'vitest';

import type { MailboxSummary } from '@/api/inbox';

import { zaehleUngeleseneMails } from './useOffeneSachen';

function mailbox(id: string, unread: number): MailboxSummary {
    return {
        id,
        name: id,
        address: null,
        kind: 'shared',
        unread,
        total: unread,
        canSend: false,
        isBreakGlass: false,
        expiresAt: null,
    };
}

describe('ungelesene Nachrichten in der Kopfzeile', () => {
    it('verwendet die deduplizierte Gesamtsicht statt sie doppelt zu addieren', () => {
        expect(zaehleUngeleseneMails([
            mailbox('all', 3),
            mailbox('rechnung', 3),
        ])).toBe(3);
    });

    it('summiert echte Postfächer, wenn keine Gesamtsicht geliefert wird', () => {
        expect(zaehleUngeleseneMails([
            mailbox('rechnung', 3),
            mailbox('support', 2),
        ])).toBe(5);
    });
});
