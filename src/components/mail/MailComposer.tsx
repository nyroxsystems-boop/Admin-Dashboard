import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, FilePen, FileText, Loader2, Paperclip, Quote, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAdminProfile } from '@/api/auth';
import { createDraft, createEmailDraftSuggestion, deleteDraftAttachment, fetchInboxAttachment, getInboxMessage, updateDraft, uploadDraftAttachment, type DraftAttachment, type DraftInput } from '@/api/inbox';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { invalidEmailAddresses, parseEmailAddresses } from '@/utils/emailAddresses';
import { plainTextToEmailHtml, sanitizeEmailEditorHtml } from '@/utils/emailHtml';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { MailHtmlFrame } from './MailHtmlFrame';
import { RecipientField } from './RecipientField';
import { RichEmailEditor, type RichEmailEditorHandle } from './RichEmailEditor';
import { attachmentProblem, COMPOSE_TITLES, mentionsAttachment, originalQuote, type ComposeSeed } from './mailCompose';
import { useMailSend } from './useMailSend';

const SNIPPETS = [
    { name: 'Eingang bestätigen', text: 'Vielen Dank für Ihre Nachricht. Wir prüfen Ihr Anliegen und melden uns, sobald wir die offenen Punkte geklärt haben.\n\n' },
    { name: 'Weitere Angaben anfragen', text: 'Vielen Dank für Ihre Anfrage. Damit wir Ihnen gezielt weiterhelfen können, benötigen wir noch folgende Angaben:\n\n' },
    { name: 'Termin abstimmen', text: 'Gerne besprechen wir die nächsten Schritte gemeinsam. Welche Termine passen Ihnen für ein kurzes Gespräch?\n\n' },
];

