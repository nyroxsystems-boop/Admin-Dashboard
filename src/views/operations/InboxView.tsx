import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Archive,
    ArrowLeft,
    Bot,
    Download,
    FilePen,
    FileText,
    Forward,
    Inbox,
    Loader2,
    Mail,
    MailOpen,
    Paperclip,
    Pencil,
    RefreshCw,
    Reply,
    RotateCcw,
    Search,
    Send,
    ShieldAlert,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

import { MailHtmlFrame } from '@/components/mail/MailHtmlFrame';

import {
    createDraft,
    createEmailDraftSuggestion,
    deleteDraftAttachment,
    downloadInboxAttachment,
    suggestContacts,
    updateDraft,
    uploadDraftAttachment,
    type ContactSuggestion,
    type DraftAttachment,
    type DraftInput,
    type EmailDraftSuggestion,
    type EmailDraftTone,
    type InboxFolder,
    type SendInboxEmailInput,
    getInboxMessage,
} from '@/api/inbox';
import { getAdminProfile, updateSignature } from '@/api/auth';
import { isApiError } from '@/api/client';
import type { InboxMessage } from '@/api/types';
import {
    RichEmailEditor,
} from '@/components/mail/RichEmailEditor';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDebounce } from '@/hooks/useDebounce';
import {
    useInbox,
    useMailboxes,
    useMarkAsNotSpam,
    useMarkAsSpam,
    useMarkInboxRead,
    useMoveInboxMessage,
    useRestoreInboxMessage,
    useSendInboxEmail,
} from '@/hooks/useInbox';
import { invalidEmailAddresses, parseEmailAddresses } from '@/utils/emailAddresses';
import { plainTextToEmailHtml, sanitizeEmailEditorHtml } from '@/utils/emailHtml';
import { formatDateTime, formatRelative } from '@/utils/format/date';
import { cn } from '@/lib/utils';
import { SEITEN_RAND_OHNE_BREITE } from '@/components/ui/seite';

interface ComposeSeed {
    from?: string;
    to?: string;
    subject?: string;
    body?: string;
    replyToMessageId?: string;
    /** Gesetzt beim Weiterschreiben an einem gespeicherten Entwurf. */
    draftId?: string;
    attachments?: DraftAttachment[];
}

function sendErrorMessage(error: Error): string {
    if (isApiError(error) && error.body && typeof error.body === 'object') {
        const details = (error.body as { details?: Array<{ message?: string }> }).details;
        const detail = details?.find((item) => item.message)?.message;
        if (detail) return detail;
    }
    return error.message || 'E-Mail konnte nicht gesendet werden.';
}

function senderLabel(message: InboxMessage): string {
    if (message.direction === 'outbound') return message.to[0] || 'Unbekannter Empfänger';
    return message.from_name || message.from;
}

