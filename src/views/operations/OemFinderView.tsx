/**
 * OEM-Finder — Admin-Tool zum Testen der Fahrzeug→Teil→OE-Findung.
 *  • Suche: Fahrzeugschein hochladen ODER Fahrzeug/HSN-TSN tippen + Teil → OEM-Nummer.
 *  • Verlauf: viele Abfragen nacheinander, jede als ✓ richtig / ✗ falsch markierbar (localStorage).
 *  • Rücksuche: OE-Nummer → Teil-Typ, Marken, äquivalente Nummern, Bild, Kriterien.
 */
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { SEITEN_RAND, SeitenKopf } from '@/components/ui/seite';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, BadgeCheck, Search, Upload, RotateCcw, Check, X, Loader2, Car, Package } from 'lucide-react';
import { oemFind, oemReverse, scanFahrzeugschein, type OemFindResult, type OemReverseResult, type OemVehicleInput } from '@/api/oemFinder';
import { cn } from '@/lib/utils';

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

/**
 * Zwei-Wege-Umschalter im Rahmen — so zeichnet ihn der Entwurf: eine
 * durchscheinende Wanne mit 4 px Polster, darin die aktive Seite als gefüllte
 * Fläche.
 *
 * Der Verlauf läuft von accent-600 nach 700 statt von 500 aus: Weiss auf
 * accent-500 ergibt nur 3,16 Kontrast.
 */
function Umschalter({
    modus,
    onWechsel,
}: {
    modus: 'find' | 'reverse';
    onWechsel: (m: 'find' | 'reverse') => void;
}): JSX.Element {
    const seiten = [
        { wert: 'find' as const, label: 'Suche' },
        { wert: 'reverse' as const, label: 'Rücksuche' },
    ];
    return (
        <div
            role="tablist"
            aria-label="Suchrichtung"
            className="inline-flex gap-[3px] rounded-[11px] border border-overlay/[0.08] bg-overlay/[0.045] p-1"
        >
            {seiten.map((s) => (
                <button
                    key={s.wert}
                    type="button"
                    role="tab"
                    aria-selected={modus === s.wert}
                    onClick={() => onWechsel(s.wert)}
                    className={cn(
                        'rounded-lg px-5 py-2.5 text-[12px] transition-colors',
                        modus === s.wert
                            ? 'bg-gradient-to-br from-accent-600 to-accent-700 font-bold text-white'
                            : 'font-semibold text-text-tertiary hover:text-text-primary',
                    )}
                >
                    {s.label}
                </button>
            ))}
        </div>
    );
}

/**
 * Der Finder war vor der ersten Suche unterhalb des Formulars vollständig
 * leer. Die Route zeigt stattdessen, was mit den Eingaben als Nächstes
 * passiert und ob VIN und Teil bereits startklar sind. Sie verschwindet,
 * sobald ein echtes Ergebnis vorliegt.
 */
