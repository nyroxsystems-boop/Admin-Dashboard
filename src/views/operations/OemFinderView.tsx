/**
 * OEM-Finder — Admin-Tool zum Testen der Fahrzeug→Teil→OE-Findung.
 *  • Suche: Fahrzeugschein hochladen ODER Fahrzeug/HSN-TSN tippen + Teil → OEM-Nummer.
 *  • Verlauf: viele Abfragen nacheinander, jede als ✓ richtig / ✗ falsch markierbar (localStorage).
 *  • Rücksuche: OE-Nummer → Teil-Typ, Marken, äquivalente Nummern, Bild, Kriterien.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Search,
    Upload,
    RotateCcw,
    Check,
    X,
    Loader2,
    Car,
    Package,
    BrainCircuit,
    Database,
    ShieldCheck,
    AlertTriangle,
} from 'lucide-react';
import {
    getOemSystemInfo,
    oemFind,
    oemReverse,
    previewOemCatalogIntent,
    scanFahrzeugschein,
    type OemCatalogPreview,
    type OemFindResult,
    type OemReverseResult,
    type OemSystemInfo,
    type OemVehicleInput,
    type YqCatalogIntelligence,
} from '@/api/oemFinder';

interface HistoryEntry {
    id: string;
    ts: number;
    query: string;
    oem: string | null;
    partType?: string;
    vehicle?: string;
    source?: string;
    flag?: 'ok' | 'bad' | null;
    result: OemFindResult;
}

/** Skaliert ein Bild im Browser auf maxSide px herunter und gibt ein JPEG-DataURL zurück. */
async function downscaleToDataUrl(file: File, maxSide: number, quality: number): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || '')); r.onerror = reject; r.readAsDataURL(file); });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = dataUrl; });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    if (scale >= 1 && file.size < 1_200_000) return dataUrl; // already small → keep as-is
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d'); if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
}

const HKEY = 'oemFinder.history.v1';
const FIELDS: Array<{ k: keyof OemVehicleInput; label: string; ph: string; w?: string }> = [
    { k: 'vin', label: 'VIN / FIN (Feld E) — YQ-Schlüssel', ph: 'WBAAT51010FW14413', w: 'w-full' },
    { k: 'hsn', label: 'HSN (2.1)', ph: '0603', w: 'w-24' },
    { k: 'tsn', label: 'TSN (2.2)', ph: 'BLI', w: 'w-28' },
    { k: 'make', label: 'Marke (D.1)', ph: 'VW' },
    { k: 'model', label: 'Modell (D.3)', ph: 'Golf VII' },
    { k: 'year', label: 'Baujahr (B)', ph: '2015', w: 'w-24' },
    { k: 'engine', label: 'Motor', ph: '2.0 TDI' },
    { k: 'engineKw', label: 'kW (P.2)', ph: '110', w: 'w-24' },
    { k: 'fuelType', label: 'Kraftstoff (P.3)', ph: 'Diesel' },
];

function loadHistory(): HistoryEntry[] {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(HKEY) || '[]');
        if (!Array.isArray(value)) return [];
        return value
            .filter((entry): entry is HistoryEntry => {
                if (!entry || typeof entry !== 'object') return false;
                const candidate = entry as Partial<HistoryEntry>;
                return (
                    typeof candidate.id === 'string' &&
                    typeof candidate.ts === 'number' &&
                    typeof candidate.query === 'string' &&
                    (candidate.oem === null || typeof candidate.oem === 'string') &&
                    Boolean(candidate.result && typeof candidate.result === 'object')
                );
            })
            .slice(0, 100);
    } catch {
        return [];
    }
}