function initials(value: string): string {
    const clean = value.includes('@') ? value.split('@')[0] : value;
    return clean
        .split(/[\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'M';
}

function preview(value: string | null | undefined): string {
    return (value || '').replace(/\s+/g, ' ').trim() || 'Keine Vorschau verfügbar.';
}

const FOLDER_LABELS: Record<InboxFolder, string> = {
    inbox: 'Posteingang',
    sent: 'Gesendet',
    drafts: 'Entwürfe',
    archive: 'Archiv',
    trash: 'Papierkorb',
    spam: 'Spam',
};

const FOLDER_EMPTY_HINTS: Record<InboxFolder, string> = {
    inbox: 'Neue E-Mails erscheinen hier automatisch.',
    sent: 'Gesendete E-Mails erscheinen hier.',
    drafts: 'Angefangene E-Mails werden hier gespeichert.',
    archive: 'Archivierte E-Mails erscheinen hier.',
    trash: 'Gelöschte E-Mails bleiben hier, bis du sie wiederherstellst.',
    spam: 'Aussortierte E-Mails. Prüfe hier, falls etwas fehlt.',
};

const FOLDER_ICONS: Record<InboxFolder, typeof Inbox> = {
    inbox: Inbox,
    sent: Send,
    drafts: FilePen,
    archive: Archive,
    trash: Trash2,
    spam: ShieldAlert,
};

/** Zitat-Block für Weiterleitungen — Kopfzeilen wie in gängigen Mail-Clients. */
function forwardQuote(message: InboxMessage): string {
    const header = [
        `Von: ${message.from_name ? `${message.from_name} <${message.from}>` : message.from}`,
        `Datum: ${formatDateTime(message.received_at)}`,
        `An: ${message.to.join(', ') || 'Unbekannt'}`,
        message.cc.length > 0 ? `Cc: ${message.cc.join(', ')}` : null,
        `Betreff: ${message.subject || '(ohne Betreff)'}`,
    ].filter(Boolean).join('\n');

    return `\n\n---------- Weitergeleitete Nachricht ----------\n${header}\n\n${message.body || ''}`;
}

/** Betreff mit Präfix versehen, ohne bestehende Re:/Fwd:-Ketten zu verdoppeln. */
function prefixSubject(subject: string | null | undefined, prefix: 'Re' | 'Fwd'): string {
    const value = subject || '';
    const pattern = prefix === 'Re' ? /^re:/i : /^(fwd|fw):/i;
    return pattern.test(value.trim()) ? value : `${prefix}: ${value}`;
}

export default function InboxView(): JSX.Element {
    const [folder, setFolder] = useState<InboxFolder>('inbox');
    const [mailbox, setMailbox] = useState('all');
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [composeOpen, setComposeOpen] = useState(false);
    const [composeSeed, setComposeSeed] = useState<ComposeSeed>({});
    const [unreadOnly, setUnreadOnly] = useState(false);
    const debouncedSearch = useDebounce(search, 250);
    const searchRef = useRef<HTMLInputElement>(null);

    const mailboxQuery = useMailboxes();
    const inboxQuery = useInbox({
        mailbox,
        folder,
        search: debouncedSearch || undefined,
        unreadOnly: folder === 'inbox' && unreadOnly ? true : undefined,
        limit: 50,
    });
    const markRead = useMarkInboxRead();
    const moveMessage = useMoveInboxMessage();
    const markSpam = useMarkAsSpam();
    const markNotSpam = useMarkAsNotSpam();
    const restoreMessage = useRestoreInboxMessage();
    const selected = inboxQuery.items.find((item) => item.id === selectedId) ?? null;

    /**
     * Der volle Koerper kommt erst beim Oeffnen — die Liste traegt nur noch
     * eine Vorschau.
     *
     * Vorher verschickte die Liste fuer jede Nachricht das komplette HTML:
     * 50 Mails = 4,3 MB, eine einzelne davon 3,6 MB. Nach JEDER Aktion im
     * Postfach lud die Liste neu, und der Browser zerlegte die Megabytes auf
     * dem Hauptthread — der nachgemessene 3,3-Sekunden-Stau, in dem jeder
     * Klick (auch der auf "Dashboard") in der Warteschlange stand.
     *
     * `staleTime: 5 min`: eine geoeffnete Mail aendert ihren Koerper nicht.
     * Entwuerfe sind ausgenommen — die oeffnen den Verfasser, keinen Leser.
     */
    const vollAbfrage = useQuery({
        queryKey: ['admin', 'inbox', 'email', selectedId] as const,
        queryFn: () => getInboxMessage(selectedId as string),
        enabled: selectedId !== null && selected?.folder !== 'drafts',
        staleTime: 5 * 60_000,
    });
    const selectedVoll = vollAbfrage.data && vollAbfrage.data.id === selectedId
        ? vollAbfrage.data
        : null;
    const allUnread = mailboxQuery.mailboxes.find((item) => item.id === 'all')?.unread ?? 0;

    function selectFolder(nextFolder: InboxFolder): void {
        setFolder(nextFolder);
        setSelectedId(null);
    }

    function selectMailbox(nextMailbox: string): void {
        setMailbox(nextMailbox);
        setSelectedId(null);
    }

    /** Ein Entwurf wird zum Weiterschreiben geöffnet, nicht zum Lesen. */
    function openDraft(message: InboxMessage): void {
        openCompose({
            from: message.from,
            to: message.to.join('; '),
            subject: message.subject || '',
            body: message.body || '',
            replyToMessageId: message.in_reply_to || undefined,
            draftId: message.id,
            attachments: message.attachments.map((attachment) => ({
                id: attachment.id,
                filename: attachment.filename || 'Anhang',
                content_type: attachment.content_type,
                byte_size: attachment.size ?? 0,
            })),
        });
    }

    function selectMessage(message: InboxMessage): void {
        if (message.folder === 'drafts') {
            openDraft(message);
            return;
        }
        setSelectedId(message.id);
        // Im Ungelesen-Filter nicht automatisch als gelesen markieren — die
        // Nachricht würde sonst beim Öffnen aus der gefilterten Liste fallen.
        // Dort markiert der Nutzer bewusst über den Button oder „u“.
        if (unreadOnly) return;
        if (message.direction === 'inbound' && !message.is_read) {
            markRead.mutate({ id: message.id, isRead: true });
        }
    }

    function openCompose(seed: ComposeSeed = {}): void {
        setComposeSeed(seed);
        setComposeOpen(true);
    }

    function preferredSender(message: InboxMessage): string | undefined {
        return mailboxQuery.sendingAddresses.includes(message.mailbox || '')
            ? message.mailbox || undefined
            : mailboxQuery.sendingAddresses[0];
    }

    function replyTo(message: InboxMessage): void {
        openCompose({
            from: preferredSender(message),
            to: message.from,
            subject: prefixSubject(message.subject, 'Re'),
            replyToMessageId: message.id,
        });
    }

    /** Weiterleiten: kein replyToMessageId — die Mail startet einen eigenen Thread. */
    function forwardMessage(message: InboxMessage): void {
        openCompose({
            from: preferredSender(message),
            subject: prefixSubject(message.subject, 'Fwd'),
            body: forwardQuote(message),
        });
    }

    /** Nach dem Verschieben verschwindet die Nachricht aus der Liste. */
    function moveTo(message: InboxMessage, target: 'archive' | 'trash'): void {
        setSelectedId(null);
        moveMessage.mutate(
            { id: message.id, folder: target },
            {
                onSuccess: () => toast.success(
                    target === 'trash' ? 'In den Papierkorb verschoben.' : 'Archiviert.',
                ),
                onError: (error) => {
                    setSelectedId(message.id);
                    toast.error(error instanceof Error ? error.message : 'Verschieben fehlgeschlagen.');
                },
            },
        );
    }

    function restore(message: InboxMessage): void {
        setSelectedId(null);
        restoreMessage.mutate(message.id, {
            onSuccess: () => toast.success('Wiederhergestellt.'),
            onError: (error) => {
                setSelectedId(message.id);
                toast.error(error instanceof Error ? error.message : 'Wiederherstellen fehlgeschlagen.');
            },
        });
    }

    /**
     * Als Spam markieren. Der Absender wird dabei für die betroffenen
     * Postfächer gesperrt — wer eine Mail als Spam einstuft, will die nächste
     * desselben Absenders in aller Regel auch nicht sehen.
     */
    function reportSpam(message: InboxMessage): void {
        setSelectedId(null);
        markSpam.mutate(
            { id: message.id, blockSender: true },
            {
                onSuccess: () => toast.success(`Als Spam markiert. ${message.from} ist jetzt gesperrt.`),
                onError: (error) => {
                    setSelectedId(message.id);
                    toast.error(error instanceof Error ? error.message : 'Markieren fehlgeschlagen.');
                },
            },
        );
    }

    function reportNotSpam(message: InboxMessage): void {
        setSelectedId(null);
        markNotSpam.mutate(message.id, {
            onSuccess: () => toast.success('Kein Spam — Absender wieder freigegeben.'),
            onError: (error) => {
                setSelectedId(message.id);
                toast.error(error instanceof Error ? error.message : 'Freigeben fehlgeschlagen.');
            },
        });
    }

    function toggleRead(message: InboxMessage): void {
        markRead.mutate(
            { id: message.id, isRead: !message.is_read },
            {
                onError: (error) => toast.error(
                    error instanceof Error ? error.message : 'Status konnte nicht geändert werden.',
                ),
            },
        );
    }

    function refresh(): void {
        inboxQuery.refetch();
        mailboxQuery.refetch();
    }

    // Tastaturkürzel. Der Ref hält den aktuellen Zustand, damit der Listener
    // nur einmal registriert wird statt bei jedem Render. Die Zuweisung läuft
    // im Effect (nicht im Render), sonst wäre der Ref-Zugriff unsauber.
    const shortcutState = useRef({
        items: inboxQuery.items,
        selected,
        composeOpen,
        folder,
        selectMessage,
        replyTo,
        forwardMessage,
        toggleRead,
        openCompose,
        moveTo,
        restore,
    });

    useEffect(() => {
        shortcutState.current = {
            items: inboxQuery.items,
            selected,
            composeOpen,
            folder,
            selectMessage,
            replyTo,
            forwardMessage,
            toggleRead,
            openCompose,
            moveTo,
            restore,
        };
    });

    useEffect(() => {
        function isTyping(target: EventTarget | null): boolean {
            if (!(target instanceof HTMLElement)) return false;
            return target.isContentEditable
                || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
        }

        function onKeyDown(event: KeyboardEvent): void {
            const state = shortcutState.current;
            if (state.composeOpen || event.metaKey || event.ctrlKey || event.altKey) return;

            if (event.key === 'Escape') {
                if (isTyping(event.target)) (event.target as HTMLElement).blur();
                else if (state.selected) setSelectedId(null);
                return;
            }
            if (isTyping(event.target)) return;

            if (event.key === '/') {
                event.preventDefault();
                searchRef.current?.focus();
                return;
            }

            if (event.key === 'j' || event.key === 'k') {
                if (state.items.length === 0) return;
                event.preventDefault();
                const current = state.selected
                    ? state.items.findIndex((item) => item.id === state.selected?.id)
                    : -1;
                const step = event.key === 'j' ? 1 : -1;
                // Ohne Auswahl startet j oben und k unten.
                const next = current === -1
                    ? (step === 1 ? 0 : state.items.length - 1)
                    : Math.min(Math.max(current + step, 0), state.items.length - 1);
                state.selectMessage(state.items[next]);
                return;
            }

            if (event.key === 'n') {
                event.preventDefault();
                state.openCompose();
                return;
            }

            if (!state.selected) return;
            if (event.key === 'r' && state.selected.direction === 'inbound') {
                event.preventDefault();
                state.replyTo(state.selected);
            } else if (event.key === 'f') {
                event.preventDefault();
                state.forwardMessage(state.selected);
            } else if (event.key === 'u' && state.selected.direction === 'inbound') {
                event.preventDefault();
                state.toggleRead(state.selected);
            } else if (event.key === 'e' && state.folder !== 'archive' && state.folder !== 'trash') {
                event.preventDefault();
                state.moveTo(state.selected, 'archive');
            } else if ((event.key === 'Delete' || event.key === '#') && state.folder !== 'trash') {
                event.preventDefault();
                state.moveTo(state.selected, 'trash');
            } else if (event.key === 'z' && state.folder === 'trash') {
                event.preventDefault();
                state.restore(state.selected);
            }
        }

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <div className="flex h-full min-h-[520px] flex-col overflow-hidden bg-canvas">
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface px-4 md:px-5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-semibold tracking-tight">Mail</h1>
                        <span className="hidden rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success sm:inline-flex">
                            Resend
                        </span>
                    </div>
                    <p className="hidden text-xs text-text-muted sm:block">Partsunion Team-Postfächer</p>
                </div>

                <div className="relative ml-auto w-full max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
                    <Input
                        ref={searchRef}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="E-Mails durchsuchen  ( / )"
                        aria-label="E-Mails durchsuchen"
                        className="h-9 bg-elevated pl-9 shadow-none"
                    />
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={refresh}
                    aria-label="Postfach aktualisieren"
                    title="Aktualisieren"
                >
                    <RefreshCw className={cn('size-4', inboxQuery.isFetching && 'animate-spin')} />
                </Button>
                <Button type="button" size="sm" onClick={() => openCompose()}>
                    <Pencil className="size-4" />
                    <span className="hidden sm:inline">Neue E-Mail</span>
                </Button>
            </header>

            <div className="flex shrink-0 items-center gap-1 border-b border-border-subtle bg-surface px-3 py-2 lg:hidden">
                <Button
                    variant={folder === 'inbox' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => selectFolder('inbox')}
                >
                    <Inbox className="size-4" /> Posteingang
                    {allUnread > 0 && <span className="rounded bg-accent-500 px-1.5 text-[10px] text-white">{allUnread}</span>}
                </Button>
                <Button
                    variant={folder === 'sent' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => selectFolder('sent')}
                >
                    <Send className="size-4" /> Gesendet
                </Button>
                {folder === 'inbox' && (
                    <Button
                        variant={unreadOnly ? 'secondary' : 'ghost'}
                        size="sm"
                        aria-pressed={unreadOnly}
                        onClick={() => { setUnreadOnly((current) => !current); setSelectedId(null); }}
                    >
                        <Mail className="size-4" /> Ungelesen
                    </Button>
                )}
                <Select value={mailbox} onValueChange={selectMailbox}>
                    <SelectTrigger size="sm" className="ml-auto w-[190px]">
                        <SelectValue placeholder="Postfach" />
                    </SelectTrigger>
                    <SelectContent>
                        {mailboxQuery.mailboxes.map((item) => (
                            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Drei Spalten als KARTEN mit Abstand, wie im Entwurf
                (196px | 372px | Rest). Vorher lagen sie kantenbündig
                nebeneinander, nur durch Linien getrennt.

                Die Seite selbst bleibt eigenständig — ganzer Bildschirm, nicht
                im Dashboard-Rahmen. Übernommen wird das Aussehen, nicht die
                Einbettung. */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 p-3.5 lg:grid-cols-[196px_minmax(0,372px)_minmax(0,1fr)]">
                <MailboxRail
                    folder={folder}
                    mailbox={mailbox}
                    mailboxes={mailboxQuery.mailboxes}
                    unreadOnly={unreadOnly}
                    onFolderChange={selectFolder}
                    onMailboxChange={selectMailbox}
                    onUnreadOnlyChange={(next) => { setUnreadOnly(next); setSelectedId(null); }}
                />

                <section
                    aria-label={FOLDER_LABELS[folder]}
                    className={cn(
                        'karte min-h-0 flex-col overflow-hidden !rounded-2xl',
                        selected ? 'hidden lg:flex' : 'flex',
                    )}
                >
                    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle px-4">
                        <div>
                            <h2 className="text-sm font-semibold">{FOLDER_LABELS[folder]}</h2>
                            <p className="text-[11px] text-text-muted">
                                {inboxQuery.items.length} {inboxQuery.items.length === 1 ? 'Nachricht' : 'Nachrichten'}
                            </p>
                        </div>
                        {debouncedSearch && <span className="max-w-32 truncate text-[11px] text-text-muted">„{debouncedSearch}“</span>}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {inboxQuery.isLoading ? (
                            <LoadingState label="Lade E-Mails…" className="border-0" />
                        ) : inboxQuery.error ? (
                            <ErrorState
                                title="Mailbox nicht erreichbar"
                                message="Die E-Mails konnten nicht geladen werden."
                                detail={inboxQuery.error instanceof Error ? inboxQuery.error.message : undefined}
                                onRetry={inboxQuery.refetch}
                                className="m-4"
                            />
                        ) : inboxQuery.items.length === 0 ? (
                            <EmptyState
                                icon={FOLDER_ICONS[folder]}
                                title={debouncedSearch ? 'Keine Treffer' : 'Keine E-Mails'}
                                description={debouncedSearch
                                    ? 'Versuche einen anderen Suchbegriff.'
                                    : FOLDER_EMPTY_HINTS[folder]}
                                className="m-4 border-0 bg-transparent"
                            />
                        ) : (
                            <ul role="listbox" aria-label="E-Mail-Liste">
                                {inboxQuery.items.map((message) => (
                                    <MessageListItem
                                        key={message.id}
                                        message={message}
                                        selected={selectedId === message.id}
                                        onSelect={() => selectMessage(message)}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>
                    {inboxQuery.hasNextPage && (
                        <div className="shrink-0 border-t border-border-subtle p-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full"
                                disabled={inboxQuery.isFetchingNextPage}
                                onClick={inboxQuery.fetchNextPage}
                            >
                                {inboxQuery.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                                Weitere laden
                            </Button>
                        </div>
                    )}
                </section>

                <MessageDetail
                    message={selectedVoll ?? selected}
                    koerperLaedt={selected !== null && selectedVoll === null && vollAbfrage.isFetching}
                    folder={folder}
                    onBack={() => setSelectedId(null)}
                    onReply={replyTo}
                    onForward={forwardMessage}
                    onToggleRead={toggleRead}
                    onMove={moveTo}
                    onRestore={restore}
                    onSpam={reportSpam}
                    onNotSpam={reportNotSpam}
                    togglingRead={markRead.isPending}
                    moving={moveMessage.isPending || restoreMessage.isPending || markSpam.isPending || markNotSpam.isPending}
                />
            </div>

            <ComposeDialog
                key={`${composeSeed.draftId || composeSeed.replyToMessageId || 'new'}:${composeSeed.to || ''}:${composeOpen ? 'open' : 'closed'}`}
                open={composeOpen}
                onOpenChange={setComposeOpen}
                seed={composeSeed}
                sendingAddresses={mailboxQuery.sendingAddresses}
            />
        </div>
    );
}

function MailboxRail({
    folder,
    mailbox,
    mailboxes,
    unreadOnly,
    onFolderChange,
    onMailboxChange,
    onUnreadOnlyChange,
}: {
    folder: InboxFolder;
    mailbox: string;
    mailboxes: ReturnType<typeof useMailboxes>['mailboxes'];
    unreadOnly: boolean;
    onFolderChange: (folder: InboxFolder) => void;
    onMailboxChange: (mailbox: string) => void;
    onUnreadOnlyChange: (unreadOnly: boolean) => void;
}): JSX.Element {
    const allUnread = mailboxes.find((item) => item.id === 'all')?.unread ?? 0;
    return (
        <aside className="karte hidden min-h-0 flex-col !rounded-2xl lg:flex">
            <nav className="space-y-1 p-3" aria-label="Mail-Ordner">
                <RailButton
                    active={folder === 'inbox'}
                    icon={Inbox}
                    label="Posteingang"
                    count={allUnread}
                    onClick={() => onFolderChange('inbox')}
                />
                <RailButton
                    active={folder === 'sent'}
                    icon={Send}
                    label="Gesendet"
                    onClick={() => onFolderChange('sent')}
                />
                <RailButton
                    active={folder === 'drafts'}
                    icon={FilePen}
                    label="Entwürfe"
                    onClick={() => onFolderChange('drafts')}
                />
                <RailButton
                    active={folder === 'archive'}
                    icon={Archive}
                    label="Archiv"
                    onClick={() => onFolderChange('archive')}
                />
                <RailButton
                    active={folder === 'spam'}
                    icon={ShieldAlert}
                    label="Spam"
                    onClick={() => onFolderChange('spam')}
                />
                <RailButton
                    active={folder === 'trash'}
                    icon={Trash2}
                    label="Papierkorb"
                    onClick={() => onFolderChange('trash')}
                />
                {folder === 'inbox' && (
                    <button
                        type="button"
                        aria-pressed={unreadOnly}
                        onClick={() => onUnreadOnlyChange(!unreadOnly)}
                        className={cn(
                            'flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-xs transition-colors',
                            unreadOnly
                                ? 'bg-accent-500/10 font-medium text-accent-500'
                                : 'text-text-muted hover:bg-elevated hover:text-text-primary',
                        )}
                    >
                        <span className={cn(
                            'ml-0.5 size-3 rounded-sm border transition-colors',
                            unreadOnly ? 'border-accent-400 bg-accent-500' : 'border-border-strong',
                        )} />
                        <span>Nur ungelesene</span>
                    </button>
                )}
            </nav>
            <div className="mx-3 border-t border-border-subtle" />
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <p className="mb-2 px-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">Postfächer</p>
                <div className="space-y-0.5">
                    {mailboxes.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onMailboxChange(item.id)}
                            className={cn(
                                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors',
                                mailbox === item.id
                                    ? 'bg-elevated text-text-primary'
                                    : 'text-text-secondary hover:bg-elevated/70 hover:text-text-primary',
                            )}
                        >
                            <Mail className="size-3.5 shrink-0" />
                            <span className="min-w-0 flex-1 truncate">{item.name}</span>
                            {item.unread > 0 && (
                                <span className="rounded-full bg-accent-500/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-500">
                                    {item.unread}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </aside>
    );
}

function RailButton({
    active,
    icon: Icon,
    label,
    count = 0,
    onClick,
}: {
    active: boolean;
    icon: typeof Inbox;
    label: string;
    count?: number;
    onClick: () => void;
}): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                active
                    ? 'bg-accent-500/10 font-medium text-accent-500'
                    : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
            )}
        >
            <Icon className="size-4" />
            <span>{label}</span>
            {count > 0 && <span className="ml-auto text-xs font-semibold">{count}</span>}
        </button>
    );
}

function MessageListItem({
    message,
    selected,
    onSelect,
}: {
    message: InboxMessage;
    selected: boolean;
    onSelect: () => void;
}): JSX.Element {
    const label = senderLabel(message);
    return (
        <li role="option" aria-selected={selected}>
            <button
                type="button"
                onClick={onSelect}
                className={cn(
                    'group relative w-full border-b border-border-subtle px-4 py-3 text-left transition-colors',
                    selected ? 'bg-accent-500/10' : 'hover:bg-elevated/70',
                    !message.is_read && message.direction === 'inbound' && 'bg-elevated/35',
                )}
            >
                {selected && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-accent-500" />}
                <div className="flex items-start gap-3">
                    <div className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                        !message.is_read && message.direction === 'inbound'
                            ? 'bg-accent-500 text-white'
                            : 'bg-elevated text-text-secondary',
                    )}>
                        {initials(label)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                            <span className={cn(
                                'min-w-0 flex-1 truncate text-sm',
                                !message.is_read && message.direction === 'inbound' ? 'font-semibold text-text-primary' : 'text-text-secondary',
                            )}>
                                {label}
                            </span>
                            <time className="shrink-0 text-[10px] text-text-muted">{formatRelative(message.received_at)}</time>
                        </div>
                        <div className={cn(
                            'mt-0.5 truncate text-xs',
                            !message.is_read && message.direction === 'inbound' ? 'font-medium text-text-primary' : 'text-text-secondary',
                        )}>
                            {message.subject || '(ohne Betreff)'}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                            <p className="min-w-0 flex-1 truncate text-[11px] text-text-muted">{preview(message.body)}</p>
                            {message.attachments.length > 0 && <Paperclip className="size-3 shrink-0 text-text-muted" />}
                            {!message.is_read && message.direction === 'inbound' && <span className="size-1.5 shrink-0 rounded-full bg-accent-500" />}
                        </div>
                    </div>
                </div>
            </button>
        </li>
    );
}

function MessageDetail({
    message,
    koerperLaedt,
    folder,
    onBack,
    onReply,
    onForward,
    onToggleRead,
    onMove,
    onRestore,
    onSpam,
    onNotSpam,
    togglingRead,
    moving,
}: {
    message: InboxMessage | null;
    /** Voll-Nachricht ist noch unterwegs — Vorschau nicht als Mail ausgeben. */
    koerperLaedt?: boolean;
    folder: InboxFolder;
    onBack: () => void;
    onReply: (message: InboxMessage) => void;
    onForward: (message: InboxMessage) => void;
    onToggleRead: (message: InboxMessage) => void;
    onMove: (message: InboxMessage, target: 'archive' | 'trash') => void;
    onRestore: (message: InboxMessage) => void;
    onSpam: (message: InboxMessage) => void;
    onNotSpam: (message: InboxMessage) => void;
    togglingRead: boolean;
    moving: boolean;
}): JSX.Element {
    // Bereinigung, Abschottung UND Gestaltung liegen in MailHtmlFrame — hier
    // bewusst kein zweiter Satz Regeln. Zwei Konfigurationen für dieselbe
    // Aufgabe driften auseinander, und die schwächere gewinnt am Ende immer.

    if (!message) {
        return (
            <section className="karte hidden min-h-0 items-center justify-center !rounded-2xl lg:flex" aria-label="Keine E-Mail ausgewählt">
                <div className="max-w-xs text-center">
                    <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-border-subtle bg-surface text-text-muted">
                        <MailOpen className="size-5" />
                    </div>
                    <h2 className="text-sm font-semibold">E-Mail auswählen</h2>
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">Wähle links eine Nachricht, um sie hier zu lesen.</p>
                </div>
            </section>
        );
    }

    const detailName = message.direction === 'inbound'
        ? (message.from_name || message.from)
        : 'Partsunion';
    const detailAddress = message.from;
    return (
        <section className="karte flex min-h-0 flex-col overflow-hidden !rounded-2xl" aria-label="E-Mail-Detail">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border-subtle px-3 md:px-5">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="Zurück zur E-Mail-Liste">
                    <ArrowLeft className="size-4" />
                </Button>
                {message.direction === 'inbound' && (
                    <Button variant="outline" size="sm" onClick={() => onReply(message)} title="Antworten (r)">
                        <Reply className="size-4" /> Antworten
                    </Button>
                )}
                {/* Waehrend der volle Koerper laedt, wuerde die Weiterleitung
                    die 200-Zeichen-Vorschau zitieren — kurz gesperrt statt
                    falsch zitiert. Antworten braucht den Koerper nicht. */}
                <Button variant="ghost" size="sm" onClick={() => onForward(message)} disabled={koerperLaedt} title="Weiterleiten (f)">
                    <Forward className="size-4" /> Weiterleiten
                </Button>
                {message.direction === 'inbound' && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleRead(message)}
                        disabled={togglingRead}
                        title={message.is_read ? 'Als ungelesen markieren (u)' : 'Als gelesen markieren (u)'}
                    >
                        {togglingRead
                            ? <Loader2 className="size-4 animate-spin" />
                            : message.is_read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
                        <span className="hidden sm:inline">{message.is_read ? 'Ungelesen' : 'Gelesen'}</span>
                    </Button>
                )}
                {folder === 'spam' && (
                    <Button variant="ghost" size="sm" onClick={() => onNotSpam(message)} disabled={moving} title="Kein Spam — Absender wieder freigeben">
                        <ShieldCheck className="size-4" />
                        <span className="hidden sm:inline">Kein Spam</span>
                    </Button>
                )}
                {folder !== 'spam' && message.direction === 'inbound' && (
                    <Button variant="ghost" size="sm" onClick={() => onSpam(message)} disabled={moving} title="Als Spam markieren und Absender sperren">
                        <ShieldAlert className="size-4" />
                        <span className="hidden sm:inline">Spam</span>
                    </Button>
                )}
                {folder === 'trash' ? (
                    <Button variant="ghost" size="sm" onClick={() => onRestore(message)} disabled={moving} title="Wiederherstellen (z)">
                        {moving ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                        <span className="hidden sm:inline">Wiederherstellen</span>
                    </Button>
                ) : (
                    <>
                        {folder !== 'archive' && (
                            <Button variant="ghost" size="sm" onClick={() => onMove(message, 'archive')} disabled={moving} title="Archivieren (e)">
                                <Archive className="size-4" />
                                <span className="hidden sm:inline">Archivieren</span>
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => onMove(message, 'trash')} disabled={moving} title="In den Papierkorb (Entf)">
                            {moving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                            <span className="hidden sm:inline">Löschen</span>
                        </Button>
                    </>
                )}
                {/* Die Zuordnung stammt aus einer Kopfzeile, die der Absender
                    geschrieben hat — der Zustellempfänger war nicht ermittelbar. */}
                {message.mailbox_source?.includes('header') && (
                    <span
                        className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-[10px] text-warning"
                        title="Der Zustellempfänger war nicht ermittelbar. Die Zuordnung beruht auf einer Kopfzeile des Absenders."
                    >
                        <ShieldAlert className="size-3" />
                        <span className="hidden sm:inline">Zuordnung ungeprüft</span>
                    </span>
                )}
                <span className="ml-auto rounded-full border border-border-subtle px-2 py-1 text-[10px] text-text-muted">
                    {message.direction === 'inbound' ? 'Empfangen' : 'Gesendet'}
                </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                <article className={cn(SEITEN_RAND_OHNE_BREITE, 'mx-auto max-w-4xl')}>
                    <h2 className="text-xl font-semibold leading-tight text-text-primary md:text-2xl">
                        {message.subject || '(ohne Betreff)'}
                    </h2>
                    <div className="mt-6 flex items-start gap-3 border-b border-border-subtle pb-5">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-500 text-sm font-semibold text-white">
                            {initials(detailName)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                                <span className="font-medium text-text-primary">{detailName}</span>
                                <span className="text-xs text-text-muted">&lt;{detailAddress}&gt;</span>
                            </div>
                            <div className="mt-1 text-xs text-text-muted">
                                An: {message.to.join(', ') || 'Unbekannt'}
                                {message.cc.length > 0 && ` · Cc: ${message.cc.join(', ')}`}
                            </div>
                        </div>
                        <time className="shrink-0 text-xs text-text-muted" dateTime={message.received_at}>
                            {formatDateTime(message.received_at)}
                        </time>
                    </div>

                    {message.attachments.length > 0 && (
                        <div className="mt-5 flex flex-wrap gap-2">
                            {message.attachments.map((attachment) => (
                                <button
                                    key={attachment.id}
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await downloadInboxAttachment(message.id, attachment.id, attachment.filename || 'anhang');
                                        } catch (error) {
                                            toast.error(error instanceof Error ? error.message : 'Anhang konnte nicht geladen werden.');
                                        }
                                    }}
                                    className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-3 py-2 text-left transition-colors hover:border-border-strong hover:bg-elevated"
                                >
                                    <FileText className="size-4 text-accent-500" />
                                    <span className="max-w-52 truncate text-xs text-text-secondary">{attachment.filename || 'Anhang'}</span>
                                    <Download className="size-3.5 text-text-muted" />
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="mt-7 text-[14px] leading-7 text-text-primary">
                        {/* Der Rahmen traegt jetzt auch reine Textmails: er
                            wandelt sie in Absaetze um und zeigt Absender,
                            Betreff und Anhaenge im Partsunion-Layout.

                            Waehrend der volle Koerper unterwegs ist, KEIN
                            Rahmen mit der Listen-Vorschau: die ist auf 200
                            Zeichen gekuerzt und saehe wie eine kaputte Mail
                            aus. Ein ruhiger Balken sagt ehrlicher "kommt
                            gleich" — und er kommt schnell, es ist EINE Mail
                            statt wie frueher fuenfzig. */}
                        {koerperLaedt ? (
                            <div
                                role="status"
                                aria-label="Nachricht wird geladen"
                                className="h-48 animate-pulse rounded-2xl bg-overlay/[0.05]"
                            />
                        ) : (
                            <MailHtmlFrame message={message} />
                        )}
                    </div>

                    {message.direction === 'inbound' && (
                        <button
                            type="button"
                            onClick={() => onReply(message)}
                            className="mt-10 flex w-full items-center gap-2 karte-klein px-4 py-3 text-sm text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
                        >
                            <Reply className="size-4" /> Auf diese E-Mail antworten…
                        </button>
                    )}
                </article>
            </div>
        </section>
    );
}

function ComposeDialog({
    open,
    onOpenChange,
    seed,
    sendingAddresses,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    seed: ComposeSeed;
    sendingAddresses: string[];
}): JSX.Element {
    const [draft, setDraft] = useState<SendInboxEmailInput>({
        requestId: crypto.randomUUID(),
        from: seed.from || sendingAddresses[0] || 'info@partsunion.de',
        to: seed.to ? [seed.to] : [],
        subject: seed.subject || '',
        body: seed.body || '',
        replyToMessageId: seed.replyToMessageId,
    });
    const [toInput, setToInput] = useState(seed.to || '');
    const [ccInput, setCcInput] = useState('');
    const [bccInput, setBccInput] = useState('');
    const [bodyHtml, setBodyHtml] = useState(seed.body ? plainTextToEmailHtml(seed.body) : '');
    const [bodyText, setBodyText] = useState(seed.body || '');
    const [addressErrors, setAddressErrors] = useState<{ to?: string; cc?: string; bcc?: string }>({});
    const [showCopies, setShowCopies] = useState(false);
    const [editingSignature, setEditingSignature] = useState(false);
    const [signatureDraft, setSignatureDraft] = useState<string | null>(null);
    const [savingSignature, setSavingSignature] = useState(false);
    // Anhänge liegen serverseitig am Entwurf, nicht im Browser-Zustand. Deshalb
    // entsteht beim ersten Anhängen ein Entwurf — sonst gäbe es nichts, woran
    // die Bytes hängen könnten, und ein versehentlich geschlossenes Fenster
    // würde die Datei verlieren.
    const [draftId, setDraftId] = useState<string | null>(seed.draftId ?? null);
    const [attachments, setAttachments] = useState<DraftAttachment[]>(seed.attachments ?? []);
    const [attachmentBusy, setAttachmentBusy] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [aiPanelOpen, setAiPanelOpen] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiTone, setAiTone] = useState<EmailDraftTone>('professional');
    const [aiSuggestion, setAiSuggestion] = useState<EmailDraftSuggestion | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    // Nur bei einer bewussten Uebernahme aendern. Wuerde hier bodyHtml stehen,
    // setzte der Editor bei jedem Tastendruck sein innerHTML neu und verlöre
    // die Cursorposition.
    const [editorHtmlOverride, setEditorHtmlOverride] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const sendMutation = useSendInboxEmail();

    // Adressvervollständigung: nur das zuletzt getippte Element wird
    // nachgeschlagen, damit bereits vollständige Empfänger nicht ständig neue
    // Abfragen auslösen.
    const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
    const activeToken = (toInput.split(/[;,]/).pop() || '').trim();
    const debouncedToken = useDebounce(activeToken, 200);

    useEffect(() => {
        if (debouncedToken.length < 2) return;
        let cancelled = false;
        suggestContacts(debouncedToken)
            .then((result) => { if (!cancelled) setSuggestions(result); })
            .catch(() => { if (!cancelled) setSuggestions([]); });
        return () => { cancelled = true; };
    }, [debouncedToken]);

    // Abgeleitet statt im Effekt zurückgesetzt: sobald das getippte Element zu
    // kurz wird, verschwindet die Liste, ohne dass dafür Zustand geschrieben
    // werden muss.
    const visibleSuggestions = activeToken.length >= 2 ? suggestions : [];

    /** Ersetzt das zuletzt getippte Element durch die gewählte Adresse. */
    function applySuggestion(address: string): void {
        const parts = toInput.split(/[;,]/);
        parts[parts.length - 1] = ` ${address}`;
        setToInput(`${parts.join(';').trim()}; `);
        setSuggestions([]);
    }
    const profileQuery = useQuery({
        queryKey: ['admin', 'profile'],
        queryFn: getAdminProfile,
        enabled: open,
        staleTime: 60_000,
    });

    const fallbackSignature = [
        profileQuery.data?.full_name || profileQuery.data?.username || 'Partsunion Team',
        'Partsunion',
        profileQuery.data?.email || draft.from,
    ].filter(Boolean).join('\n');
    const storedSignature = profileQuery.data?.signature?.trim() || '';
    const signaturePreview = signatureDraft ?? (storedSignature || fallbackSignature);

    function setAddressInput(field: 'to' | 'cc' | 'bcc', value: string): void {
        if (field === 'to') setToInput(value);
        if (field === 'cc') setCcInput(value);
        if (field === 'bcc') setBccInput(value);
        setAddressErrors((current) => ({ ...current, [field]: undefined }));
    }

    function validateAddressField(value: string): string | undefined {
        const invalid = invalidEmailAddresses(value);
        if (invalid.length === 0) return undefined;
        return `Ungültige E-Mail-Adresse: ${invalid.join(', ')}`;
    }

    async function saveSignature(): Promise<void> {
        if (signatureDraft === null) return;
        setSavingSignature(true);
        try {
            await updateSignature(signatureDraft.trim());
            await profileQuery.refetch();
            setEditingSignature(false);
            setSignatureDraft(null);
            toast.success('E-Mail-Signatur gespeichert.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Signatur konnte nicht gespeichert werden.');
        } finally {
            setSavingSignature(false);
        }
    }

    function currentDraftInput(): DraftInput {
        return {
            from: draft.from,
            to: parseEmailAddresses(toInput),
            cc: parseEmailAddresses(ccInput),
            bcc: parseEmailAddresses(bccInput),
            subject: draft.subject,
            body: bodyText,
            htmlContent: bodyHtml,
            replyToMessageId: draft.replyToMessageId ?? null,
        };
    }

    /** Legt den Entwurf an, falls noch keiner existiert, und hält ihn aktuell. */
    async function ensureDraft(): Promise<string> {
        if (draftId) {
            await updateDraft(draftId, currentDraftInput());
            return draftId;
        }
        const created = await createDraft(currentDraftInput());
        setDraftId(created.id);
        return created.id;
    }

    async function attachFiles(files: FileList | null): Promise<void> {
        if (!files || files.length === 0) return;
        setAttachmentBusy(true);
        try {
            const id = await ensureDraft();
            for (const file of Array.from(files)) {
                const stored = await uploadDraftAttachment(id, file);
                setAttachments((current) => [...current, stored]);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Anhang konnte nicht hinzugefügt werden.');
        } finally {
            setAttachmentBusy(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function removeAttachment(attachmentId: string): Promise<void> {
        if (!draftId) return;
        setAttachmentBusy(true);
        try {
            await deleteDraftAttachment(draftId, attachmentId);
            setAttachments((current) => current.filter((entry) => entry.id !== attachmentId));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Anhang konnte nicht entfernt werden.');
        } finally {
            setAttachmentBusy(false);
        }
    }

    async function saveAsDraft(): Promise<void> {
        setSavingDraft(true);
        try {
            await ensureDraft();
            toast.success('Als Entwurf gespeichert.');
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Entwurf konnte nicht gespeichert werden.');
        } finally {
            setSavingDraft(false);
        }
    }

    async function createAiSuggestion(): Promise<void> {
        if (aiTopic.trim().length < 4) {
            toast.error('Bitte beschreiben Sie kurz Thema und Ziel der E-Mail.');
            return;
        }
        setAiLoading(true);
        try {
            const suggestion = await createEmailDraftSuggestion({ topic: aiTopic.trim(), tone: aiTone });
            setAiSuggestion(suggestion);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'KI-Entwurf konnte nicht erstellt werden.');
        } finally {
            setAiLoading(false);
        }
    }

    function applyAiSuggestion(): void {
        if (!aiSuggestion) return;
        const html = plainTextToEmailHtml(aiSuggestion.body);
        setDraft((current) => ({ ...current, subject: aiSuggestion.subject, body: aiSuggestion.body }));
        setBodyText(aiSuggestion.body);
        setBodyHtml(html);
        setEditorHtmlOverride(html);
        setAiPanelOpen(false);
        toast.success('KI-Entwurf übernommen. Sie können ihn jetzt bearbeiten.');
    }

    function submit(): void {
        const to = parseEmailAddresses(toInput);
        const nextAddressErrors = {
            to: validateAddressField(toInput),
            cc: validateAddressField(ccInput),
            bcc: validateAddressField(bccInput),
        };
        setAddressErrors(nextAddressErrors);
        const firstAddressError = nextAddressErrors.to || nextAddressErrors.cc || nextAddressErrors.bcc;
        if (firstAddressError) {
            toast.error(firstAddressError);
            return;
        }
        if (!draft.from || to.length === 0 || !draft.subject.trim() || !bodyText.trim()) {
            toast.error('Absender, Empfänger, Betreff und Nachricht sind erforderlich.');
            return;
        }
        sendMutation.mutate(
            {
                ...draft,
                to,
                cc: parseEmailAddresses(ccInput),
                bcc: parseEmailAddresses(bccInput),
                subject: draft.subject.trim(),
                body: bodyText.trim(),
                htmlContent: sanitizeEmailEditorHtml(bodyHtml),
                // Der Server holt sich die Anhänge aus dem Entwurf und löscht
                // ihn nach erfolgreichem Versand — die Bytes wandern nicht ein
                // zweites Mal über die Leitung.
                draftId: draftId ?? undefined,
            },
            {
                onSuccess: () => {
                    toast.success('E-Mail über Resend gesendet.');
                    onOpenChange(false);
                },
                onError: (error) => toast.error(sendErrorMessage(error)),
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[94dvh] gap-0 overflow-hidden border-border-strong bg-surface p-0 sm:max-w-4xl">
                <DialogHeader className="border-b border-border-subtle px-5 py-4">
                    <div className="flex items-start justify-between gap-4 pr-7">
                        <div>
                            <DialogTitle>{seed.replyToMessageId ? 'Antwort verfassen' : 'Neue E-Mail'}</DialogTitle>
                            <DialogDescription className="mt-1">Professioneller Versand über das Partsunion-Postfach mit Resend.</DialogDescription>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant={aiPanelOpen ? 'secondary' : 'outline'}
                            onClick={() => setAiPanelOpen((current) => !current)}
                            className="shrink-0"
                        >
                            <Bot className="size-4 text-accent-500" />
                            KI-Entwurf
                        </Button>
                    </div>
                </DialogHeader>

                <div className="max-h-[calc(94dvh-145px)] overflow-y-auto px-5 py-4">
                    <div className="grid gap-3">
                        {aiPanelOpen && (
                            <section className="rounded-xl border border-accent-500/30 bg-accent-500/[0.06] p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-white shadow-sm">
                                        <Bot className="size-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-text-primary">Partsunion E-Mail-Assistent</p>
                                        <p className="mt-0.5 text-xs text-text-muted">
                                            Thema und Ziel nennen – Betreff und Text werden als bearbeitbarer Vorschlag erstellt.
                                        </p>
                                    </div>
                                </div>
                                <Textarea
                                    value={aiTopic}
                                    onChange={(event) => setAiTopic(event.target.value)}
                                    rows={3}
                                    maxLength={2000}
                                    className="mt-3 bg-surface text-sm"
                                    placeholder="z. B. Herrn Müller nach dem Telefonat die Broschüre senden und einen unverbindlichen Praxischeck anbieten"
                                />
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                    <Select value={aiTone} onValueChange={(value) => setAiTone(value as EmailDraftTone)}>
                                        <SelectTrigger className="h-9 w-[190px] bg-surface"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="professional">Professionell</SelectItem>
                                            <SelectItem value="friendly">Freundlich</SelectItem>
                                            <SelectItem value="formal">Formell</SelectItem>
                                            <SelectItem value="brief">Kurz &amp; direkt</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button type="button" size="sm" onClick={() => void createAiSuggestion()} disabled={aiLoading}>
                                        {aiLoading ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
                                        Entwurf erstellen
                                    </Button>
                                </div>
                                {aiSuggestion && (
                                    <div className="mt-4 overflow-hidden rounded-lg border border-border-strong bg-surface">
                                        <div className="border-b border-border-subtle px-3 py-2">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Betreff</span>
                                            <p className="mt-1 text-sm font-medium text-text-primary">{aiSuggestion.subject}</p>
                                        </div>
                                        <div className="max-h-44 overflow-y-auto whitespace-pre-wrap px-3 py-3 text-sm leading-6 text-text-secondary">
                                            {aiSuggestion.body}
                                        </div>
                                        <div className="flex justify-end border-t border-border-subtle px-3 py-2">
                                            <Button type="button" size="sm" onClick={applyAiSuggestion}>In E-Mail übernehmen</Button>
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}
                        <label className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 text-sm">
                            <span className="text-text-muted">Von</span>
                            <Select value={draft.from} onValueChange={(from) => setDraft((current) => ({ ...current, from }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {(sendingAddresses.length > 0 ? sendingAddresses : ['info@partsunion.de']).map((address) => (
                                        <SelectItem key={address} value={address}>{address}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>
                        <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-3 text-sm">
                            <span className="pt-2 text-text-muted">An</span>
                            <div>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={toInput}
                                        onChange={(event) => setAddressInput('to', event.target.value)}
                                        placeholder="name@firma.de; zweite@firma.de"
                                        className={cn('h-9', addressErrors.to && 'border-danger focus-visible:ring-danger')}
                                        aria-invalid={Boolean(addressErrors.to)}
                                        aria-describedby={addressErrors.to ? 'compose-to-error' : undefined}
                                        inputMode="email"
                                        autoFocus
                                    />
                                    {!showCopies && (
                                        <button type="button" onClick={() => setShowCopies(true)} className="shrink-0 text-xs text-text-muted hover:text-text-primary">
                                            Cc/Bcc
                                        </button>
                                    )}
                                </div>
                                {visibleSuggestions.length > 0 && (
                                    <ul
                                        className="mt-1 overflow-hidden rounded-md border border-border-strong bg-elevated shadow-lg"
                                        aria-label="Adressvorschläge"
                                    >
                                        {visibleSuggestions.map((contact) => (
                                            <li key={contact.address}>
                                                <button
                                                    type="button"
                                                    onClick={() => applySuggestion(contact.address)}
                                                    className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-accent-500/10"
                                                >
                                                    <span className="truncate font-medium text-text-primary">
                                                        {contact.displayName || contact.address}
                                                    </span>
                                                    {contact.displayName && (
                                                        <span className="truncate text-text-muted">{contact.address}</span>
                                                    )}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {addressErrors.to && <p id="compose-to-error" className="mt-1 text-xs text-danger">{addressErrors.to}</p>}
                            </div>
                        </div>
                        {showCopies && (
                            <>
                                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-3 text-sm">
                                    <span className="pt-2 text-text-muted">Cc</span>
                                    <div>
                                        <Input
                                            value={ccInput}
                                            onChange={(event) => setAddressInput('cc', event.target.value)}
                                            className={cn('h-9', addressErrors.cc && 'border-danger')}
                                            aria-invalid={Boolean(addressErrors.cc)}
                                            inputMode="email"
                                        />
                                        {addressErrors.cc && <p className="mt-1 text-xs text-danger">{addressErrors.cc}</p>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-3 text-sm">
                                    <span className="pt-2 text-text-muted">Bcc</span>
                                    <div>
                                        <Input
                                            value={bccInput}
                                            onChange={(event) => setAddressInput('bcc', event.target.value)}
                                            className={cn('h-9', addressErrors.bcc && 'border-danger')}
                                            aria-invalid={Boolean(addressErrors.bcc)}
                                            inputMode="email"
                                        />
                                        {addressErrors.bcc && <p className="mt-1 text-xs text-danger">{addressErrors.bcc}</p>}
                                    </div>
                                </div>
                            </>
                        )}
                        <label className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 text-sm">
                            <span className="text-text-muted">Betreff</span>
                            <Input
                                value={draft.subject}
                                onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
                                className="h-9"
                            />
                        </label>
                        <div className="border-t border-border-subtle pt-4">
                            <RichEmailEditor
                                initialHtml={editorHtmlOverride ?? (seed.body ? plainTextToEmailHtml(seed.body) : '')}
                                invalid={sendMutation.isError && !bodyText.trim()}
                                onChange={({ html, text }) => {
                                    setBodyHtml(html);
                                    setBodyText(text);
                                }}
                            />
                        </div>

                        <div className="rounded-lg border border-border-subtle bg-canvas/70 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-text-primary">Anhänge</p>
                                    <p className="mt-0.5 text-[11px] text-text-muted">
                                        Höchstens 10 Dateien, je 10 MB, zusammen 20 MB.
                                    </p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(event) => void attachFiles(event.target.files)}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={attachmentBusy || attachments.length >= 10}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {attachmentBusy
                                        ? <Loader2 className="size-4 animate-spin" />
                                        : <Paperclip className="size-4" />}
                                    Datei anhängen
                                </Button>
                            </div>
                            {attachments.length > 0 && (
                                <ul className="mt-3 space-y-1.5">
                                    {attachments.map((attachment) => (
                                        <li
                                            key={attachment.id}
                                            className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-2.5 py-1.5"
                                        >
                                            <FileText className="size-3.5 shrink-0 text-accent-500" />
                                            <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">
                                                {attachment.filename}
                                            </span>
                                            <span className="shrink-0 text-[10px] text-text-muted">
                                                {Math.max(1, Math.round(attachment.byte_size / 1024))} KB
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => void removeAttachment(attachment.id)}
                                                disabled={attachmentBusy}
                                                aria-label={`${attachment.filename} entfernen`}
                                                className="shrink-0 text-text-muted transition-colors hover:text-danger disabled:opacity-50"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="rounded-lg border border-border-subtle bg-canvas/70 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-medium text-text-primary">Automatische E-Mail-Signatur</p>
                                    <p className="mt-0.5 text-[11px] text-text-muted">Wird beim Senden sicher unter die Nachricht gesetzt.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSignatureDraft(signaturePreview);
                                            setEditingSignature((current) => !current);
                                        }}
                                        className="text-xs text-accent-500 hover:text-accent-200"
                                    >
                                        {editingSignature ? 'Schließen' : 'Bearbeiten'}
                                    </button>
                                    <Link to="/profile" onClick={() => onOpenChange(false)} className="text-xs text-text-muted hover:text-text-primary">
                                        Profil
                                    </Link>
                                </div>
                            </div>
                            {editingSignature ? (
                                <div className="mt-3">
                                    <Textarea
                                        value={signatureDraft ?? signaturePreview}
                                        onChange={(event) => setSignatureDraft(event.target.value)}
                                        rows={5}
                                        maxLength={2000}
                                        className="font-mono text-xs leading-relaxed"
                                    />
                                    <div className="mt-2 flex justify-end">
                                        <Button type="button" size="sm" onClick={() => void saveSignature()} disabled={savingSignature}>
                                            {savingSignature && <Loader2 className="size-3.5 animate-spin" />}
                                            Signatur speichern
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-3 whitespace-pre-line border-l-2 border-accent-500/50 pl-3 text-xs leading-5 text-text-secondary">
                                    {profileQuery.isLoading ? 'Signatur wird geladen…' : signaturePreview}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-border-subtle px-5 py-3">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sendMutation.isPending}>Abbrechen</Button>
                    <Button
                        variant="outline"
                        onClick={() => void saveAsDraft()}
                        disabled={savingDraft || sendMutation.isPending || attachmentBusy}
                    >
                        {savingDraft ? <Loader2 className="size-4 animate-spin" /> : <FilePen className="size-4" />}
                        Als Entwurf
                    </Button>
                    <Button onClick={submit} disabled={sendMutation.isPending || attachmentBusy}>
                        {sendMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        Senden
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