function Suchroute({ vin, teil }: { vin?: string; teil?: string }): JSX.Element {
    const normalisierteVin = (vin || '').toUpperCase().replace(/[\s-]+/g, '');
    const vinBereit = /^[A-HJ-NPR-Z0-9]{17}$/.test(normalisierteVin);
    const teilBereit = Boolean(teil?.trim());
    const schritte = [
        {
            label: 'VIN-Fahrzeug',
            detail: vinBereit ? '17-stellige VIN erkannt' : 'VIN aus Feld E ergänzen',
            icon: Car,
            bereit: vinBereit,
        },
        {
            label: 'Teil verstehen',
            detail: teilBereit ? 'Werkstattbegriff erfasst' : 'Teilbezeichnung ergänzen',
            icon: Package,
            bereit: teilBereit,
        },
        {
            label: 'OE verifizieren',
            detail: vinBereit ? 'YQ-Testpfad ist startklar' : 'Wartet auf gültige VIN',
            icon: BadgeCheck,
            bereit: false,
        },
    ];

    return (
        <div className="relative overflow-hidden rounded-[18px] border border-accent-500/15 bg-[linear-gradient(135deg,hsl(var(--accent-500)/0.08),hsl(var(--bg-surface)),hsl(var(--bg-surface)))] p-5">
            <span
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-accent-500/[0.08] blur-3xl"
            />
            <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent-500">
                        Suchroute
                    </div>
                    <p className="mt-1 text-[13px] text-text-secondary">
                        Vom Fahrzeugschein bis zur belegten OE-Position – ohne geratenen Treffer.
                    </p>
                </div>
                <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase',
                    vinBereit
                        ? 'border-success/25 bg-success/[0.08] text-success'
                        : 'border-overlay/10 bg-overlay/[0.04] text-text-muted',
                )}>
                    <span className={cn('size-1.5 rounded-full', vinBereit ? 'bg-success' : 'bg-text-muted')} />
                    {vinBereit ? 'Bereit' : 'VIN fehlt'}
                </span>
            </div>

            <div className="relative grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
                {schritte.map((schritt, index) => (
                    <div key={schritt.label} className="contents">
                        <div className={cn(
                            'flex min-w-0 items-center gap-3 rounded-xl border px-3.5 py-3',
                            schritt.bereit
                                ? 'border-success/20 bg-success/[0.055]'
                                : 'border-overlay/[0.07] bg-canvas/45',
                        )}>
                            <span className={cn(
                                'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
                                schritt.bereit
                                    ? 'bg-success/[0.13] text-success'
                                    : 'bg-overlay/[0.055] text-text-muted',
                            )}>
                                <schritt.icon className="size-[17px]" aria-hidden />
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-[12.5px] font-semibold text-text-primary">
                                    {index + 1}. {schritt.label}
                                </span>
                                <span className="block truncate text-[11px] text-text-muted">{schritt.detail}</span>
                            </span>
                        </div>
                        {index < schritte.length - 1 && (
                            <ArrowRight className="mx-1 hidden size-4 text-text-faint md:block" aria-hidden />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function OemFinderView(): JSX.Element {
    const [mode, setMode] = useState<'find' | 'reverse'>('find');
    const [form, setForm] = useState<OemVehicleInput>({});
    const [finding, setFinding] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanSummary, setScanSummary] = useState<string | null>(null);
    const [result, setResult] = useState<OemFindResult | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
    const [revNum, setRevNum] = useState('');
    const [revLoading, setRevLoading] = useState(false);
    const [rev, setRev] = useState<OemReverseResult | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

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

    const onFind = useCallback(async () => {
        const normalizedVin = (form.vin || '').toUpperCase().replace(/[\s-]+/g, '');
        if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalizedVin)) {
            toast.error('Für den YQ-Test wird die gültige 17-stellige VIN aus Feld E benötigt');
            return;
        }
        setFinding(true); setResult(null);
        try {
            const r = await oemFind({ ...form, vin: normalizedVin });
            setResult(r);
            const queryLabel = [form.make, form.model, `VIN …${normalizedVin.slice(-6)}`, form.part].filter(Boolean).join(' · ');
            persist([{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts: Date.now(), query: queryLabel, oem: r.oem ?? null, partType: r.partType, vehicle: r.vehicle, source: r.source, flag: null, result: r }, ...history]);
            if (!r.resolved) toast.warning(r.reason || `Nicht gefunden (${r.unresolved || r.stage})`);
        } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler bei der Suche'); }
        finally { setFinding(false); }
    }, [form, history, persist]);

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
        <div className={cn(SEITEN_RAND)}>
            <SeitenKopf
                className="mb-6"
                titel="OEM-Finder"
                beileile={
                    <span className="block max-w-[78ch] text-pretty leading-[1.6]">
                        Fahrzeugschein → vorhandene OCR → VIN-Fahrzeug in YQ → native OE-Nummer.
                        Mit transparentem Testverlauf statt geratenem Treffer.
                    </span>
                }
                aktionen={<Umschalter modus={mode} onWechsel={setMode} />}
            />

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

                        {result
                            ? <FindResult r={result} />
                            : <Suchroute vin={form.vin} teil={form.part} />}
                    </section>

                    {/* ── Verlauf ── */}
                    <aside className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-text-primary">Verlauf ({stats.total})</span>
                            <span className="text-xs text-text-muted">✓ {stats.ok} · ✗ {stats.bad}</span>
                        </div>
                        {history.length === 0 && (
                            <div className="rounded-[16px] border border-dashed border-overlay/10 bg-overlay/[0.025] px-5 py-8 text-center">
                                <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-accent-500/[0.10] text-accent-500">
                                    <RotateCcw className="size-[18px]" aria-hidden />
                                </span>
                                <p className="mt-3 text-[12.5px] font-semibold text-text-secondary">Noch keine Abfragen</p>
                                <p className="mx-auto mt-1 max-w-[24ch] text-[11px] leading-relaxed text-text-muted">
                                    Treffer erscheinen hier und können direkt als richtig oder falsch markiert werden.
                                </p>
                            </div>
                        )}
                        <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                            {history.map((h) => (
                                <div key={h.id} className={`border rounded-md p-2.5 text-sm ${h.flag === 'ok' ? 'border-success/40 bg-success/5' : h.flag === 'bad' ? 'border-status-danger/40 bg-status-danger/5' : 'border-border bg-surface'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <button onClick={() => reuse(h)} className="text-left flex-1 min-w-0">
                                            <div className="font-mono text-accent-500 truncate">
                                                {h.oem
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

function FindResult({ r }: { r: OemFindResult }): JSX.Element {
    if (!r.resolved) {
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
            </div>
        );
    }
    return (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            <ResolutionTrace r={r} />
            <div className="flex items-start gap-4">
                {r.image && <img src={r.image} alt="" className="size-20 object-contain rounded-md border border-border bg-elevated shrink-0" />}
                <div className="min-w-0">
                    {r.oem
                        ? <div className="font-mono text-xl font-semibold text-accent-500 break-all">{r.oem}</div>
                        : r.alternatives
                            ? <div className="text-sm font-medium text-success">{r.fitmentVariants?.length ?? 0} von YQ ausdrücklich freigegebene OE-Alternativen</div>
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
                    <div className="text-xs text-text-secondary">{r.vehicle} {r.source === 'yq-ws-oem-v2' && <span className="ml-1 text-success">· via VIN in YQ</span>}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">{[r.catalog ? `Katalog ${r.catalog}` : null, r.provider, typeof r.elapsedMs === 'number' ? `${r.elapsedMs} ms` : null].filter(Boolean).join(' · ')}</div>
                    {r.oem && !r.ambiguous && r.partType && (
                        <div className="text-xs text-success mt-0.5">
                            Eindeutig: YQ markiert diese Position als zur VIN passend
                            {r.position?.verified ? ' und der angefragte Einbauort ist belegt.' : '.'}
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
