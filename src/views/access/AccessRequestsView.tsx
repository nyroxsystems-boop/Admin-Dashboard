/**
 * AccessRequestsView — Großhändler-Zugänge für einen Kunden beantragen.
 *
 * Flow: Kunde wählen → Zugang wählen → server-gefüllte Mail prüfen/bearbeiten →
 * senden. Die Mail geht im Namen von Partsunion raus (White-Label), Reply-To =
 * der eingeloggte Admin, Signatur = die persönliche Admin-Signatur. Jeder
 * Versand landet im Verlauf (access_requests).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    AlertTriangle,
    Building2,
    CheckCircle2,
    KeyRound,
    Loader2,
    Mail,
    Send,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { TenantSelect } from '@/components/TenantSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import {
    AbschnittMarke,
    SeitenKopf,
    TABELLE_KOPF,
    TABELLE_KOPF_ZELLE,
    TABELLE_ZEILE,
    TABELLE_ZELLE,
    TabellenKarte,
} from '@/components/ui/seite';
import { formatDateTime } from '@/utils/format/date';
import {
    listAccessProviders,
    previewAccessRequest,
    sendAccessRequest,
    getAccessRequestHistory,
    type AccessProvider,
    type AccessRequestPreview,
} from '@/api/accessRequests';
import { parseError } from '@/api/client';
import { SEITEN_RAND } from '@/components/ui/seite';
import { cn } from '@/lib/utils';
import { KACHEL } from '@/components/ui/dichte';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_PROVIDERS: AccessProvider[] = [];

export default function AccessRequestsView(): JSX.Element {
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [providerKey, setProviderKey] = useState<string | null>(null);

    const providersQ = useQuery({
        queryKey: ['admin', 'access-providers'],
        queryFn: listAccessProviders,
        staleTime: 5 * 60_000,
    });
    const providers = providersQ.data ?? EMPTY_PROVIDERS;

    const historyQ = useQuery({
        queryKey: ['admin', 'access-requests', tenantId ?? 'all'],
        queryFn: () => getAccessRequestHistory(tenantId ?? undefined),
        staleTime: 15_000,
    });

    const selectedProvider = providers.find((p) => p.key === providerKey) ?? null;

    const previewQ = useQuery({
        queryKey: ['admin', 'access-request-preview', tenantId, providerKey],
        queryFn: () => {
            if (!tenantId || !providerKey) {
                throw new Error('Kunde und Zugang müssen ausgewählt sein.');
            }
            return previewAccessRequest(tenantId, providerKey);
        },
        enabled: Boolean(tenantId && providerKey),
        staleTime: 60_000,
    });

    return (
        <div className={cn(SEITEN_RAND)}>
            <SeitenKopf
                className="mb-[26px]"
                titel="Zugänge beantragen"
                beileile={
                    <span className="block max-w-[76ch] text-pretty leading-[1.6]">
                        Beantrage für einen Kunden einen Großhändler-Zugang. Wähle Kunde und Zugang —
                        die Anfrage-Mail wird automatisch mit den Kundendaten und deiner Signatur
                        gefüllt. Versand erfolgt im Namen von Partsunion (Antworten gehen an dich).
                    </span>
                }
            />

            {/* Schritt 1: Kunde */}
            <section className="mb-[26px]">
                <AbschnittMarke className="mb-3.5" nummer={1}>Kunde wählen</AbschnittMarke>
                <div className="max-w-[27.5rem]">
                    <TenantSelect value={tenantId} onChange={setTenantId} placeholder="Kunde wählen…" />
                </div>
            </section>

            {/* Schritt 2: Zugang */}
            <section className="mb-[26px]">
                <AbschnittMarke
                    className="mb-3.5"
                    nummer={2}
                    aktion={
                        providers.length > 0 && (
                            <span className="shrink-0 text-[11px] font-medium text-text-faint">
                                {providers.length} Großhändler
                            </span>
                        )
                    }
                >
                    Zugang wählen
                </AbschnittMarke>
                {providersQ.isLoading ? (
                    <LoadingState label="Lade Zugänge…" />
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {providers.map((p) => (
                            <ProviderCard
                                key={p.key}
                                provider={p}
                                selected={p.key === providerKey}
                                disabled={!tenantId}
                                onSelect={() => setProviderKey(p.key)}
                            />
                        ))}
                    </div>
                )}
                {!tenantId && (
                    <p className="mt-2 text-xs text-text-muted">Wähle zuerst einen Kunden.</p>
                )}
            </section>

            {/* Schritt 3: Vorschau + Versand */}
            {tenantId && providerKey && (
                <section className="mb-8">
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-text-muted">
                        3 · Anfrage prüfen &amp; senden
                    </Label>

                    {previewQ.isLoading ? (
                        <LoadingState label="Erzeuge Vorschau…" />
                    ) : previewQ.isError ? (
                        <div className="space-y-3 rounded-md border border-status-danger/40 bg-status-danger-muted/40 p-4 text-sm text-status-danger">
                            <p>{parseError(previewQ.error).message}</p>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void previewQ.refetch()}
                            >
                                Erneut versuchen
                            </Button>
                        </div>
                    ) : previewQ.data ? (
                        <AccessRequestEditor
                            key={`${tenantId}:${providerKey}`}
                            tenantId={tenantId}
                            providerKey={providerKey}
                            provider={selectedProvider}
                            preview={previewQ.data}
                            onSent={() => void historyQ.refetch()}
                        />
                    ) : null}
                </section>
            )}

            {/* Hinweisband wie im Entwurf: erklärt, was beim nächsten Klick
                passiert. Es steht NUR da, wenn Kunde und Zugang gewählt sind —
                davor wäre es ein Versprechen ohne Knopf. */}
            {tenantId && providerKey && (
                <div className="mb-[26px] flex flex-wrap items-center gap-3.5 rounded-2xl border border-accent-500/20 bg-[linear-gradient(135deg,hsl(var(--accent-500)/0.12),hsl(0_0%_100%/0.015))] px-5 py-[18px]">
                    <Mail className="size-[18px] shrink-0 text-accent-500" aria-hidden />
                    <span className="min-w-[16rem] flex-1 text-[12px] leading-[1.5] text-text-secondary">
                        Anfrage-Mail wird mit Kundendaten und deiner Signatur vorbereitet —
                        du prüfst sie vor dem Versand.
                    </span>
                </div>
            )}

            {/* Verlauf */}
            <section>
                <AbschnittMarke className="mb-3.5">
                    {tenantId ? 'Verlauf · dieser Kunde' : 'Verlauf · alle Kunden'}
                </AbschnittMarke>
                {historyQ.isLoading ? (
                    <LoadingState label="Lade Verlauf…" />
                ) : (historyQ.data ?? []).length === 0 ? (
                    <EmptyState
                        icon={KeyRound}
                        title="Noch keine Anfragen"
                        description="Versendete Zugangs-Anfragen erscheinen hier."
                    />
                ) : (
                    <TabellenKarte>
                        <table className="w-full min-w-[720px] text-sm">
                            <thead className={TABELLE_KOPF}>
                                <tr>
                                    <th className={TABELLE_KOPF_ZELLE}>Datum</th>
                                    <th className={TABELLE_KOPF_ZELLE}>Zugang</th>
                                    <th className={TABELLE_KOPF_ZELLE}>Empfänger</th>
                                    <th className={TABELLE_KOPF_ZELLE}>Von</th>
                                    <th className={TABELLE_KOPF_ZELLE}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(historyQ.data ?? []).map((h) => (
                                    <tr key={h.id} className={TABELLE_ZEILE}>
                                        <td className={cn(TABELLE_ZELLE, "whitespace-nowrap text-text-secondary")}>
                                            {formatDateTime(h.created_at)}
                                        </td>
                                        <td className={TABELLE_ZELLE}>
                                            <span className="inline-flex items-center gap-1.5">
                                                <Building2 className="size-3.5 text-text-muted" />
                                                {h.provider_name ?? h.supplier_key}
                                            </span>
                                        </td>
                                        <td className={cn(TABELLE_ZELLE, "text-text-secondary")}>{h.recipient_email}</td>
                                        <td className={cn(TABELLE_ZELLE, "text-text-secondary")}>
                                            {h.requested_by_name ?? '—'}
                                        </td>
                                        <td className={TABELLE_ZELLE}>
                                            {h.status === 'sent' ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-status-success">
                                                    <CheckCircle2 className="size-3.5" /> gesendet
                                                </span>
                                            ) : (
                                                <span
                                                    className="inline-flex items-center gap-1 text-xs text-status-danger"
                                                    title={h.error ?? undefined}
                                                >
                                                    <XCircle className="size-3.5" /> fehlgeschlagen
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </TabellenKarte>
                )}
            </section>
        </div>
    );
}

function AccessRequestEditor({
    tenantId,
    providerKey,
    provider,
    preview,
    onSent,
}: {
    tenantId: string;
    providerKey: string;
    provider: AccessProvider | null;
    preview: AccessRequestPreview;
    onSent: () => void;
}): JSX.Element {
    const [recipient, setRecipient] = useState(preview.recipient ?? '');
    const [subject, setSubject] = useState(preview.subject);
    const [body, setBody] = useState(preview.body);
    const [ccMe, setCcMe] = useState(false);
    const [sending, setSending] = useState(false);

    const canSend =
        EMAIL_RE.test(recipient.trim()) &&
        subject.trim().length > 0 &&
        body.trim().length > 0;

    async function handleSend(): Promise<void> {
        if (!canSend || sending) return;
        setSending(true);
        try {
            await sendAccessRequest({
                tenantId,
                supplierKey: providerKey,
                recipient: recipient.trim(),
                subject: subject.trim(),
                body,
                cc: ccMe && EMAIL_RE.test(preview.replyTo) ? preview.replyTo : undefined,
            });
            toast.success('Anfrage versendet', {
                description: `${provider?.name ?? providerKey} · an ${recipient.trim()}`,
            });
            onSent();
        } catch (err) {
            toast.error('Versand fehlgeschlagen', { description: parseError(err).message });
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="rounded-lg border border-border bg-surface/40 p-4 md:p-5 space-y-4">
            {preview.missingFields.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning-muted/40 p-3 text-xs text-status-warning">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                        <span className="font-medium">Unvollständige Kundendaten: </span>
                        {preview.missingFields.join(', ')}.{' '}
                        <span className="text-text-muted">
                            Die Mail enthält dort „—" — ergänze die Daten beim Kunden oder direkt im
                            Text.
                        </span>
                    </div>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <Label htmlFor="ar-recipient" className="mb-1.5 block text-xs">
                        Empfänger
                    </Label>
                    <Input
                        id="ar-recipient"
                        type="email"
                        value={recipient}
                        placeholder="empfaenger@grosshaendler.de"
                        onChange={(event) => setRecipient(event.target.value)}
                    />
                    {!recipient && provider?.kind === 'wholesaler' && (
                        <p className="mt-1 text-[11px] text-text-muted">
                            Für {provider.name} ist keine Standard-Adresse hinterlegt — bitte eintragen.
                        </p>
                    )}
                </div>
                <div>
                    <Label className="mb-1.5 block text-xs">Absender / Antwort an</Label>
                    <div className="flex h-9 items-center gap-2 rounded-lg border border-border-subtle bg-elevated/40 px-3 text-xs text-text-secondary">
                        <Mail className="size-3.5 shrink-0" />
                        <span className="truncate">
                            Partsunion · Antworten an {preview.replyTo || '—'}
                        </span>
                    </div>
                </div>
            </div>

            <div>
                <Label htmlFor="ar-subject" className="mb-1.5 block text-xs">
                    Betreff
                </Label>
                <Input
                    id="ar-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                />
            </div>

            <div>
                <Label htmlFor="ar-body" className="mb-1.5 block text-xs">
                    Nachricht
                </Label>
                <Textarea
                    id="ar-body"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={18}
                    className="font-mono text-[12px] leading-relaxed"
                />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs text-text-secondary">
                    <Checkbox
                        checked={ccMe}
                        onCheckedChange={(value) => setCcMe(value === true)}
                        disabled={!EMAIL_RE.test(preview.replyTo)}
                    />
                    Kopie an mich ({preview.replyTo || 'keine E-Mail hinterlegt'})
                </label>
                <Button onClick={() => void handleSend()} disabled={!canSend || sending}>
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    {sending ? 'Sende…' : 'Anfrage senden'}
                </Button>
            </div>
        </div>
    );
}

/** Zwei Buchstaben als Marke einer Anbieterkarte. */
function kuerzel(name: string): string {
    const teile = name.split(/[\s\-_.]+/).filter(Boolean);
    if (teile.length === 0) return '—';
    if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase();
    return (teile[0][0] + teile[1][0]).toUpperCase();
}

function ProviderCard({
    provider,
    selected,
    disabled,
    onSelect,
}: {
    provider: AccessProvider;
    selected: boolean;
    disabled: boolean;
    onSelect: () => void;
}): JSX.Element {
    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={disabled}
            className={cn(
                // Entwurf: 16 px Radius, 168 px Mindesthöhe, beim Überfahren
                // hebt sich die Karte um 3 px. Die Hebung sagt "anklickbar",
                // ohne dass ein Rahmen aufblinken muss.
                'group relative flex w-full flex-col rounded-2xl border text-left', KACHEL,
                'transition-[transform,border-color] motion-safe:hover:-translate-y-[3px]',
                'disabled:pointer-events-none disabled:opacity-50',
                selected
                    ? 'border-accent-500/60 bg-accent-500/[0.07]'
                    : 'border-overlay/[0.075] bg-gradient-to-b from-overlay/[0.038] to-overlay/[0.01] hover:border-accent-500/45',
            )}
        >
            <div className="flex items-center gap-3">
                {/* 36-px-Marke mit Kürzel statt eines Allerwelt-Symbols: sechs
                    Karten mit demselben Gebäude-Symbol sind nicht
                    unterscheidbar. */}
                <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-overlay/[0.08] bg-overlay/[0.055] font-display text-xs font-bold text-accent-200"
                >
                    {kuerzel(provider.name)}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-[14px] font-bold">
                    {provider.name}
                </span>
                {/* Auswahlkästchen wie im Entwurf — 18 px, gerundet. */}
                <span
                    aria-hidden
                    className={cn(
                        'flex size-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors',
                        selected ? 'border-accent-500 bg-accent-500 text-white' : 'border-overlay/[0.16]',
                    )}
                >
                    {selected && <CheckCircle2 className="size-3" />}
                </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-overlay/[0.055] px-[7px] py-[5px] font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-text-tertiary">
                    Grosshändler
                </span>
                <span className="rounded-md bg-overlay/[0.055] px-[7px] py-[5px] font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-text-tertiary">
                    {provider.country}
                </span>
                {provider.hasApi && (
                    <span className="rounded-md bg-success/10 px-[7px] py-[5px] font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-success">
                        API
                    </span>
                )}
            </div>
            <p className="text-xs text-text-muted">{provider.accessLabel}</p>
        </button>
    );
}
