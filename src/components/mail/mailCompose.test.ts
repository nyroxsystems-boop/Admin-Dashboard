import { describe, expect, it } from 'vitest';
import { InboxMessageSchema } from '@/api/types';
import { attachmentProblem, mentionsAttachment, messagePlainText, originalQuote, prefixSubject, replyRecipients, seedFromDraft } from './mailCompose';

const message = InboxMessageSchema.parse({ id: 'm1', from: 'kunde@example.test', to: ['info@partsunion.de', 'kunde@example.test', 'partner@example.test'], cc: ['service@partsunion.de', 'partner@example.test', 'einkauf@example.test'], bcc: ['private@example.test'], subject: 'Rückfrage', body: 'Vollständiger Text', received_at: '2026-09-04T10:00:00Z' });
describe('mail composition rules', () => {
    it('replies to the sender only and never copies Bcc', () => {
        expect(replyRecipients(message, ['info@partsunion.de'], false)).toEqual({ to: ['kunde@example.test'], cc: [] });
    });
    it('reply-all excludes own senders and de-duplicates visible recipients across An/Cc', () => {
        expect(replyRecipients(message, ['INFO@PARTSUNION.DE', 'service@partsunion.de'], true)).toEqual({ to: ['kunde@example.test', 'partner@example.test'], cc: ['einkauf@example.test'] });
    });
    it('preserves draft Cc/Bcc, full HTML, attachment data and the internal reply ID', () => {
        const seed = seedFromDraft({ ...message, folder: 'drafts', html: '<p><strong>Wichtig</strong></p><script>bad()</script>', in_reply_to: 'internal-original-id', body: 'Long draft '.repeat(100), attachments: [{ id: 'file1', filename: 'Angebot.pdf', content_type: 'application/pdf', size: 900 }] });
        expect(seed.cc).toContain('einkauf@example.test'); expect(seed.bcc).toBe('private@example.test');
        expect(seed.body?.length).toBeGreaterThan(200); expect(seed.html).toContain('<strong>Wichtig</strong>'); expect(seed.html).not.toContain('script');
        expect(seed.replyToMessageId).toBe('internal-original-id'); expect(seed.attachments?.[0].byte_size).toBe(900);
    });
    it('quotes HTML-only email text without scripts, private recipients or internal notes', () => {
        const original = { ...message, body: null, html: '<p>Zeile eins<br>Zeile zwei</p><script>bad()</script>', assignment_notes: 'INTERNAL ONLY' };
        expect(messagePlainText(original)).toContain('Zeile eins\nZeile zwei');
        expect(originalQuote(original)).not.toMatch(/private@example|INTERNAL ONLY|bad\(\)/);
    });
    it('does not stack German or English subject prefixes', () => {
        expect(prefixSubject('AW: Rückfrage', 'Re')).toBe('AW: Rückfrage');
        expect(prefixSubject('WG: Unterlagen', 'Fwd')).toBe('WG: Unterlagen');
    });
    it('checks attachment count, file size and combined size before upload', () => {
        expect(attachmentProblem([], [{ name: 'gross.pdf', size: 11 * 1024 * 1024 }])).toContain('gross.pdf');
        expect(attachmentProblem([], Array.from({ length: 11 }, () => ({ name: 'a', size: 1 })))).toContain('10 Anhänge');
        expect(attachmentProblem([{ id: 'a', filename: 'a', byte_size: 15 * 1024 * 1024, content_type: 'x' }], [{ name: 'b', size: 6 * 1024 * 1024 }])).toContain('20 MB');
        expect(attachmentProblem([], [{ name: 'gut.pdf', size: 20 }])).toBeNull();
    });
    it('recognizes a mentioned attachment without inventing an attached file', () => {
        expect(mentionsAttachment('Anbei die Unterlagen.')).toBe(true);
        expect(mentionsAttachment('Vielen Dank für die Rückmeldung.')).toBe(false);
    });
});