export function MailComposer({ seed, sendingAddresses, onClose }: {
    seed: ComposeSeed; sendingAddresses: string[]; onClose: () => void;
}): JSX.Element {
    const client = useQueryClient();
    const editor = useRef<RichEmailEditorHandle>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const actionLock = useRef(false);
    const draftId = useRef(seed.draftId || null);
    const [initialHtml] = useState(() => sanitizeEmailEditorHtml(seed.html ?? (seed.body ? plainTextToEmailHtml(seed.body) : '')));
    const [from, setFrom] = useState(seed.from || sendingAddresses[0] || '');
    const [to, setTo] = useState(seed.to || '');
    const [cc, setCc] = useState(seed.cc || '');
    const [bcc, setBcc] = useState(seed.bcc || '');
    const [subject, setSubject] = useState(seed.subject || '');
    const [copies, setCopies] = useState(Boolean(seed.cc || seed.bcc));
    const [body, setBody] = useState({ html: initialHtml, text: seed.body || '' });
    const [typed, setTyped] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [attachments, setAttachments] = useState<DraftAttachment[]>(seed.attachments || []);
    const [operation, setOperation] = useState<'saving' | 'uploading' | null>(null);
    const [operationError, setOperationError] = useState('');
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const [contextOpen, setContextOpen] = useState(false);
    const [importedAttachments, setImportedAttachments] = useState<Record<string, string>>({});
    const [attachmentCheck, setAttachmentCheck] = useState<boolean | null>(null);
    const [aiOpen, setAiOpen] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiBusy, setAiBusy] = useState(false);
    const [aiResult, setAiResult] = useState<{ subject: string; body: string } | null>(null);
    const profile = useQuery({ queryKey: ['admin', 'profile'], queryFn: getAdminProfile, staleTime: 60_000 });
    const originalQuery = useQuery({ queryKey: ['admin', 'inbox', 'email', seed.replyToMessageId], queryFn: () => getInboxMessage(seed.replyToMessageId!), enabled: Boolean(seed.replyToMessageId && !seed.original), staleTime: 5 * 60_000 });
    const original = seed.original || originalQuery.data;
    const changed = () => { void client.invalidateQueries({ queryKey: ['admin', 'inbox'] }); };
    const sending = useMailSend(changed);
    const busy = operation !== null || sending.busy;
    const disabled = busy || sending.locked;
    const canSend = sendingAddresses.includes(from);
    const mode = seed.mode || (seed.replyToMessageId ? 'reply' : 'new');
    const signature = profile.data?.signature?.trim() || [profile.data?.full_name || profile.data?.username || 'Partsunion Team', 'Partsunion', profile.data?.email || from].filter(Boolean).join('\n');
    const fingerprint = JSON.stringify([from, to, cc, bcc, subject, body.html, body.text]);
    const [savedFingerprint, setSavedFingerprint] = useState(fingerprint);
    const dirty = typed || fingerprint !== savedFingerprint;
    const delivered = ['finishing', 'finishFailed', 'done'].includes(sending.phase);
    useUnsavedChanges('E-Mail-Entwurf', !delivered && dirty, busy);

    function currentInput(): DraftInput {
        const current = editor.current?.read() || body;
        return { from, to: parseEmailAddresses(to), cc: parseEmailAddresses(cc), bcc: parseEmailAddresses(bcc), subject,
            body: current.text, htmlContent: sanitizeEmailEditorHtml(current.html), replyToMessageId: seed.replyToMessageId || null };
    }

    function close(): void {
        if (actionLock.current || sending.busy) return;
        if (sending.phase === 'unconfirmed' && !window.confirm('Der Versand ist noch nicht bestätigt. Nicht als neue E-Mail erneut senden. Diesen Prüfstand trotzdem schließen?')) return;
        if (!delivered && dirty && sending.phase !== 'unconfirmed' && !window.confirm(`Ungespeicherte E-Mail-Eingaben verwerfen?${draftId.current ? ' Der zuletzt gespeicherte Entwurf bleibt erhalten.' : ''}`)) return;
        onClose();
    }

    /** Every save and attachment mutation shares one synchronous lock. No autosave races. */
    async function persist(input: DraftInput): Promise<string> {
        if (draftId.current) await updateDraft(draftId.current, input);
        else draftId.current = (await createDraft(input)).id;
        const value = editor.current?.read() || body;
        setBody(value); setTyped(false);
        setSavedFingerprint(JSON.stringify([from, to, cc, bcc, subject, value.html, value.text]));
        setSavedAt(new Date()); changed();
        return draftId.current;
    }

    async function save(closeAfter = false): Promise<void> {
        if (actionLock.current || sending.locked || !canSend) return;
        actionLock.current = true; setOperation('saving'); setOperationError('');
        try { await persist(currentInput()); if (closeAfter) onClose(); }
        catch (reason) { setOperationError(reason instanceof Error ? reason.message : 'Entwurf konnte nicht gespeichert werden.'); }
        finally { actionLock.current = false; setOperation(null); }
    }

    async function attach(files: File[]): Promise<void> {
        if (actionLock.current || sending.locked || !canSend || !files.length) return;
        const problem = attachmentProblem(attachments, files);
        if (problem) { setOperationError(problem); return; }
        actionLock.current = true; setOperation('uploading'); setOperationError('');
        try {
            const id = await persist(currentInput());
            const failures: string[] = [];
            for (const file of files) {
                try { const stored = await uploadDraftAttachment(id, file); setAttachments(previous => [...previous, stored]); }
                catch { failures.push(file.name); }
            }
            if (failures.length) setOperationError(`Nicht angehängt: ${failures.join(', ')}. Erfolgreiche Dateien bleiben erhalten. Bitte nur die fehlenden Dateien erneut auswählen.`);
            changed();
        } catch (reason) { setOperationError(reason instanceof Error ? reason.message : 'Anhänge konnten nicht gespeichert werden.'); }
        finally { actionLock.current = false; setOperation(null); if (fileInput.current) fileInput.current.value = ''; }
    }

    async function importAttachment(id: string): Promise<void> {
        const attachment = original?.attachments.find(item => item.id === id);
        if (!original || !attachment || actionLock.current || sending.locked || importedAttachments[id] || !canSend) return;
        actionLock.current = true; setOperation('uploading'); setOperationError('');
        try {
            const knownProblem = attachmentProblem(attachments, [{ name: attachment.filename || 'Anhang', size: attachment.size || 0 }]);
            if (knownProblem) throw new Error(knownProblem);
            const bytes = await fetchInboxAttachment(original.id, id);
            const file = new File([bytes], attachment.filename || 'Anhang', { type: attachment.content_type });
            const problem = attachmentProblem(attachments, [file]);
            if (problem) throw new Error(problem);
            const target = await persist(currentInput());
            const stored = await uploadDraftAttachment(target, file);
            setAttachments(previous => [...previous, stored]);
            setImportedAttachments(previous => ({ ...previous, [id]: stored.id })); changed();
        } catch (reason) { setOperationError(reason instanceof Error ? reason.message : 'Originalanhang konnte nicht übernommen werden.'); }
        finally { actionLock.current = false; setOperation(null); }
    }

    async function removeAttachment(id: string): Promise<void> {
        if (!draftId.current || actionLock.current || sending.locked) return;
        actionLock.current = true; setOperation('uploading'); setOperationError('');
        try { await deleteDraftAttachment(draftId.current, id); setAttachments(previous => previous.filter(item => item.id !== id)); setImportedAttachments(previous => Object.fromEntries(Object.entries(previous).filter(([, stored]) => stored !== id))); changed(); }
        catch (reason) { setOperationError(reason instanceof Error ? reason.message : 'Anhang konnte nicht entfernt werden.'); }
        finally { actionLock.current = false; setOperation(null); }
    }

    function submit(finish = false, attachmentConfirmed = false): void {
        if (actionLock.current || sending.locked) return;
        const input = currentInput();
        const next: Record<string, string> = {};
        for (const [key, value] of Object.entries({ to, cc, bcc })) {
            const invalid = invalidEmailAddresses(value);
            if (invalid.length) next[key] = `Ungültige Adresse: ${invalid.join(', ')}`;
        }
        if (!input.to.length) next.to = 'Mindestens einen Empfänger eintragen.';
        if (!canSend) next.from = 'Keine Berechtigung für diese Absenderadresse.';
        if (!subject.trim()) next.subject = 'Bitte einen Betreff eintragen.';
        if (!input.body.trim()) next.body = 'Bitte eine Nachricht schreiben.';
        if ((input.to.length + (input.cc?.length || 0) + (input.bcc?.length || 0)) > 50) next.to = 'Höchstens 50 Empfänger pro Nachricht.';
        setErrors(next);
        if (Object.keys(next).length) {
            setContextOpen(false);
            requestAnimationFrame(() => { document.querySelector<HTMLElement>('[data-mail-composer] [aria-invalid="true"]')?.focus(); });
            return;
        }
        if (!attachmentConfirmed && !attachments.length && mentionsAttachment(input.body)) { setAttachmentCheck(finish); return; }
        setAttachmentCheck(null);
        const recipients = new Set(input.to.map(address => address.toLowerCase()));
        const cleanCc = input.cc?.filter(address => !recipients.has(address));
        cleanCc?.forEach(address => recipients.add(address));
        const cleanBcc = input.bcc?.filter(address => !recipients.has(address));
        actionLock.current = true;
        void sending.send({ ...input, subject: subject.trim(), body: input.body.trim(), cc: cleanCc, bcc: cleanBcc,
            replyToMessageId: input.replyToMessageId || undefined, draftId: draftId.current || undefined }, finish ? seed.replyToMessageId : undefined)
            .finally(() => { actionLock.current = false; });
    }

    const shortcut = useRef({ save, submit });
    useEffect(() => { shortcut.current = { save, submit }; });
    useEffect(() => {
        const listener = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.isComposing) return;
            if (event.key.toLowerCase() === 's') { event.preventDefault(); void shortcut.current.save(); }
            if (event.key === 'Enter') { event.preventDefault(); shortcut.current.submit(); }
        };
        window.addEventListener('keydown', listener);
        return () => window.removeEventListener('keydown', listener);
    }, []);

    async function suggest(): Promise<void> {
        if (aiBusy || aiTopic.trim().length < 4) return;
        setAiBusy(true);
        try { setAiResult(await createEmailDraftSuggestion({ topic: aiTopic.trim(), tone: 'professional' })); }
        catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Textvorschlag nicht verfügbar.'); }
        finally { setAiBusy(false); }
    }

    return <Dialog open onOpenChange={open => { if (!open) close(); }}>
        <DialogContent data-mail-composer className="flex h-[94dvh] max-h-[1000px] w-[calc(100vw_-_1rem)] max-w-[1400px] flex-col gap-0 overflow-hidden border-border-strong bg-surface p-0 sm:w-[calc(100vw_-_3rem)] sm:max-w-[1400px]" onPointerDownOutside={event => event.preventDefault()} onOpenAutoFocus={event => { if (seed.replyToMessageId) { event.preventDefault(); editor.current?.focus(); } }}>
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border-subtle px-4 py-4 pr-12 sm:px-6 sm:pr-14">
                <div className="min-w-0"><DialogTitle className="text-base">{COMPOSE_TITLES[mode]}</DialogTitle><DialogDescription className="mt-1 text-xs">{original ? 'Original lesen, Antwort schreiben und den Vorgang abschließen.' : 'Empfänger, Nachricht und Anhänge an einem Arbeitsplatz.'}</DialogDescription></div>
                <span role="status" className="hidden shrink-0 text-xs text-text-muted sm:block">{delivered ? 'E-Mail gesendet' : sending.phase === 'unconfirmed' ? 'Versand muss geprüft werden' : operation === 'saving' ? 'Entwurf wird gespeichert…' : dirty ? 'Ungespeicherte Änderungen' : savedAt ? `Gespeichert · ${savedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : seed.draftId ? 'Gespeicherter Entwurf' : 'Neuer Entwurf'}</span>
            </header>
            {original && <nav className="flex shrink-0 gap-1 border-b border-border-subtle p-2 lg:hidden" aria-label="Mail-Arbeitsbereich"><Button variant={!contextOpen ? 'secondary' : 'ghost'} size="sm" onClick={() => setContextOpen(false)} aria-pressed={!contextOpen}>Nachricht verfassen</Button><Button variant={contextOpen ? 'secondary' : 'ghost'} size="sm" onClick={() => setContextOpen(true)} aria-pressed={contextOpen}>Originalnachricht</Button></nav>}
            <div className={cn('grid min-h-0 flex-1 grid-cols-1', original && 'lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.35fr)]')}>
                {original && <aside aria-label="Originalnachricht" className={cn('min-h-0 overflow-y-auto border-r border-border-subtle bg-canvas p-4 lg:block', !contextOpen && 'hidden')}>
                    <p className="text-xs font-medium text-text-muted">ORIGINALNACHRICHT</p>
                    <h2 className="mt-3 break-words text-base font-semibold">{original.subject || '(ohne Betreff)'}</h2>
                    <p className="mt-2 break-all text-xs text-text-secondary">{original.from_name || original.from} · {original.from}</p>
                    <p className="mt-1 text-xs text-text-muted">{new Date(original.received_at).toLocaleString('de-DE')}</p>
                    <div className="mt-4"><MailHtmlFrame message={original} /></div>
                    {original.attachments.length > 0 && <section className="mt-4"><h3 className="text-xs font-semibold">Originalanhänge · nicht automatisch enthalten</h3><ul className="mt-2 space-y-2">{original.attachments.map(item => <li key={item.id} className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface p-2"><Paperclip className="size-3.5 shrink-0" /><span className="min-w-0 flex-1 break-all text-xs">{item.filename || 'Anhang'}</span><Button size="sm" variant="outline" disabled={disabled || !canSend || Boolean(importedAttachments[item.id])} onClick={() => void importAttachment(item.id)}>{importedAttachments[item.id] ? 'Übernommen' : 'Übernehmen'}</Button></li>)}</ul></section>}
                    <p className="mt-4 text-xs leading-5 text-text-muted">Interne Notizen gehören nicht zur Nachricht und werden nicht mitgesendet.</p>
                </aside>}
                <section aria-label="Nachricht verfassen" className={cn('min-h-0 min-w-0 overflow-y-auto lg:block', original && contextOpen && 'hidden')} onDragOver={event => { if (!disabled && event.dataTransfer.types.includes('Files')) event.preventDefault(); }} onDrop={event => { if (event.dataTransfer.files.length) { event.preventDefault(); void attach(Array.from(event.dataTransfer.files)); } }}>
                    <div className="space-y-3 px-4 py-4 sm:px-6">
                        {originalQuery.isError && !original && <p className="text-xs text-text-muted">Die zugehörige Originalnachricht ist momentan nicht verfügbar. Dein Entwurf bleibt vollständig bearbeitbar. <button type="button" className="underline" onClick={() => void originalQuery.refetch()}>Original erneut laden</button></p>}
                        {!canSend && <p role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">Für diesen Absender liegt keine Versandberechtigung vor. Wähle ein freigegebenes Postfach; Entwürfe und Versand sind bis dahin gesperrt.</p>}
                        <div className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-2 text-sm sm:grid-cols-[56px_minmax(0,1fr)]"><label htmlFor="compose-from" className="text-text-muted">Von</label><select id="compose-from" disabled={disabled} value={from} onChange={event => setFrom(event.target.value)} className="h-9 min-w-0 rounded-md border border-border-subtle bg-surface px-2 text-sm">{!sendingAddresses.includes(from) && <option value={from}>{from || 'Kein freigegebener Absender'}</option>}{sendingAddresses.map(address => <option key={address} value={address}>{address}</option>)}</select></div>
                        <RecipientField label="An" value={to} onChange={value => { setTo(value); setErrors(previous => ({ ...previous, to: '' })); }} error={errors.to} disabled={disabled} autoFocus={!seed.replyToMessageId} />
                        {copies ? <><RecipientField label="Cc" value={cc} onChange={setCc} error={errors.cc} disabled={disabled} /><RecipientField label="Bcc" value={bcc} onChange={setBcc} error={errors.bcc} disabled={disabled} /><p className="pl-12 text-xs text-text-muted sm:pl-16">Bcc-Empfänger sind für andere Empfänger nicht sichtbar.</p></> : <button type="button" className="ml-12 text-xs text-text-secondary underline underline-offset-4 sm:ml-16" onClick={() => setCopies(true)}>Cc / Bcc hinzufügen</button>}
                        <div className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-2 text-sm sm:grid-cols-[56px_minmax(0,1fr)]"><label htmlFor="compose-subject" className="pt-2 text-text-muted">Betreff</label><div><Input id="compose-subject" value={subject} onChange={event => setSubject(event.target.value)} disabled={disabled} aria-invalid={Boolean(errors.subject)} maxLength={500} className="h-9 shadow-none" />{errors.subject && <p className="mt-1 text-xs text-danger">{errors.subject}</p>}</div></div>
                    </div>
                    <div className="border-t border-border-subtle px-4 pb-4 sm:px-6">
                        <div className="flex flex-wrap items-center gap-1 py-2">
                            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" disabled={disabled}><FileText className="size-4" />Textbaustein<ChevronDown className="size-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start">{SNIPPETS.map(item => <DropdownMenuItem key={item.name} onSelect={() => editor.current?.insertText(item.text)}>{item.name}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
                            {original && <Button variant="ghost" size="sm" disabled={disabled} onClick={() => editor.current?.insertText(`\n\n${originalQuote(original!)}`)}><Quote className="size-4" />Original zitieren</Button>}
                            <button type="button" disabled={disabled} className="ml-auto px-2 py-2 text-xs text-text-muted hover:text-text-primary" aria-expanded={aiOpen} onClick={() => setAiOpen(value => !value)}>KI-Textvorschlag</button>
                        </div>
                        {aiOpen && <section className="mb-3 space-y-2 rounded-md border border-border-subtle bg-elevated p-3"><p className="text-xs text-text-secondary">Optionaler KI-Vorschlag nur aus deinen Angaben. Vor dem Einfügen prüfen.</p><Textarea aria-label="Angaben für den Textvorschlag" value={aiTopic} onChange={event => setAiTopic(event.target.value)} maxLength={2000} rows={2} disabled={disabled} /><Button size="sm" variant="outline" disabled={aiBusy || disabled || aiTopic.trim().length < 4} onClick={() => void suggest()}>{aiBusy ? 'Wird erstellt…' : 'Vorschlag erstellen'}</Button>{aiResult && <><p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm">{aiResult.body}</p><Button size="sm" disabled={disabled} onClick={() => { editor.current?.insertText(aiResult.body); if (!subject.trim()) setSubject(aiResult.subject); setAiOpen(false); }}>Geprüften Text einfügen</Button></>}</section>}
                        <RichEmailEditor ref={editor} initialHtml={initialHtml} compact disabled={disabled} invalid={Boolean(errors.body)} onDirty={() => setTyped(true)} onChange={value => setBody(value)} />
                        {errors.body && <p role="alert" className="mt-1 text-xs text-danger">{errors.body}</p>}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><Button size="sm" variant="outline" disabled={disabled || !canSend || attachments.length >= 10} onClick={() => fileInput.current?.click()}><Paperclip className="size-4" />Datei anhängen</Button><span className="text-xs text-text-muted">10 Dateien · je 10 MB · gesamt 20 MB</span><input ref={fileInput} aria-label="Dateien anhängen" className="hidden" type="file" multiple onChange={event => void attach(Array.from(event.target.files || []))} /></div>
                        {operation === 'uploading' && <p role="status" className="mt-2 flex items-center gap-2 text-xs text-text-secondary"><Loader2 className="size-3.5 animate-spin" />Anhänge werden verarbeitet…</p>}
                        {attachments.length > 0 && <ul aria-label="Anhänge dieser E-Mail" className="mt-3 space-y-2">{attachments.map(item => <li key={item.id} className="flex items-center gap-2 rounded-md border border-border-subtle px-3 py-2"><FileText className="size-4 shrink-0 text-text-muted" /><span className="min-w-0 flex-1 break-all text-xs">{item.filename}</span><span className="text-xs text-text-muted">{Math.max(1, Math.round(item.byte_size / 1024))} KB</span><button aria-label={`${item.filename} entfernen`} disabled={disabled} onClick={() => void removeAttachment(item.id)} className="p-1 text-text-muted hover:text-danger"><Trash2 className="size-4" /></button></li>)}</ul>}
                        <details className="mt-4 border-t border-border-subtle pt-3"><summary className="cursor-pointer text-xs text-text-secondary">Signatur · wird automatisch ergänzt</summary><p className="mt-2 whitespace-pre-line text-xs leading-5 text-text-muted">{profile.isLoading ? 'Signatur wird geladen…' : profile.isError ? 'Signatur konnte nicht geladen werden. Beim Versand gilt die gespeicherte Profilsignatur.' : signature}</p><Link className="mt-2 inline-block text-xs text-accent-500 underline" to="/profile">Signatur im Profil bearbeiten</Link></details>
                    </div>
                </section>
            </div>
            <footer className="shrink-0 border-t border-border-subtle bg-surface px-3 py-3 sm:px-5">
                {(operationError || sending.error) && <div role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm"><p className="font-medium">{sending.phase === 'finishFailed' ? 'E-Mail gesendet. Bearbeitungsstatus noch offen.' : sending.phase === 'unconfirmed' ? 'Versand nicht bestätigt' : 'Aktion nicht abgeschlossen'}</p><p className="mt-1 break-words text-xs leading-5">{operationError || sending.error}</p>{sending.phase === 'unconfirmed' && <p className="mt-2 text-xs leading-5">Nicht als neue E-Mail erneut senden. „Versand erneut prüfen“ verwendet exakt denselben Versandauftrag. Bei weiter unklarem Status ist eine Prüfung der Zustellung erforderlich.<span className="mt-1 block break-all text-text-muted">Vorgang: {sending.requestId}</span></p>}</div>}
                {attachmentCheck !== null && <div role="alert" className="mb-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm"><p>Deine Nachricht erwähnt einen Anhang, aber es ist keine Datei angehängt.</p><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setAttachmentCheck(null); fileInput.current?.click(); }}>Anhang ergänzen</Button><Button size="sm" variant="outline" onClick={() => submit(attachmentCheck, true)}>Bewusst ohne Anhang senden</Button><Button size="sm" variant="ghost" onClick={() => setAttachmentCheck(null)}>Weiter bearbeiten</Button></div></div>}
                {sending.phase === 'done' ? <div className="flex items-center justify-between gap-3"><p role="status" className="flex items-center gap-2 text-sm"><Check className="size-4 text-success" />E-Mail erfolgreich gesendet.</p><Button onClick={onClose}>Zurück zum Postfach</Button></div> : <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="ghost" disabled={busy} onClick={close}>{delivered ? 'Schließen' : 'Abbrechen'}</Button>
                    {!sending.locked && <><Button size="sm" variant="outline" onClick={() => void save()} disabled={busy || !canSend} title="Entwurf speichern (Strg/⌘ S)"><FilePen className="size-4" /><span>Entwurf speichern</span></Button><Button size="sm" variant="ghost" className="hidden sm:inline-flex" disabled={busy || !canSend} onClick={() => void save(true)}>Speichern & schließen</Button></>}
                    <div className="ml-auto flex items-center gap-1">
                        {sending.phase === 'unconfirmed' ? <Button size="sm" onClick={() => void sending.retry()}>Versand erneut prüfen</Button> : sending.phase === 'finishFailed' ? <Button size="sm" onClick={() => void sending.retryFinish()}>Nur Bearbeitung abschließen</Button> : <>
                            <Button size="sm" disabled={disabled || !canSend} onClick={() => submit()} title="Senden (Strg/⌘ Enter)">{sending.busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{sending.phase === 'finishing' ? 'Wird abgeschlossen…' : sending.phase === 'sending' ? 'Wird gesendet…' : 'Senden'}</Button>
                            {seed.replyToMessageId && <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" className="size-9" aria-label="Weitere Versandoptionen" disabled={disabled || !canSend}><ChevronDown className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => submit(true)}>Senden & erledigen</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
                        </>}
                    </div>
                </div>}
            </footer>
        </DialogContent>
    </Dialog>;
}
