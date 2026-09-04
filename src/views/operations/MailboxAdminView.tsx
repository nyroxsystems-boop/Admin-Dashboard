/**
 * Postfach-Verwaltung — wer darf welches Postfach lesen.
 *
 * Nur für Superadmins. Bis hierher war die einzige Möglichkeit, ein Recht zu
 * ändern, ein SQL-Befehl auf dem Produktivserver; die Fehlermeldung „Kein
 * Postfach zugewiesen" verwies bereits auf diesen Bildschirm.
 *
 * Jede Änderung landet im Prüflog, das unten mitläuft. Das ist kein Beiwerk:
 * ein Superadmin kann sich jedes Postfach selbst zuteilen — verhindern lässt
 * sich das nicht, ohne ihn im Notfall auszusperren. Sichtbar machen lässt es
 * sich schon.
 */
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, KeyRound, Loader2, Mail, ShieldAlert, Trash2, Upload, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import {
    grantMailboxAccess,
    listDocuments,
    listMailboxAdministration,
    putDocument,
    revokeMailboxAccess,
    type MailboxAdminEntry,
} from '@/api/inbox';
import { API_BASE_URL } from '@/api/client';
import { listAdmins } from '@/api/admins';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatDateTime } from '@/utils/format/date';
import { cn } from '@/lib/utils';

const KIND_LABELS: Record<MailboxAdminEntry['kind'], string> = {
    shared: 'Geteilt',
    personal: 'Persönlich',
    quarantine: 'Quarantäne',
};

interface Reader {
    username: string;
    canSend: boolean;
    isBreakGlass: boolean;
}

/** Das Backend liefert die Leser kompakt als "name:true[:notfall]"-Liste. */
function parseReaders(raw: string | null): Reader[] {
    if (!raw) return [];
    return raw.split(',').filter(Boolean).map((entry) => {
        const [username, canSend, flag] = entry.split(':');
        return {
            username,
            canSend: canSend === 'true',
            isBreakGlass: flag === 'notfall',
        };
    });
}

