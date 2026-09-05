import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, LockKeyhole, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { getInboxThread, updateInboxAssignment } from '@/api/inbox';
import type { InboxMessage } from '@/api/types';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/utils/format/date';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

const STATUS = { open: 'Offen', in_progress: 'In Bearbeitung', done: 'Erledigt' };

export function MailWorkflow({ message }: { message: InboxMessage }): JSX.Element {
    const { user } = useAuth();
    const client = useQueryClient();
    const mutation = useMutation({
        mutationFn: (patch: Parameters<typeof updateInboxAssignment>[1]) => updateInboxAssignment(message.id, patch),
        onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin', 'inbox'] }); },
        onError: (error: Error) => toast.error(error.message || 'Bearbeitungsstatus konnte nicht gespeichert werden.'),
    });
    const status = message.assignment_status || 'open';
    const isMine = message.assigned_to === user?.id;
    return (
        <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-surface px-4 py-2 text-xs">
            <span className="mr-auto flex items-center gap-2 text-text-secondary">
                <UserRound className="size-4" />
                {isMine ? 'Von dir übernommen' : message.assigned_to ? 'Im Team zugewiesen' : 'Nicht zugewiesen'}
            </span>
            {!isMine && user && (
                <Button size="sm" variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate({ assignedTo: user.id, status: 'in_progress' })}>
                    Übernehmen
                </Button>
            )}
            {isMine && (
                <Button size="sm" variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate({ assignedTo: '', status: 'open' })}>
                    Freigeben
                </Button>
            )}
            <label className="flex items-center gap-2 text-text-secondary">
                <Check className="size-4" />
                <select className="h-9 rounded-md border border-border-subtle bg-surface px-2 text-sm" aria-label="Bearbeitungsstatus" value={status} disabled={mutation.isPending}
                    onChange={(event) => mutation.mutate({ status: event.target.value as keyof typeof STATUS })}>
                    {Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
            </label>
        </div>
    );
}

/** The note is stored separately from email content and never passed to the composer. */
export function MailInternalNote({ message }: { message: InboxMessage }): JSX.Element {
    return <InternalNoteEditor key={message.id} message={message} />;
}

function InternalNoteEditor({ message }: { message: InboxMessage }): JSX.Element {
    const client = useQueryClient();
    const [draft, setDraft] = useState<{ text: string; base: string } | null>(null);
    const [reloadError, setReloadError] = useState(false);
    const current = message.assignment_notes || '';
    const mutation = useMutation({
        mutationFn: (value: { text: string; base: string }) => updateInboxAssignment(message.id, { notes: value.text, expectedNotes: value.base }),
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ['admin', 'inbox'] });
            setDraft(null);
            toast.success('Interne Notiz gespeichert.');
        },
    });
    const changedElsewhere = draft !== null && draft.base !== current;
    useUnsavedChanges('Interne Mail-Notiz', draft !== null && draft.text !== draft.base, mutation.isPending);
    return (
        <details className="group/note mt-4 rounded-md border border-border-subtle bg-elevated/35">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-medium text-text-secondary">
                <LockKeyhole className="size-3.5" /> Interne Notiz
                {current && <span className="ml-auto text-xs font-normal text-text-muted">Vorhanden</span>}
                <ChevronDown className={`${current ? '' : 'ml-auto'} size-3.5 transition-transform group-open/note:rotate-180`} aria-hidden="true" />
            </summary>
            <div className="border-t border-border-subtle px-3 py-3">
                <p className="mb-3 text-xs leading-relaxed text-text-muted">Nur für berechtigte Postfachnutzer sichtbar. Wird nicht mit der E-Mail versendet.</p>
                {draft ? (
                    <form onSubmit={event => { event.preventDefault(); if (!changedElsewhere && !mutation.isPending) mutation.mutate(draft); }}>
                        <label htmlFor={`mail-note-${message.id}`} className="sr-only">Interne Notiz bearbeiten</label>
                        <Textarea id={`mail-note-${message.id}`} rows={3} maxLength={2000} value={draft.text} disabled={mutation.isPending}
                            onChange={event => setDraft({ ...draft, text: event.target.value })} placeholder="Absprachen, Rückfragen oder Hinweise für das Team…" />
                        {changedElsewhere && <p role="alert" className="mt-2 text-sm text-warning">Die Notiz wurde inzwischen geändert. Deine Eingabe bleibt erhalten; lade den aktuellen Stand vor einer erneuten Bearbeitung.</p>}
                        {mutation.error && <p role="alert" className="mt-2 text-sm text-danger">{mutation.error.message || 'Notiz konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten.'}</p>}
                        {reloadError && <p role="alert" className="mt-2 text-sm text-danger">Aktueller Stand konnte nicht geladen werden.</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button size="sm" type="submit" disabled={mutation.isPending || changedElsewhere || draft.text === draft.base}>{mutation.isPending ? 'Speichert…' : 'Notiz speichern'}</Button>
                            <Button size="sm" type="button" variant="ghost" disabled={mutation.isPending} onClick={() => { setDraft(null); mutation.reset(); setReloadError(false); }}>Abbrechen</Button>
                            {(changedElsewhere || mutation.error) && <Button size="sm" type="button" variant="outline" disabled={mutation.isPending} onClick={async () => {
                                try {
                                    await client.refetchQueries({ queryKey: ['admin', 'inbox'] }, { throwOnError: true });
                                    setDraft(null); mutation.reset(); setReloadError(false);
                                } catch { setReloadError(true); }
                            }}>Eingabe verwerfen und neu laden</Button>}
                            <span className="ml-auto text-xs text-text-muted">{draft.text.length}/2000</span>
                        </div>
                    </form>
                ) : <>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-secondary">{current || 'Noch keine interne Notiz.'}</p>
                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => { setDraft({ text: current, base: current }); mutation.reset(); }}>Notiz bearbeiten</Button>
                </>}
            </div>
        </details>
    );
}

export function MailConversation({ messageId, onSelect }: { messageId: string; onSelect: (id: string) => void }): JSX.Element | null {
    const query = useQuery({
        queryKey: ['admin', 'inbox', 'thread', messageId],
        queryFn: () => getInboxThread(messageId), staleTime: 60_000,
    });
    if (query.isError) return <p className="mb-4 text-xs text-text-muted">Unterhaltung momentan nicht verfügbar. <button type="button" className="underline" onClick={() => void query.refetch()}>Erneut laden</button></p>;
    if (!query.data || query.data.messages.length < 2) return null;
    return (
        <details className="mb-5 rounded-lg border border-border-subtle bg-surface">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                Unterhaltung · {query.data.messages.length}{query.data.hasMore ? '+' : ''} Nachrichten
            </summary>
            <ol className="max-h-64 overflow-auto border-t border-border-subtle">
                {query.data.messages.map((message) => (
                    <li key={message.id}>
                        <button type="button" onClick={() => onSelect(message.id)} aria-current={message.id === messageId ? 'true' : undefined}
                            className="flex w-full flex-col gap-1 border-b border-border-subtle px-4 py-3 text-left text-sm hover:bg-elevated aria-[current=true]:bg-elevated">
                            <span className="flex justify-between gap-3"><span className="truncate font-medium">{message.from_name || message.from}</span><time className="shrink-0 text-xs text-text-muted">{formatDateTime(message.received_at)}</time></span>
                            <span className="truncate text-xs text-text-secondary">{message.subject}</span>
                        </button>
                    </li>
                ))}
            </ol>
        </details>
    );
}
