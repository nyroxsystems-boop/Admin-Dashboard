import type { InboxMessage } from '@/api/types';
import type { DraftAttachment } from '@/api/inbox';
import { parseEmailAddresses } from '@/utils/emailAddresses';
import { emailHtmlToPlainText, plainTextToEmailHtml, sanitizeEmailEditorHtml } from '@/utils/emailHtml';

export type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward' | 'draft';
export interface ComposeSeed {
    mode?: ComposeMode;
    from?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    body?: string;
    html?: string;
    replyToMessageId?: string;
    draftId?: string;
    attachments?: DraftAttachment[];
    original?: InboxMessage;
}

export const COMPOSE_TITLES: Record<ComposeMode, string> = {
    new: 'Neue E-Mail', reply: 'Antwort verfassen', replyAll: 'Allen antworten', forward: 'E-Mail weiterleiten', draft: 'Entwurf bearbeiten',
};

export function prefixSubject(subject: string | null | undefined, prefix: 'Re' | 'Fwd'): string {
    const value = subject || '';
    return (prefix === 'Re' ? /^(re|aw|antw):/i : /^(fwd|fw|wg):/i).test(value.trim()) ? value : `${prefix}: ${value}`;
}

/** Bcc is deliberately never copied from an original message into any reply. */
export function replyRecipients(message: InboxMessage, ownAddresses: string[], all: boolean): { to: string[]; cc: string[] } {
    const own = new Set(ownAddresses.map(address => address.toLowerCase()));
    const external = (addresses: string[]) => parseEmailAddresses(addresses.join('; ')).filter(address => !own.has(address));
    const primary = message.direction === 'outbound' ? message.to : [message.from];
    const to = external(all ? [...primary, ...message.to] : primary);
    const seen = new Set(to);
    return { to, cc: all ? external(message.cc).filter(address => !seen.has(address)) : [] };
}

export function messagePlainText(message: InboxMessage): string {
    if (message.body?.trim()) return message.body;
    return emailHtmlToPlainText(message.html || '').trim();
}

export function originalQuote(message: InboxMessage): string {
    return [
        '---------- Ursprüngliche Nachricht ----------',
        `Von: ${message.from_name ? `${message.from_name} <${message.from}>` : message.from}`,
        `Datum: ${new Date(message.received_at).toLocaleString('de-DE')}`,
        `An: ${message.to.join(', ')}`,
        message.cc.length ? `Cc: ${message.cc.join(', ')}` : '',
        `Betreff: ${message.subject || '(ohne Betreff)'}`, '', messagePlainText(message),
    ].filter((line, index) => line || index > 5).join('\n');
}

/** Only call this with the full draft response, never the 200-character list preview. */
export function seedFromDraft(message: InboxMessage): ComposeSeed {
    const html = sanitizeEmailEditorHtml(message.html || plainTextToEmailHtml(message.body || ''));
    return {
        mode: 'draft', draftId: message.id, from: message.from,
        to: message.to.join('; '), cc: message.cc.join('; '), bcc: message.bcc.join('; '),
        subject: message.subject || '', body: messagePlainText(message), html,
        replyToMessageId: message.in_reply_to || undefined,
        attachments: message.attachments.map(attachment => ({ id: attachment.id, filename: attachment.filename || 'Anhang', content_type: attachment.content_type, byte_size: attachment.size ?? 0 })),
    };
}

export const ATTACHMENT_LIMITS = { count: 10, file: 10 * 1024 * 1024, total: 20 * 1024 * 1024 };
export function attachmentProblem(existing: DraftAttachment[], files: { name: string; size: number }[]): string | null {
    if (existing.length + files.length > ATTACHMENT_LIMITS.count) return 'Höchstens 10 Anhänge pro E-Mail. Bitte die Auswahl verkleinern.';
    const oversized = files.find(file => file.size > ATTACHMENT_LIMITS.file);
    if (oversized) return `${oversized.name}: Die Datei überschreitet 10 MB.`;
    if (existing.reduce((sum, file) => sum + file.byte_size, 0) + files.reduce((sum, file) => sum + file.size, 0) > ATTACHMENT_LIMITS.total) return 'Alle Anhänge zusammen dürfen 20 MB nicht überschreiten.';
    return null;
}

export function mentionsAttachment(text: string): boolean { return /\b(anhang|angehängt|beigefügt|anbei|attached|attachment)\b/i.test(text); }