export default function MailboxAdminView(): JSX.Element {
    const queryClient = useQueryClient();
    const [target, setTarget] = useState<{ mailbox: string; adminId: string } | null>(null);
    const [canSend, setCanSend] = useState(true);
    const [breakGlass, setBreakGlass] = useState(false);
    const [reason, setReason] = useState('');

    const adminQuery = useQuery({ queryKey: ['admin', 'admins'], queryFn: listAdmins });
    const dataQuery = useQuery({
        queryKey: ['admin', 'inbox', 'administration'],
        queryFn: listMailboxAdministration,
    });

    function refresh(): void {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'inbox'] });
    }

    const grant = useMutation({
        mutationFn: grantMailboxAccess,
        onSuccess: (result) => {
            toast.success(result.breakGlass ? 'Notfallzugriff erteilt.' : 'Zugriff erteilt.');
            setTarget(null);
            setReason('');
            setBreakGlass(false);
            refresh();
        },
        onError: (error: Error) => toast.error(error.message || 'Zugriff konnte nicht erteilt werden.'),
    });

    const revoke = useMutation({
        mutationFn: (input: { adminId: string; mailbox: string }) =>
            revokeMailboxAccess(input.adminId, input.mailbox),
        onSuccess: () => {
            toast.success('Zugriff entzogen.');
            refresh();
        },
        onError: (error: Error) => toast.error(error.message || 'Zugriff konnte nicht entzogen werden.'),
    });

    if (dataQuery.isLoading) return <LoadingState label="Lade Postfach-Verwaltung…" />;
    if (dataQuery.error) {
        return (
            <ErrorState
                title="Verwaltung nicht erreichbar"
                message="Die Postfach-Verwaltung konnte nicht geladen werden."
                detail={dataQuery.error instanceof Error ? dataQuery.error.message : undefined}
                onRetry={() => void dataQuery.refetch()}
                className="m-6"
            />
        );
    }

    const mailboxes = dataQuery.data?.mailboxes ?? [];
    const events = dataQuery.data?.events ?? [];
    // listAdmins liefert { admins: [...] }, nicht das Array selbst.
    const admins = adminQuery.data?.admins ?? [];

    return (
        <div>
            <header className="mb-5">
                <h2 className="text-lg font-semibold tracking-tight">Postfach-Rechte</h2>
                <p className="mt-1 text-sm text-text-muted">
                    Wer darf welches Postfach lesen und daraus senden. Jede Änderung wird protokolliert.
                </p>
            </header>

            <section className="space-y-3" aria-label="Postfächer">
                {mailboxes.map((mailbox) => {
                    const readers = parseReaders(mailbox.readers);
                    const istOffen = target?.mailbox === mailbox.address;
                    return (
                        <div
                            key={mailbox.address}
                            className={cn(
                                'rounded-lg border bg-surface p-4',
                                mailbox.isActive ? 'border-border-subtle' : 'border-border-subtle opacity-60',
                            )}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <Mail className="size-4 shrink-0 text-text-muted" />
                                <span className="font-medium text-text-primary">{mailbox.address}</span>
                                <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[10px] text-text-muted">
                                    {KIND_LABELS[mailbox.kind]}
                                </span>
                                {mailbox.isFallback && (
                                    <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] text-warning">
                                        Auffangpostfach
                                    </span>
                                )}
                                {!mailbox.isActive && (
                                    <span className="text-[10px] text-text-muted">stillgelegt</span>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto"
                                    onClick={() => setTarget(istOffen ? null : { mailbox: mailbox.address, adminId: '' })}
                                >
                                    <UserPlus className="size-4" /> Zugriff erteilen
                                </Button>
                            </div>

                            {readers.length === 0 ? (
                                <p className="mt-3 flex items-center gap-1.5 text-xs text-danger">
                                    <ShieldAlert className="size-3.5" />
                                    Niemand kann dieses Postfach lesen — hier eingehende Post wäre unsichtbar.
                                </p>
                            ) : (
                                <ul className="mt-3 flex flex-wrap gap-1.5">
                                    {readers.map((reader) => (
                                        <li
                                            key={reader.username}
                                            className="flex items-center gap-1.5 rounded-md bg-elevated px-2 py-1 text-xs"
                                        >
                                            <span className="text-text-primary">{reader.username}</span>
                                            <span className="text-text-muted">
                                                {reader.canSend ? 'lesen + senden' : 'nur lesen'}
                                            </span>
                                            {reader.isBreakGlass && (
                                                <span className="inline-flex items-center gap-1 text-warning">
                                                    <KeyRound className="size-3" />Notfall
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                aria-label={`Zugriff von ${reader.username} auf ${mailbox.address} entziehen`}
                                                disabled={revoke.isPending}
                                                onClick={() => {
                                                    const admin = admins.find((a) => a.username === reader.username);
                                                    if (!admin) {
                                                        toast.error('Admin nicht gefunden.');
                                                        return;
                                                    }
                                                    revoke.mutate({ adminId: String(admin.id), mailbox: mailbox.address });
                                                }}
                                                className="text-text-muted transition-colors hover:text-danger disabled:opacity-50"
                                            >
                                                <Trash2 className="size-3" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {istOffen && (
                                <div className="mt-4 space-y-3 rounded-md border border-border-subtle bg-canvas/60 p-3">
                                    <Select
                                        value={target?.adminId || ''}
                                        onValueChange={(adminId) => setTarget({ mailbox: mailbox.address, adminId })}
                                    >
                                        <SelectTrigger size="sm"><SelectValue placeholder="Admin auswählen" /></SelectTrigger>
                                        <SelectContent>
                                            {admins.map((admin) => (
                                                <SelectItem key={String(admin.id)} value={String(admin.id)}>
                                                    {admin.username}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <div className="flex flex-wrap items-center gap-4 text-xs">
                                        <label className="flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={canSend && !breakGlass}
                                                disabled={breakGlass}
                                                onChange={(event) => setCanSend(event.target.checked)}
                                            />
                                            Darf auch senden
                                        </label>
                                        <label className="flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={breakGlass}
                                                onChange={(event) => setBreakGlass(event.target.checked)}
                                            />
                                            Notfallzugriff (befristet, nur lesen)
                                        </label>
                                    </div>

                                    {breakGlass && (
                                        <Input
                                            value={reason}
                                            onChange={(event) => setReason(event.target.value)}
                                            placeholder="Begründung (mindestens 20 Zeichen) — landet im Prüflog"
                                            className="h-9 text-xs"
                                        />
                                    )}

                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>Abbrechen</Button>
                                        <Button
                                            size="sm"
                                            disabled={!target?.adminId || grant.isPending || (breakGlass && reason.trim().length < 20)}
                                            onClick={() => grant.mutate({
                                                adminId: target?.adminId ?? '',
                                                mailbox: mailbox.address,
                                                canSend: canSend && !breakGlass,
                                                breakGlass,
                                                reason: breakGlass ? reason.trim() : undefined,
                                            })}
                                        >
                                            {grant.isPending && <Loader2 className="size-3.5 animate-spin" />}
                                            Erteilen
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </section>

            <section className="mt-8" aria-label="Broschüre">
                <h2 className="mb-1 text-sm font-semibold">Broschüre</h2>
                <p className="mb-3 text-xs text-text-muted">
                    Das CRM wählt anhand des Lead-Landes automatisch die passende Sprachfassung und
                    verschickt sie als PDF-Anhang sowie über einen stabilen Link. DE, AT und CH nutzen
                    Deutsch; FR nutzt Französisch.
                    Die Adresse ist <strong>öffentlich abrufbar</strong>, damit Kunden sie
                    ohne Anmeldung öffnen können.
                </p>
                <BrochureUpload />
            </section>

            <section className="mt-8" aria-label="Prüflog">
                <h2 className="mb-3 text-sm font-semibold">Prüflog</h2>
                {events.length === 0 ? (
                    <EmptyState
                        icon={KeyRound}
                        title="Noch keine Änderungen"
                        description="Erteilte und entzogene Zugriffe erscheinen hier."
                        className="border-0 bg-transparent"
                    />
                ) : (
                    <ul className="space-y-1">
                        {events.map((event, index) => (
                            <li
                                key={`${event.occurredAt}:${index}`}
                                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md bg-elevated/50 px-3 py-2 text-xs"
                            >
                                <time className="shrink-0 text-text-muted">{formatDateTime(event.occurredAt)}</time>
                                <span className="font-medium text-text-primary">{event.event}</span>
                                <span className="text-text-secondary">
                                    {event.actorLabel || 'System'} → {event.targetLabel || '—'}
                                </span>
                                {event.mailboxAddress && (
                                    <span className="text-text-muted">{event.mailboxAddress}</span>
                                )}
                                {event.reason && (
                                    <span className="w-full text-text-muted">„{event.reason}"</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

const BROCHURE_VARIANTS = [
    { slug: 'broschuere', label: 'Deutsch', countries: 'DE · AT · CH' },
    { slug: 'broschuere-fr', label: 'Français', countries: 'FR' },
] as const;

/** Upload und Anzeige aller landabhängigen Broschüren. */
function BrochureUpload(): JSX.Element {
    const query = useQuery({ queryKey: ['admin', 'documents'], queryFn: listDocuments });

    return (
        <div className="grid gap-3 xl:grid-cols-2">
            {BROCHURE_VARIANTS.map((variant) => (
                <BrochureVariantUpload
                    key={variant.slug}
                    {...variant}
                    document={query.data?.find((doc) => doc.slug === variant.slug)}
                />
            ))}
        </div>
    );
}

function BrochureVariantUpload({
    slug,
    label,
    countries,
    document,
}: (typeof BROCHURE_VARIANTS)[number] & { document?: Awaited<ReturnType<typeof listDocuments>>[number] }): JSX.Element {
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const url = `${API_BASE_URL}/dokumente/${slug}`;

    async function upload(files: FileList | null): Promise<void> {
        const file = files?.[0];
        if (!file) return;
        setBusy(true);
        try {
            await putDocument(slug, file);
            toast.success(`${label}-Broschüre gespeichert. Der Link bleibt unverändert.`);
            void queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Upload fehlgeschlagen.');
        } finally {
            setBusy(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    }

    return (
        <div className="karte-klein p-4">
            <div className="mb-3 flex items-center gap-2">
                <FileText className="size-4 shrink-0 text-accent-500" />
                <strong className="text-sm text-text-primary">{label}</strong>
                <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-muted">{countries}</span>
            </div>
            {document ? (
                <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary">{document.filename}</p>
                    <p className="text-[11px] text-text-muted">
                        {Math.max(1, Math.round(document.byteSize / 1024))} KB · zuletzt {formatDateTime(document.updatedAt)}
                    </p>
                </div>
            ) : (
                <p className="flex items-center gap-1.5 text-sm text-danger">
                    <ShieldAlert className="size-4" />
                    Diese Sprachfassung fehlt noch.
                </p>
            )}
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(event) => void upload(event.target.files)} />
            <Button variant="outline" size="sm" className="mt-3" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {document ? 'Ersetzen' : 'Hochladen'}
            </Button>
            {document && <p className="mt-3 break-all rounded-md bg-elevated px-2.5 py-1.5 font-mono text-[11px] text-text-secondary">{url}</p>}
        </div>
    );
}
