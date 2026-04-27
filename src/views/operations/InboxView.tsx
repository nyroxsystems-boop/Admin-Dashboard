/**
 * InboxView — Mailbox switcher + message list with read/unread state.
 */
import { toast } from 'sonner';

import { useInbox, useMailboxes, useMarkInboxRead } from '@/hooks/useInbox';
import { LoadingState } from '@/components/feedback/LoadingState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/utils/format/date';

export default function InboxView(): JSX.Element {
    const { mailboxes, isLoading: mailboxesLoading } = useMailboxes();
    const { items, activeMailbox, setActiveMailbox, isLoading } = useInbox();
    const markReadMut = useMarkInboxRead();

    function preview(body: string | null | undefined): string {
        if (!body) return '';
        return body.length > 100 ? body.slice(0, 100) + '…' : body;
    }

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">Inbox</h1>
                <p className="text-sm text-text-secondary">Eingehende Bot- und Support-Nachrichten.</p>
            </header>

            <div role="tablist" aria-label="Mailboxes" className="flex gap-1 mb-6 border-b border-border">
                {mailboxesLoading ? (
                    <span className="text-xs text-text-muted px-4 py-2">Lade Mailboxen…</span>
                ) : mailboxes.length === 0 ? (
                    <span className="text-xs text-text-muted px-4 py-2">Keine Mailboxen.</span>
                ) : (
                    mailboxes.map((m) => (
                        <button
                            key={m.id}
                            role="tab"
                            aria-selected={activeMailbox === m.id}
                            onClick={() => setActiveMailbox(m.id)}
                            className={cn(
                                'px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
                                activeMailbox === m.id
                                    ? 'border-accent-500 text-text-primary font-medium'
                                    : 'border-transparent text-text-secondary hover:text-text-primary',
                            )}
                        >
                            {m.name}
                            {m.unread > 0 && (
                                <span className="ml-2 text-[10px] font-mono px-1.5 rounded bg-accent-500/20 text-accent-500">
                                    {m.unread}
                                </span>
                            )}
                        </button>
                    ))
                )}
            </div>

            {isLoading ? (
                <LoadingState label="Lade Inbox…" />
            ) : items.length === 0 ? (
                <EmptyState
                    title="Keine Nachrichten"
                    description={`Keine Items in der Mailbox "${activeMailbox || 'default'}".`}
                />
            ) : (
                <ul className="space-y-2">
                    {items.map((item) => (
                        <li
                            key={item.id}
                            className={cn(
                                'rounded-md border p-3 transition-colors',
                                item.is_read
                                    ? 'border-border bg-surface/30'
                                    : 'border-accent-500/30 bg-accent-500/5',
                            )}
                        >
                            <div className="flex justify-between items-baseline gap-3">
                                <span className="font-medium truncate">{item.subject ?? '(ohne Betreff)'}</span>
                                <span className="text-xs text-text-muted shrink-0">
                                    {formatRelative(item.received_at)}
                                </span>
                            </div>
                            <div className="text-xs text-text-muted">{item.from}</div>
                            <div className="text-sm text-text-secondary mt-1 line-clamp-2">
                                {preview(item.body)}
                            </div>
                            {!item.is_read && (
                                <div className="mt-2 flex justify-end">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                            markReadMut.mutate(
                                                { id: item.id, isRead: true },
                                                {
                                                    onSuccess: () =>
                                                        toast.success('Als gelesen markiert.'),
                                                    onError: (e) =>
                                                        toast.error(
                                                            e instanceof Error
                                                                ? e.message
                                                                : 'Fehler.',
                                                        ),
                                                },
                                            )
                                        }
                                    >
                                        Als gelesen markieren
                                    </Button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
