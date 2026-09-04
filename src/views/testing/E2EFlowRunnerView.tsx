/**
 * E2EFlowRunnerView (P3) — ein Bot-Durchlauf (Schein→OCR→OEM→Preis→Angebot→
 * Bestellung→Rechnung) als sichtbare Stufen-Pipeline. Läuft AUSSCHLIESSLICH über
 * die echte Pipeline (POST /api/bot-testing/run-flow). Stufen werden ehrlich aus
 * dem tatsächlichen Verlauf abgeleitet; nicht erreichte Stufen = „übersprungen"
 * mit Begründung (kein roter Fehler). Die Rechnungs-Stufe ist bedingt.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    CheckCircle2,
    Circle,
    ExternalLink,
    FileText,
    Loader2,
    MinusCircle,
    Paperclip,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { TenantSelect } from '@/components/TenantSelect';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useRunE2EFlow, useRunnerScenarios } from '@/hooks/useE2EFlow';
import { fileToBase64 } from '@/api/bot';
import type { E2EFlowResult, FlowStep, FlowStepKey } from '@/api/e2eFlow';
import { cn } from '@/lib/utils';
import { SEITEN_RAND_OHNE_BREITE } from '@/components/ui/seite';

const STAGES: { key: FlowStepKey; label: string }[] = [
    { key: 'ocr', label: 'Fahrzeugschein (OCR)' },
    { key: 'oem', label: 'OEM-Auflösung' },
    { key: 'price', label: 'Preis / Angebot' },
    { key: 'quote', label: 'Angebots-PDF' },
    { key: 'order', label: 'Bestellung' },
    { key: 'invoice', label: 'Rechnung' },
];

type DisplayStatus = 'pending' | 'running' | 'ok' | 'fail' | 'skipped';

function StageIcon({ status }: { status: DisplayStatus }): JSX.Element {
    switch (status) {
        case 'ok':
            return <CheckCircle2 className="size-5 text-status-success" />;
        case 'fail':
            return <XCircle className="size-5 text-status-danger" />;
        case 'skipped':
            return <MinusCircle className="size-5 text-text-muted" />;
        case 'running':
            return <Loader2 className="size-5 animate-spin text-accent-500" />;
        default:
            return <Circle className="size-5 text-text-muted/50" />;
    }
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

function StageArtifact({ step }: { step: FlowStep }): JSX.Element | null {
    const a = step.artifact ?? {};
    if (step.key === 'oem' && Array.isArray(a.oemNumbers)) {
        const nums = a.oemNumbers as Array<{ number: string; confidence: number | null; brand: string | null }>;
        return (
            <div className="space-y-0.5">
                {nums.slice(0, 6).map((n, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono">
                            {n.number}
                            {n.brand ? <span className="text-text-muted"> ({n.brand})</span> : ''}
                        </span>
                        {n.confidence != null && (
                            <span className="tabular-nums text-text-muted">{Math.round(n.confidence * 100)}%</span>
                        )}
                    </div>
                ))}
            </div>
        );
    }
    if (step.key === 'quote' && a.quotePdf) {
        const pdf = a.quotePdf as { base64: string; filename: string };
        return (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => downloadPdf(pdf)}>
                <FileText className="size-3" /> {pdf.filename}
            </Button>
        );
    }
    if (step.key === 'order' && a.orderId) {
        return (
            <span className="font-mono text-xs">
                {String(a.orderId).slice(0, 8)}
                {a.status ? <span className="text-text-muted"> · {String(a.status)}</span> : ''}
            </span>
        );
    }
    if (step.key === 'ocr' && (a.brand || a.vin)) {
        return (
            <span className="text-xs text-text-muted">
                {[a.brand, a.vin].filter(Boolean).join(' · ')}
            </span>
        );
    }
    return null;
}

export default function E2EFlowRunnerView(): JSX.Element {
    const [merchantId, setMerchantId] = useState<string | null>(null);
    const [mode, setMode] = useState<'scenario' | 'text'>('scenario');
    const [scenarioId, setScenarioId] = useState<string>('happy-full');
    const [text, setText] = useState('');
    const [imageBase64, setImageBase64] = useState<string | null>(null);

    const scenariosQ = useRunnerScenarios();
    const runMut = useRunE2EFlow();
    const result: E2EFlowResult | undefined = runMut.data;

    const stepByKey = useMemo(() => {
        const m = new Map<string, FlowStep>();
        (result?.steps ?? []).forEach((s) => m.set(s.key, s));
        return m;
    }, [result]);

    function displayStatus(key: string): DisplayStatus {
        if (result) return (stepByKey.get(key)?.status ?? 'skipped') as DisplayStatus;
        if (runMut.isPending) return 'running';
        return 'pending';
    }

    const canRun =
        !runMut.isPending && (mode === 'scenario' ? Boolean(scenarioId) : text.trim().length > 0 || Boolean(imageBase64));

    function run(): void {
        runMut.mutate(
            {
                ...(merchantId ? { merchantId } : {}),
                ...(mode === 'scenario' ? { scenarioId } : {}),
                ...(mode === 'text' && text.trim() ? { text: text.trim() } : {}),
                ...(imageBase64 ? { imageBase64 } : {}),
            },
            {
                onError: (err) => toast.error(err instanceof Error ? err.message : 'Lauf fehlgeschlagen.'),
            },
        );
    }

    async function onImage(file: File | undefined): Promise<void> {
        if (!file) return;
        try {
            setImageBase64(await fileToBase64(file));
            toast.success('Bild angefügt.');
        } catch {
            toast.error('Bild konnte nicht gelesen werden.');
        }
    }

    return (
        <div className={cn(SEITEN_RAND_OHNE_BREITE, 'mx-auto max-w-4xl')}>
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">E2E-Flow-Runner</h1>
                <p className="text-sm text-text-secondary">
                    Ein scriptbarer Durchlauf über die echte Bot-Pipeline — Stufen sichtbar, ehrlich
                    abgegrenzt.
                </p>
            </header>

            <section className="mb-6 space-y-4 rounded-md border border-border bg-surface/40 p-4">
                <div className="space-y-2">
                    <Label>Als Händler</Label>
                    <TenantSelect value={merchantId} onChange={setMerchantId} placeholder="Händler wählen (sonst Default)…" />
                </div>

                <div className="flex gap-2 text-xs">
                    <button
                        type="button"
                        onClick={() => setMode('scenario')}
                        className={`rounded px-2 py-1 ${mode === 'scenario' ? 'bg-accent-500 text-white' : 'border border-border text-text-secondary'}`}
                    >
                        Szenario
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('text')}
                        className={`rounded px-2 py-1 ${mode === 'text' ? 'bg-accent-500 text-white' : 'border border-border text-text-secondary'}`}
                    >
                        Freitext / Schein
                    </button>
                </div>

                {mode === 'scenario' ? (
                    <div className="space-y-2">
                        <Label>Szenario</Label>
                        <Select value={scenarioId} onValueChange={setScenarioId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Szenario wählen…" />
                            </SelectTrigger>
                            <SelectContent>
                                {(scenariosQ.data ?? []).map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.name} ({s.turns} Turns)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-text-muted">
                            Mehr-Turn-Szenarien können 30–60 s laufen (echte OEM-/Vision-Calls).
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor="ee-text">Nachricht (optional + Schein-Bild)</Label>
                        <Textarea
                            id="ee-text"
                            rows={3}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="z.B. 'Bremsbeläge vorne für VW Golf 2019'"
                        />
                        <div className="flex items-center gap-2">
                            <input type="file" accept="image/*" className="text-xs" onChange={(e) => void onImage(e.target.files?.[0])} />
                            {imageBase64 && (
                                <span className="flex items-center gap-1 text-xs text-success">
                                    <Paperclip className="size-3" /> angefügt
                                </span>
                            )}
                        </div>
                    </div>
                )}

                <Button onClick={run} disabled={!canRun}>
                    {runMut.isPending ? 'Lauf läuft…' : 'Lauf starten'}
                </Button>
            </section>

            {runMut.error && <ErrorState message={(runMut.error as Error).message} className="mb-4" />}

            {/* Stufen-Pipeline */}
            <ol className="space-y-2">
                {STAGES.map((stage) => {
                    const status = displayStatus(stage.key);
                    const step = stepByKey.get(stage.key);
                    return (
                        <li key={stage.key} className="rounded-md border border-border bg-surface/40 p-3">
                            <div className="flex items-center gap-3">
                                <StageIcon status={status} />
                                <span className="flex-1 text-sm font-medium">{stage.label}</span>
                                {step && step.durationMs > 0 && (
                                    <span className="text-xs font-mono text-text-muted">{step.durationMs}ms</span>
                                )}
                                <span
                                    className={`text-xs font-mono uppercase tracking-widest ${
                                        status === 'ok'
                                            ? 'text-status-success'
                                            : status === 'fail'
                                              ? 'text-status-danger'
                                              : 'text-text-muted'
                                    }`}
                                >
                                    {status}
                                </span>
                            </div>
                            {step && (step.reason || step.error) && (
                                <p
                                    className={`mt-1.5 pl-8 text-xs ${
                                        step.error ? 'text-status-danger' : 'text-text-muted'
                                    }`}
                                >
                                    {step.error || step.reason}
                                </p>
                            )}
                            {step && (
                                <div className="mt-1.5 pl-8">
                                    <StageArtifact step={step} />
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>

            {result?.orderId && merchantId && (
                <div className="mt-4 text-xs">
                    <Link
                        to={`/tenants/${merchantId}`}
                        className="inline-flex items-center gap-1 text-accent-500 hover:underline"
                    >
                        Erzeugte Order beim Händler ansehen <ExternalLink className="size-3" />
                    </Link>
                </div>
            )}
        </div>
    );
}
