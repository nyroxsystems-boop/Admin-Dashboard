/**
 * BotTestingView — Bot-Test-Lab (P2): eine Test-Nachricht gegen einen wählbaren
 * Händler schicken und die ECHTE Bot-Pipeline-Antwort strukturiert inspizieren —
 * Interim-Schritte, erkannte Teile + OEM-Kandidaten (Confidence), erzeugte Order
 * (Deep-Link) und das Angebots-PDF. Läuft 1:1 über POST /api/bot-testing/chat
 * (handleIncomingBotMessage), keine Mocks.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Package, Paperclip } from 'lucide-react';
import { toast } from 'sonner';

import { useBotTesting, type BotTestResult } from '@/hooks/useBotTesting';
import { fileToBase64 } from '@/api/bot';
import { TenantSelect } from '@/components/TenantSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatDateTime } from '@/utils/format/date';
import { SEITEN_RAND_OHNE_BREITE } from '@/components/ui/seite';
import { cn } from '@/lib/utils';

function pct(c: number | undefined): number {
    return Math.round((c ?? 0) * 100);
}

function downloadPdf(pdf: { base64: string; filename: string }): void {
    try {
        // Backend liefert rohes base64; ein evtl. data:-Prefix defensiv strippen.
        const b64 = pdf.base64.includes(',') ? pdf.base64.slice(pdf.base64.indexOf(',') + 1) : pdf.base64;
        const bytes = atob(b64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = pdf.filename || 'Angebot.pdf';
        a.click();
        URL.revokeObjectURL(url);
    } catch {
        toast.error('PDF konnte nicht erzeugt werden.');
    }
}

function ResultCard({ h }: { h: BotTestResult }): JSX.Element {
    const od = h.orderDetails;
    const candidates = od?.oemCandidates ?? [];
    const hasOem = Boolean(od && (od.oem_number || candidates.length > 0 || od.requested_part_name));
    return (
        <li className="rounded-md border border-border bg-surface/40 p-3 text-sm space-y-2">
            <div className="flex justify-between text-xs text-text-muted">
                <span className="font-mono">{h.phone}</span>
                <span>
                    {h.durationMs}ms · {formatDateTime(h.timestamp)}
                </span>
            </div>
            <div className="text-text-secondary">→ {h.message}</div>

            {h.interimMessages.length > 0 && (
                <ol className="space-y-0.5 border-l-2 border-border pl-3 text-xs text-text-muted">
                    {h.interimMessages.map((m, i) => (
                        <li key={i}>{m}</li>
                    ))}
                </ol>
            )}

            {h.status === 'error' ? (
                <div className="text-xs text-status-danger">{h.error}</div>
            ) : (
                <>
                    <div className="rounded bg-elevated/50 p-2 whitespace-pre-wrap text-text-primary">
                        ← {h.reply}
                    </div>

                    {hasOem && (
                        <div className="rounded border border-border p-2 space-y-1.5">
                            <div className="text-[10px] uppercase tracking-widest text-text-secondary">
                                Erkannte Teile / OEM
                            </div>
                            {od?.requested_part_name && (
                                <div className="font-medium">{od.requested_part_name}</div>
                            )}
                            {(od?.brand || od?.model || od?.year) && (
                                <div className="text-xs text-text-muted">
                                    {[od?.brand, od?.model, od?.year].filter(Boolean).join(' · ')}
                                </div>
                            )}
                            {od?.oem_number && (
                                <div className="font-mono">
                                    {od.oem_number}
                                    {od.oemConfidence != null && (
                                        <span className="text-text-muted"> · {pct(od.oemConfidence)}%</span>
                                    )}
                                </div>
                            )}
                            {candidates.slice(0, 5).map((c, i) => (
                                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                    <span className="font-mono">
                                        {c.oem}
                                        {c.brand ? <span className="text-text-muted"> ({c.brand})</span> : ''}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-1 w-16 overflow-hidden rounded bg-border">
                                            <span
                                                className="block h-full bg-accent-500"
                                                style={{ width: `${pct(c.confidence)}%` }}
                                            />
                                        </span>
                                        <span className="tabular-nums text-text-muted">{pct(c.confidence)}%</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {h.orderId && (
                        <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-text-secondary">
                                <Package className="size-3" />
                                Order <span className="font-mono">{String(h.orderId).slice(0, 8)}</span>
                                {od?.status && <span className="text-text-muted"> · {od.status}</span>}
                            </span>
                            {h.merchantId && (
                                <Link
                                    to={`/tenants/${h.merchantId}`}
                                    className="flex items-center gap-1 text-accent-500 hover:underline"
                                >
                                    Zum Händler <ExternalLink className="size-3" />
                                </Link>
                            )}
                        </div>
                    )}

                    {h.pdfDocument && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadPdf(h.pdfDocument!)}
                            className="text-xs"
                        >
                            <FileText className="size-3" /> Angebot: {h.pdfDocument.filename}
                        </Button>
                    )}
                </>
            )}

            <div className="text-[10px] font-mono text-text-muted">{h.status}</div>
        </li>
    );
}

export default function BotTestingView(): JSX.Element {
    const { history, isRunning, error, sendTest, clearHistory } = useBotTesting();
    const [merchantId, setMerchantId] = useState<string | null>(null);
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [isReadingFile, setIsReadingFile] = useState(false);

    const phoneValid = useMemo(() => /^\+?[0-9 ()-]{6,}$/.test(phone.trim()), [phone]);
    const canSend = phoneValid && message.trim().length > 0 && !isRunning && !isReadingFile;

    async function handleUpload(file: File): Promise<void> {
        setIsReadingFile(true);
        try {
            setImageBase64(await fileToBase64(file));
            toast.success('Bild angefügt.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Bild konnte nicht gelesen werden.');
        } finally {
            setIsReadingFile(false);
        }
    }

    return (
        <div className={cn(SEITEN_RAND_OHNE_BREITE, 'mx-auto max-w-5xl')}>
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">Bot-Test-Lab</h1>
                <p className="text-sm text-text-secondary">
                    Test-Nachricht gegen einen wählbaren Händler — echte Bot-Pipeline, strukturierte
                    Antwort.
                </p>
            </header>

            <div className="grid md:grid-cols-2 gap-6">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!canSend) return;
                        void sendTest({
                            phone: phone.trim(),
                            message,
                            ...(merchantId ? { merchantId } : {}),
                            ...(imageBase64 ? { imageBase64 } : {}),
                        }).then(() => setImageBase64(null));
                    }}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <Label>Als Händler testen</Label>
                        <TenantSelect
                            value={merchantId}
                            onChange={setMerchantId}
                            placeholder="Händler wählen (sonst Default)…"
                        />
                        <p className="text-xs text-text-muted">
                            Ohne Auswahl läuft der Test gegen den Default-Mandanten.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bt-phone">Telefonnummer (Kunde)</Label>
                        <Input
                            id="bt-phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+49 ..."
                            aria-invalid={phone !== '' && !phoneValid}
                        />
                        {phone && !phoneValid && (
                            <p className="text-xs text-status-danger">Ungültiges Telefonformat.</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bt-msg">Nachricht</Label>
                        <Textarea
                            id="bt-msg"
                            rows={5}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="z.B. 'Bremsbeläge vorne für VW Golf 2019'"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bt-media">Fahrzeugschein / Foto (optional)</Label>
                        <div className="flex items-center gap-2">
                            <input
                                id="bt-media"
                                type="file"
                                accept="image/*"
                                className="text-xs"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleUpload(f);
                                }}
                            />
                            {isReadingFile && <span className="text-xs text-text-muted">Lese Bild…</span>}
                            {imageBase64 && (
                                <span className="text-xs text-success flex items-center gap-1">
                                    <Paperclip className="size-3" /> angefügt
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" disabled={!canSend}>
                            {isRunning ? 'Sende…' : 'Senden'}
                        </Button>
                        {history.length > 0 && (
                            <Button type="button" variant="ghost" onClick={clearHistory}>
                                Verlauf leeren
                            </Button>
                        )}
                    </div>
                    {error && <ErrorState message={error} />}
                </form>

                <div>
                    <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-2">
                        Verlauf
                    </h3>
                    {isRunning ? (
                        <LoadingState label="AI denkt nach…" />
                    ) : history.length === 0 ? (
                        <EmptyState
                            title="Noch keine Tests"
                            description="Sende eine Nachricht, um zu starten."
                        />
                    ) : (
                        <ul className="space-y-2 max-h-[600px] overflow-y-auto">
                            {history.map((h) => (
                                <ResultCard key={h.id} h={h} />
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