export default function OemFinderView(): JSX.Element {
    const [mode, setMode] = useState<'find' | 'reverse'>('find');
    const [form, setForm] = useState<OemVehicleInput>({});
    const [finding, setFinding] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanSummary, setScanSummary] = useState<string | null>(null);
    const [result, setResult] = useState<OemFindResult | null>(null);
    const [catalogPreview, setCatalogPreview] = useState<OemCatalogPreview | null>(null);
    const [systemInfo, setSystemInfo] = useState<OemSystemInfo | null>(null);
    const [systemInfoFailed, setSystemInfoFailed] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
    const [revNum, setRevNum] = useState('');
    const [revLoading, setRevLoading] = useState(false);
    const [rev, setRev] = useState<OemReverseResult | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let active = true;
        void getOemSystemInfo()
            .then((info) => {
                if (active) setSystemInfo(info);
            })
            .catch(() => {
                if (active) setSystemInfoFailed(true);
            });
        return () => {
            active = false;
        };
    }, []);

    const persist = useCallback((h: HistoryEntry[]) => { setHistory(h); try { localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 100))); } catch { /* ignore */ } }, []);

    const set = (k: keyof OemVehicleInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const onScan = useCallback(async (file?: File) => {
        if (!file) return;
        if (file.size > 25_000_000) { toast.error('Bild zu groß (max 25 MB)'); return; }
        setScanning(true);
        try {
            // Handy-Fotos sind oft 3–10 MB → vor dem Upload herunterskalieren (max 1600px, JPEG),
            // sonst läuft der Vision-Call in den Timeout. Fällt bei Bedarf auf das Original zurück.
            const b64 = await downscaleToDataUrl(file, 1600, 0.82).catch(() => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || '')); r.onerror = reject; r.readAsDataURL(file); }));
            const scan = await scanFahrzeugschein(b64);
            const v = scan.vehicle || ({} as ScheinScanResultVehicle);
            setForm((f) => ({
                ...f,
                vin: v.vin || f.vin,
                hsn: v.hsn || f.hsn, tsn: v.tsn || f.tsn, make: v.make || f.make, model: v.model || f.model,
                year: v.year ? String(v.year) : f.year, engineKw: v.kw ? String(v.kw) : f.engineKw,
                engine: v.motorcode || f.engine,
            }));
            const recognized = [v.make, v.model].filter(Boolean).join(' ');
            const vinSuffix = v.vin ? `VIN …${v.vin.slice(-6)}` : 'keine VIN erkannt';
            setScanSummary([recognized, vinSuffix, scan.elapsed].filter(Boolean).join(' · '));
            toast.success(v.vin ? 'Fahrzeugschein und VIN erkannt' : 'Schein erkannt, VIN bitte prüfen');
        } catch { toast.error('Schein-Erkennung fehlgeschlagen'); }
        finally { setScanning(false); }
    }, []);

    const runFind = useCallback(async (input: OemVehicleInput) => {
        const normalizedVin = (input.vin || '').toUpperCase().replace(/[\s-]+/g, '');
        if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalizedVin)) {
            toast.error('Für den YQ-Test wird die gültige 17-stellige VIN aus Feld E benötigt');
            return;
        }
        setFinding(true);
        setResult(null);
        try {
            let lookupInput = { ...input, vin: normalizedVin };
            const part = String(input.part || '').trim();
            if (part) {
                const preview = await previewOemCatalogIntent({
                    part,
                    brand: input.make,
                });
                setCatalogPreview(preview);
                if (preview.action !== 'ready') {
                    if (preview.action === 'clarify-part') {
                        toast.warning('Teilbegriff muss vor der OE-Suche bestätigt werden');
                    } else if (preview.action === 'clarify-position') {
                        toast.warning('Einbauposition fehlt – OE-Suche bleibt gesperrt');
                    } else {
                        toast.error('Teilbegriff ist noch nicht sicher auflösbar');
                    }
                    return;
                }
                lookupInput = {
                    ...lookupInput,
                    part: preview.canonicalQuery || part,
                };
            } else {
                setCatalogPreview(null);
            }

            const r = await oemFind(lookupInput);
            setResult(r);
            const queryLabel = [
                input.make,
                input.model,
                `VIN …${normalizedVin.slice(-6)}`,
                lookupInput.part,
            ].filter(Boolean).join(' · ');
            persist([{
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                ts: Date.now(),
                query: queryLabel,
                oem: r.evidence?.releaseSafe === true ? r.oem ?? null : null,
                partType: r.partType,
                vehicle: r.vehicle,
                source: r.source,
                flag: null,
                result: r,
            }, ...history]);
            if (!r.resolved) toast.warning(r.reason || `Nicht gefunden (${r.unresolved || r.stage})`);
            else if (r.oem && r.evidence?.releaseSafe !== true) {
                toast.warning('YQ-Kandidat gefunden – noch nicht freigabefähig');
            }
        } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler bei der Suche'); }
        finally { setFinding(false); }
    }, [history, persist]);

    const onFind = useCallback(() => {
        void runFind(form);
    }, [form, runFind]);

    const confirmCatalogOption = useCallback((canonicalQuery: string) => {
        const nextForm = { ...form, part: canonicalQuery };
        setForm(nextForm);
        void runFind(nextForm);
    }, [form, runFind]);

    const onReverse = useCallback(async () => {
        if (!revNum.trim()) return;
        setRevLoading(true); setRev(null);
        try { setRev(await oemReverse(revNum.trim())); }
        catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler bei der Rücksuche'); }
        finally { setRevLoading(false); }
    }, [revNum]);

    const flagEntry = (id: string, flag: 'ok' | 'bad') => persist(history.map((h) => h.id === id ? { ...h, flag: h.flag === flag ? null : flag } : h));
    const reuse = (h: HistoryEntry) => { setMode('find'); setRevNum(''); if (h.oem) { setMode('reverse'); setRevNum(h.oem); } };

    const stats = { total: history.length, ok: history.filter((h) => h.flag === 'ok').length, bad: history.filter((h) => h.flag === 'bad').length };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-display font-semibold tracking-tight text-text-primary">OEM-Finder</h1>
                    <p className="text-sm text-text-secondary mt-1">Fahrzeugschein → vorhandene OCR → VIN-Fahrzeug in YQ → native OE-Nummer. Mit transparentem Testverlauf statt geratenem Treffer.</p>
                </div>
                <div className="inline-flex rounded-lg border border-border overflow-hidden">
                    <button onClick={() => setMode('find')} className={`px-4 py-2 text-sm font-medium ${mode === 'find' ? 'bg-accent-500 text-white' : 'bg-surface text-text-secondary hover:bg-elevated'}`}>Suche</button>
                    <button onClick={() => setMode('reverse')} className={`px-4 py-2 text-sm font-medium ${mode === 'reverse' ? 'bg-accent-500 text-white' : 'bg-surface text-text-secondary hover:bg-elevated'}`}>Rücksuche</button>
                </div>
            </header>

            <CatalogRuntimeStatus info={systemInfo} failed={systemInfoFailed} />

            {mode === 'find' ? (
                <div className="grid lg:grid-cols-[1fr_380px] gap-6">
                    {/* ── Eingabe + Ergebnis ── */}
                    <section className="space-y-4">
                        <div className="bg-surface border border-border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-text-primary flex items-center gap-2"><Car className="size-4" /> Fahrzeug</span>
                                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={scanning}>
                                    {scanning ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Fahrzeugschein
                                </Button>
                                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onScan(e.currentTarget.files?.[0])} />
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {FIELDS.map((f) => (
                                    <div key={f.k} className={f.w || 'flex-1 min-w-[140px]'}>
                                        <Label className="text-xs text-text-muted">{f.label}</Label>
                                        <Input value={(form[f.k] as string) || ''} placeholder={f.ph} onChange={(e) => set(f.k, e.target.value)} className="font-mono text-sm" />
                                    </div>
                                ))}
                            </div>
                            {scanSummary && (
                                <div className="mt-3 flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
                                    <Check className="size-3.5 shrink-0" /> OCR abgeschlossen · {scanSummary}
                                </div>
                            )}
                            <div className="mt-3 flex items-end gap-3">
                                <div className="flex-1">
                                    <Label className="text-xs text-text-muted flex items-center gap-1"><Package className="size-3" /> Teil</Label>
                                    <Input value={form.part || ''} placeholder="Ölfilter, Bremsscheibe, Querlenker Hinterachse …" onChange={(e) => set('part', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onFind()} />
                                </div>
                                <Button onClick={onFind} disabled={finding}>{finding ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} OE finden</Button>
                            </div>
                            <p className="text-xs text-text-muted mt-2">Die VIN ist der exakte YQ-Schlüssel. HSN/TSN und die OCR-Fahrzeugdaten bleiben zur Gegenprüfung sichtbar. Ohne Teil wird nur die VIN-Fahrzeugauflösung getestet.</p>
                        </div>

                        {catalogPreview && (
                            <CatalogPreviewPanel
                                preview={catalogPreview}
                                onConfirm={confirmCatalogOption}
                                disabled={finding}
                            />
                        )}
                        {result && <FindResult r={result} />}
                    </section>

                    {/* ── Verlauf ── */}
                    <aside className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-text-primary">Verlauf ({stats.total})</span>
                            <span className="text-xs text-text-muted">✓ {stats.ok} · ✗ {stats.bad}</span>
                        </div>
                        {history.length === 0 && <p className="text-xs text-text-muted">Noch keine Abfragen.</p>}
                        <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                            {history.map((h) => (
                                <div key={h.id} className={`border rounded-md p-2.5 text-sm ${h.flag === 'ok' ? 'border-success/40 bg-success/5' : h.flag === 'bad' ? 'border-status-danger/40 bg-status-danger/5' : 'border-border bg-surface'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <button onClick={() => reuse(h)} className="text-left flex-1 min-w-0">
                                            <div className="font-mono text-accent-500 truncate">
                                                {h.oem
                                                    || (h.result.oem && h.result.evidence?.releaseSafe !== true
                                                        ? `${h.result.oem} · Kandidat`
                                                        : null)
                                                    || (h.result.alternatives
                                                        ? h.result.oemCandidates?.map((candidate) => candidate.oem).join(' / ')
                                                        : h.result.ambiguous
                                                            ? `${h.result.fitmentVariants?.length || 0} Kandidaten`
                                                            : '—')}
                                            </div>
                                            <div className="text-xs text-text-secondary truncate">{h.query || '(ohne Teil)'}</div>
                                            <div className="text-[11px] text-text-muted truncate">{h.partType ? `${h.partType} · ` : ''}{h.vehicle || ''}</div>
                                        </button>
                                        <div className="flex flex-col gap-1 shrink-0">
                                            <button onClick={() => flagEntry(h.id, 'ok')} className={`p-1 rounded ${h.flag === 'ok' ? 'text-success' : 'text-text-muted hover:text-success'}`} title="richtig"><Check className="size-4" /></button>
                                            <button onClick={() => flagEntry(h.id, 'bad')} className={`p-1 rounded ${h.flag === 'bad' ? 'text-status-danger' : 'text-text-muted hover:text-status-danger'}`} title="falsch"><X className="size-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {history.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => persist([])} className="text-text-muted"><RotateCcw className="size-3" /> Verlauf leeren</Button>
                        )}
                    </aside>
                </div>
            ) : (
                /* ── Rücksuche ── */
                <section className="max-w-3xl space-y-4">
                    <div className="bg-surface border border-border rounded-lg p-4">
                        <Label className="text-xs text-text-muted">OE-/Teilenummer</Label>
                        <div className="flex gap-3 mt-1">
                            <Input value={revNum} placeholder="z. B. 03N115562 oder 11427787697" onChange={(e) => setRevNum(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onReverse()} className="font-mono" />
                            <Button onClick={onReverse} disabled={revLoading}>{revLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Rücksuche</Button>
                        </div>
                    </div>
                    {rev && <ReverseResult r={rev} />}
                </section>
            )}
        </div>
    );
}

function CatalogRuntimeStatus({
    info,
    failed,
}: {
    info: OemSystemInfo | null;
    failed: boolean;
}): JSX.Element {
    if (!info) {
        return (
            <div className={`mb-5 rounded-lg border px-4 py-3 text-xs ${failed ? 'border-status-danger/30 bg-status-danger/5 text-status-danger' : 'border-border bg-surface text-text-muted'}`}>
                {failed
                    ? 'YQ-Katalogstatus konnte nicht geladen werden.'
                    : <span className="inline-flex items-center gap-2"><Loader2 className="size-3.5 animate-spin" /> YQ-Katalogstatus wird geladen …</span>}
            </div>
        );
    }

    const corpus = info.universalYqCorpus;
    const ai = info.catalogAi;
    const cards = [
        {
            icon: Database,
            title: 'Universal YQ',
            value: corpus.loaded
                ? `${corpus.brands.length} Marken · ${corpus.metrics?.partNames ?? 0} Bezeichnungen`
                : 'Korpus nicht geladen',
            ok: corpus.loaded,
        },
        {
            icon: BrainCircuit,
            title: 'Katalog-KI',
            value: ai.operational
                ? `aktiv · ${ai.timeoutMs} ms Guard`
                : ai.enabled
                    ? 'aktiviert, lokale KI nicht erreichbar'
                    : 'deaktiviert',
            ok: ai.operational,
        },
        {
            icon: ShieldCheck,
            title: 'OE-Schutz',
            value: 'KI kann keine OE-Nummern erzeugen',
            ok: true,
        },
        {
            icon: Check,
            title: 'Suchreihenfolge',
            value: 'Universal primär · O.E. sekundär',
            ok: info.features.universalYqPrimary === true && info.features.oeTreeSecondary === true,
        },
    ];

    return (
        <section className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="YQ-Katalogstatus">
            {cards.map(({ icon: Icon, title, value, ok }) => (
                <div key={title} className={`rounded-lg border px-3 py-2.5 ${ok ? 'border-success/25 bg-success/5' : 'border-status-warning/30 bg-status-warning/5'}`}>
                    <div className="flex items-center gap-2 text-xs font-medium text-text-primary">
                        <Icon className={`size-3.5 ${ok ? 'text-success' : 'text-status-warning'}`} />
                        {title}
                    </div>
                    <div className="mt-1 text-[11px] leading-4 text-text-secondary">{value}</div>
                </div>
            ))}
        </section>
    );
}

function CatalogPreviewPanel({
    preview,
    onConfirm,
    disabled,
}: {
    preview: OemCatalogPreview;
    onConfirm: (canonicalQuery: string) => void;
    disabled: boolean;
}): JSX.Element {
    const ready = preview.action === 'ready';
    const title = ready
        ? `Teil sicher erkannt: ${preview.canonicalQuery}`
        : preview.action === 'clarify-part'
            ? 'Mechaniker-Slang erkannt – Bestätigung erforderlich'
            : preview.action === 'clarify-position'
                ? 'Einbauposition fehlt'
                : 'Teilbegriff nicht sicher auflösbar';
    const border = ready
        ? 'border-success/30 bg-success/5'
        : preview.action === 'unresolved'
            ? 'border-status-danger/30 bg-status-danger/5'
            : 'border-status-warning/30 bg-status-warning/5';
    const Icon = ready
        ? ShieldCheck
        : preview.action === 'unresolved'
            ? X
            : AlertTriangle;

    return (
        <section className={`rounded-lg border p-4 space-y-3 ${border}`}>
            <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 size-4 shrink-0 ${ready ? 'text-success' : preview.action === 'unresolved' ? 'text-status-danger' : 'text-status-warning'}`} />
                <div>
                    <div className="text-sm font-medium text-text-primary">{title}</div>
                    <div className="mt-0.5 text-xs text-text-secondary">
                        Familie: {preview.family || 'noch unbekannt'} · Gruppierung: {preview.grouping} · Marke: {preview.brand || 'nicht erkannt'}
                    </div>
                </div>
            </div>

            {preview.action === 'clarify-position' && (
                <div className="text-xs text-status-warning">
                    Bitte ergänzen: {preview.missingPosition.map((dimension) => dimension === 'axle' ? 'vorne oder hinten' : 'links oder rechts').join(' und ')}.
                    Die OE-Suche bleibt bis dahin gesperrt.
                </div>
            )}

            {preview.action === 'clarify-part' && (
                <div>
                    <div className="mb-2 text-xs text-text-secondary">
                        Die KI rät nicht. Wähle die gemeinte, im YQ-Korpus dieser Marke belegte Teilefamilie:
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {preview.confirmationOptions.map((option) => (
                            <button
                                key={`${option.family}-${option.canonicalQuery}`}
                                type="button"
                                disabled={disabled}
                                onClick={() => onConfirm(option.canonicalQuery)}
                                className="rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-accent-500/50 hover:bg-elevated disabled:opacity-50"
                            >
                                <div className="text-sm font-medium text-text-primary">{option.canonicalPart}</div>
                                <div className="mt-0.5 text-[11px] text-text-muted">
                                    {option.family} · {Math.round(option.confidence * 100)} % KI-Konfidenz
                                    {option.missingPosition.length
                                        ? ` · Position fehlt: ${option.missingPosition.join(', ')}`
                                        : ' · Position vollständig'}
                                </div>
                            </button>
                        ))}
                    </div>
                    {preview.groundedLabels.length > 0 && (
                        <div className="mt-2 text-[11px] text-text-muted">
                            YQ-Belege: {preview.groundedLabels.slice(0, 6).join(' · ')}
                        </div>
                    )}
                </div>
            )}

            {preview.action === 'unresolved' && (
                <div className="text-xs text-status-danger">
                    Keine freigabefähige Katalogzuordnung. Prüfe Korpusabdeckung und KI-Status; es wurde keine OE-Suche gestartet.
                </div>
            )}

            <details className="text-xs text-text-muted">
                <summary className="cursor-pointer select-none">Suchplan und Schutzregeln anzeigen</summary>
                <div className="mt-2 space-y-1.5 rounded-md border border-border bg-surface/70 p-2.5">
                    <div>Quellen: {preview.catalogPlan.sources.join(' · ') || '—'}</div>
                    <div>Suchbegriffe: {preview.catalogPlan.searchTerms.join(' · ') || '—'}</div>
                    {preview.catalogPlan.excludedConcepts.length > 0 && (
                        <div>Ausschlüsse: {preview.catalogPlan.excludedConcepts.join(' · ')}</div>
                    )}
                    <div>
                        OE-Freigabe: {preview.safeguards.oeLookupAllowed ? 'erlaubt' : 'gesperrt'}
                        {' · '}KI-OE-Erzeugung: ausgeschlossen
                    </div>
                </div>
            </details>
        </section>
    );
}

type ScheinScanResultVehicle = NonNullable<Awaited<ReturnType<typeof scanFahrzeugschein>>>['vehicle'];

function ResolutionTrace({ r }: { r: OemFindResult }): JSX.Element | null {
    if (!r.trace?.length) return null;
    const labels: Record<string, string> = {
        catalog: 'Katalog',
        vehicle: 'VIN-Fahrzeug',
        groups: 'Teilegruppe',
        position: 'Einbauort',
        oem: 'OE-Position',
    };
    return (
        <div className="rounded-md border border-border bg-elevated/50 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-text-muted mb-2">YQ-Testpfad</div>
            <div className="grid gap-2 sm:grid-cols-2">
                {r.trace.map((step, index) => (
                    <div key={`${step.stage}-${index}`} className="flex items-start gap-2 min-w-0">
                        <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${step.status === 'ok' ? 'bg-success/15 text-success' : 'bg-status-danger/15 text-status-danger'}`}>
                            {step.status === 'ok' ? <Check className="size-3" /> : <X className="size-3" />}
                        </span>
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase text-text-muted">{labels[step.stage] || step.stage}</div>
                            <div className="text-xs text-text-secondary break-words">{step.label}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ResolvedCatalogIntelligence({
    intelligence,
}: {
    intelligence: YqCatalogIntelligence;
}): JSX.Element {
    return (
        <details className="rounded-md border border-accent-500/20 bg-accent-500/5 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-accent-500">
                Aktive YQ-Katalogintelligenz · {intelligence.family || 'unbekannte Familie'}
            </summary>
            <div className="mt-2 grid gap-2 text-text-secondary sm:grid-cols-2">
                <div>
                    <div className="text-[10px] uppercase tracking-wide text-text-muted">Kanonische Anfrage</div>
                    <div>{intelligence.canonicalQuery}</div>
                </div>
                <div>
                    <div className="text-[10px] uppercase tracking-wide text-text-muted">Marke / Gruppierung / Konfidenz</div>
                    <div>{intelligence.brand} · {intelligence.grouping} · {intelligence.confidence}</div>
                </div>
                <div className="sm:col-span-2">
                    <div className="text-[10px] uppercase tracking-wide text-text-muted">Verwendete YQ-Begriffe</div>
                    <div className="break-words">{intelligence.searchTerms.join(' · ') || '—'}</div>
                </div>
                {intelligence.excludedConcepts.length > 0 && (
                    <div className="sm:col-span-2">
                        <div className="text-[10px] uppercase tracking-wide text-text-muted">Hart ausgeschlossene Nachbarteile</div>
                        <div className="break-words">{intelligence.excludedConcepts.join(' · ')}</div>
                    </div>
                )}
                <div className="sm:col-span-2 text-[11px] text-text-muted">
                    Quellen: {intelligence.sources.join(' · ')}
                </div>
            </div>
        </details>
    );
}

function FindResult({ r }: { r: OemFindResult }): JSX.Element {
    const releaseSafe = r.evidence?.releaseSafe === true;
    if (!r.resolved && !r.fitmentVariants?.length) {
        return (
            <div className="bg-surface border border-status-danger/30 rounded-lg p-4 space-y-3">
                <p className="text-sm text-status-danger font-medium">Keine OE-Nummer gefunden</p>
                <p className="text-xs text-text-secondary mt-1">{r.reason || `Stufe: ${r.stage} · unresolved: ${r.unresolved || '—'}`}{r.vehicle ? ` · Fahrzeug: ${r.vehicle}` : ''}</p>
                {r.partInterpretation && r.partInterpretation.method !== 'canonical' && (
                    <p className="text-xs text-accent-500">
                        Werkstattbegriff verstanden als: {r.partInterpretation.recognizedAs.join(', ')}
                        {r.partInterpretation.method === 'fuzzy' ? ' · Schreibweise tolerant korrigiert' : ''}
                    </p>
                )}
                <ResolutionTrace r={r} />
                {r.catalogIntelligence && (
                    <ResolvedCatalogIntelligence intelligence={r.catalogIntelligence} />
                )}
            </div>
        );
    }
    return (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            <ResolutionTrace r={r} />
            {r.catalogIntelligence && (
                <ResolvedCatalogIntelligence intelligence={r.catalogIntelligence} />
            )}
            <div className="flex items-start gap-4">
                {r.image && <img src={r.image} alt="" className="size-20 object-contain rounded-md border border-border bg-elevated shrink-0" />}
                <div className="min-w-0">
                    {r.oem
                        ? <div className={`font-mono text-xl font-semibold break-all ${releaseSafe ? 'text-success' : 'text-status-warning'}`}>{r.oem}</div>
                        : r.alternatives
                            ? <div className="text-sm font-medium text-status-warning">{r.fitmentVariants?.length ?? 0} YQ-Herstelleralternativen · manuell prüfen</div>
                            : r.ambiguous
                            ? <div className="text-sm font-medium text-status-warning">{r.fitmentVariants?.length ?? 0} von YQ markierte OE-Positionen — keine automatisch gewählt</div>
                            : <div className="text-sm text-text-muted">Fahrzeug aufgelöst (kein Teil angefragt)</div>}
                    <div className="text-sm text-text-primary">{r.partType}</div>
                    {r.partInterpretation && r.partInterpretation.method !== 'canonical' && (
                        <div className="mt-1 rounded-md border border-accent-500/20 bg-accent-500/5 px-2.5 py-1.5 text-xs text-accent-500">
                            Werkstattbegriff erkannt als: {r.partInterpretation.recognizedAs.join(', ')}
                            {r.partInterpretation.method === 'fuzzy' ? ' · Schreibweise tolerant korrigiert' : ''}
                        </div>
                    )}
                    <div className="text-xs text-text-secondary">
                        {r.vehicle}
                        {r.source === 'yq-ws-oem-v2' && (
                            <span className={`ml-1 ${releaseSafe ? 'text-success' : 'text-status-warning'}`}>
                                · {releaseSafe ? 'nativ in YQ bestätigt' : 'YQ-Kandidat'}
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">{[r.catalog ? `Katalog ${r.catalog}` : null, r.provider, typeof r.elapsedMs === 'number' ? `${r.elapsedMs} ms` : null].filter(Boolean).join(' · ')}</div>
                    {r.oem && !r.ambiguous && r.partType && releaseSafe && (
                        <div className="text-xs text-success mt-0.5">
                            Freigabefähig: YQ bestätigt Fahrzeug, Position und Anwendbarkeit
                            {r.position?.verified ? ' und der angefragte Einbauort ist belegt.' : '.'}
                        </div>
                    )}
                    {r.oem && !releaseSafe && (
                        <div className="text-xs text-status-warning mt-0.5">
                            Kandidat – noch nicht freigabefähig. Keine automatische Bestellung oder Angebotserzeugung.
                        </div>
                    )}
                    {r.oem && r.position?.evidence?.length ? (
                        <div className="text-[11px] text-text-muted mt-0.5">Beleg: {r.position.evidence.join(' · ')}</div>
                    ) : null}
                </div>
            </div>
            {(r.ambiguous || r.alternatives) && r.fitmentVariants && r.fitmentVariants.length > 0 && (
                <div>
                    <div className="text-xs text-text-muted mb-1.5">
                        {r.alternatives
                            ? 'YQ nennt diese Nummern ausdrücklich gegenseitig als verwendbare Alternativen; beide gehören zum VIN-spezifischen Ergebnis.'
                            : r.position && !r.position.verified
                                ? 'Der angefragte Einbauort ist in den gelieferten YQ-Daten nicht vollständig belegbar. Deshalb wird keine Einzelnummer freigegeben.'
                                : `Mehrere Positionen sind im VIN-spezifischen YQ-Ergebnis als passend markiert. Bitte anhand der YQ-Merkmale prüfen${r.discriminators?.length ? ` (${r.discriminators.map((d) => d.replace(/\s*\[[^\]]*\]\s*/g, '')).join(', ')})` : ''}; das Dashboard rät keine Einzelnummer.`}
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                        {r.fitmentVariants.map((v, i) => (
                            <div key={i} className="flex items-start gap-3 rounded-md border border-border bg-elevated px-3 py-2">
                                {v.image && <img src={v.image} alt="" className="size-10 object-contain rounded bg-surface shrink-0" />}
                                <div className="min-w-0">
                                    <div className="font-mono text-sm font-semibold text-accent-500 break-all">{v.oem}</div>
                                    <div className="text-xs text-text-secondary">{v.label || '—'} {v.matched && <span className="text-success">· YQ matched</span>}</div>
                                    {(v.axle || v.side) && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {v.axle && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-500/10 border border-accent-500/20 text-accent-500">
                                                {v.axle === 'front' ? 'Vorderachse' : v.axle === 'rear' ? 'Hinterachse' : 'beide Achsen'}
                                            </span>}
                                            {v.side && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-500/10 border border-accent-500/20 text-accent-500">
                                                {v.side === 'left' ? 'links' : v.side === 'right' ? 'rechts' : 'beide Seiten'}
                                            </span>}
                                        </div>
                                    )}
                                    {v.positionEvidence?.map((evidence) => (
                                        <div key={evidence} className="mt-1 text-[10px] text-text-muted">{evidence}</div>
                                    ))}
                                    {v.criteria && Object.keys(v.criteria).length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {Object.entries(v.criteria).map(([d, val]) => (
                                                <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                                                    <span className="text-text-secondary">{d.replace(/\s*\[[^\]]*\]\s*/g, '')}:</span> {val}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {r.oemCandidates && r.oemCandidates.length > 1 && !r.ambiguous && !r.alternatives && (
                <div>
                    <div className="text-xs text-text-muted mb-1">Weitere YQ OE-Positionen</div>
                    <div className="flex flex-wrap gap-1.5">
                        {r.oemCandidates.map((c, i) => <span key={i} className="text-xs font-mono px-2 py-0.5 rounded bg-elevated border border-border text-text-secondary">{c.oem} <span className="text-text-muted">{c.brand}</span></span>)}
                    </div>
                </div>
            )}
            {r.partTypeOptions && r.partTypeOptions.length > 1 && (
                <div className="text-xs text-text-muted">Andere passende Teiltypen: {r.partTypeOptions.slice(1).join(', ')}</div>
            )}
            {r.vehicleCandidates && r.vehicleCandidates.length > 1 && (
                <details className="text-xs text-text-muted"><summary className="cursor-pointer">{r.vehicleCandidates.length} Fahrzeugvarianten</summary>
                    <ul className="mt-1 space-y-0.5">{r.vehicleCandidates.map((v) => <li key={v.id}>{v.label}</li>)}</ul>
                </details>
            )}
        </div>
    );
}

function ReverseResult({ r }: { r: OemReverseResult }): JSX.Element {
    if (!r.found) return <div className="bg-surface border border-border rounded-lg p-4 text-sm text-text-secondary">Keine Treffer für <span className="font-mono">{r.number}</span>.</div>;
    return (
        <div className="space-y-3">
            <div className="text-sm text-text-secondary">{r.found} Artikel für <span className="font-mono text-accent-500">{r.number}</span></div>
            {r.partTypes.map((g, i) => (
                <div key={i} className="bg-surface border border-border rounded-lg p-4 space-y-2">
                    <div className="flex items-start gap-3">
                        {g.images[0] && <img src={g.images[0]} alt="" className="size-16 object-contain rounded-md border border-border bg-elevated shrink-0" />}
                        <div className="min-w-0">
                            <div className="text-sm font-medium text-text-primary">{g.type}</div>
                            <div className="text-xs text-text-secondary">Marken: {g.brands.join(', ')}</div>
                        </div>
                    </div>
                    {g.oemNumbers.length > 0 && (
                        <div>
                            <div className="text-xs text-text-muted mb-1">OE-Nummern (alle Marken)</div>
                            <div className="flex flex-wrap gap-1.5">{g.oemNumbers.map((o, j) => <span key={j} className="text-xs font-mono px-2 py-0.5 rounded bg-elevated border border-border text-text-secondary">{o}</span>)}</div>
                        </div>
                    )}
                    {g.examples[0]?.criteria?.length > 0 && (
                        <div className="text-xs text-text-muted">{g.examples[0].criteria.map((c) => `${c.description}: ${c.value}`).join(' · ')}</div>
                    )}
                </div>
            ))}
        </div>
    );
}
