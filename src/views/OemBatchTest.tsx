/**
 * Batch OEM Test — Import CSV, run pipeline row-by-row, export results
 * 
 * Used as the 'batch' mode tab inside OemLookupView.
 * Uses Admin-Dashboard API (resolveOemForward) and glass-card styling.
 */

import { useState, useCallback, useRef } from 'react';
import {
    Loader2, CheckCircle, XCircle, Clock, Zap, BarChart2,
    AlertTriangle, Sparkles, Play, Pause, Trash2, Download, Upload,
    FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import { resolveOemForward } from '../api/wws';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

interface BatchRow {
    id: string;
    make: string;
    model: string;
    year: string;
    motor: string;
    vin: string;
    part: string;
    oem: string | null;
    confidence: number | null;
    resolvedBy: string | null;
    elapsed: string | null;
    status: 'pending' | 'processing' | 'found' | 'not_found' | 'error';
    difficulty: 'easy' | 'medium' | 'hard' | 'exotic';
}

// ═══════════════════════════════════════════════════════════════════
// Pre-built Test Dataset — 30 rows, easy → exotic
// ═══════════════════════════════════════════════════════════════════

const PRESET_DATA: Omit<BatchRow, 'id' | 'oem' | 'confidence' | 'resolvedBy' | 'elapsed' | 'status'>[] = [
    // 🟢 EASY (10) — Common parts, popular cars
    { make: 'VW', model: 'Golf VII', year: '2017', motor: 'DFGA', vin: '', part: 'Bremsscheibe vorne', difficulty: 'easy' },
    { make: 'VW', model: 'Golf VII', year: '2016', motor: 'CRLB', vin: '', part: 'Ölfilter', difficulty: 'easy' },
    { make: 'BMW', model: '3er F30', year: '2016', motor: 'B47', vin: '', part: 'Bremsbelag vorne', difficulty: 'easy' },
    { make: 'BMW', model: '3er F30', year: '2017', motor: 'B47', vin: '', part: 'Luftfilter', difficulty: 'easy' },
    { make: 'MERCEDES', model: 'C-Klasse W205', year: '2016', motor: 'OM654', vin: '', part: 'Bremsscheibe hinten', difficulty: 'easy' },
    { make: 'AUDI', model: 'A4 B9', year: '2017', motor: 'DETA', vin: '', part: 'Ölfilter', difficulty: 'easy' },
    { make: 'OPEL', model: 'Astra K', year: '2017', motor: 'B14XFT', vin: '', part: 'Bremsbelag hinten', difficulty: 'easy' },
    { make: 'FORD', model: 'Focus IV', year: '2019', motor: 'M1DA', vin: '', part: 'Luftfilter', difficulty: 'easy' },
    { make: 'VW', model: 'Passat B8', year: '2017', motor: 'DFGA', vin: '', part: 'Bremsscheibe vorne', difficulty: 'easy' },
    { make: 'VW', model: 'Tiguan II', year: '2018', motor: 'DFGA', vin: '', part: 'Bremsbelag vorne', difficulty: 'easy' },

    // 🟡 MEDIUM (10) — Platform-specific, less common parts
    { make: 'BMW', model: '5er G30', year: '2018', motor: 'B57', vin: '', part: 'Turbolader', difficulty: 'medium' },
    { make: 'VW', model: 'Golf VII', year: '2015', motor: 'CHHB', vin: '', part: 'Kupplung', difficulty: 'medium' },
    { make: 'MERCEDES', model: 'E-Klasse W213', year: '2017', motor: 'OM654', vin: '', part: 'Stoßdämpfer vorne', difficulty: 'medium' },
    { make: 'AUDI', model: 'Q5 FY', year: '2018', motor: 'DTUA', vin: '', part: 'Querlenker vorne links', difficulty: 'medium' },
    { make: 'BMW', model: 'X3 G01', year: '2018', motor: 'B47', vin: '', part: 'Wasserpumpe', difficulty: 'medium' },
    { make: 'VW', model: 'Passat B8', year: '2016', motor: 'DFHA', vin: '', part: 'Lichtmaschine', difficulty: 'medium' },
    { make: 'OPEL', model: 'Insignia B', year: '2018', motor: 'B20DTH', vin: '', part: 'Klimakompressor', difficulty: 'medium' },
    { make: 'FORD', model: 'Kuga II', year: '2017', motor: 'T7CL', vin: '', part: 'Radlager vorne', difficulty: 'medium' },
    { make: 'MERCEDES', model: 'GLC X253', year: '2017', motor: 'OM654', vin: '', part: 'Thermostat', difficulty: 'medium' },
    { make: 'AUDI', model: 'A3 8V', year: '2016', motor: 'DFGA', vin: '', part: 'Spurstange', difficulty: 'medium' },

    // 🔴 HARD (5) — Niche parts, specific sub-assemblies
    { make: 'BMW', model: '3er F30', year: '2015', motor: 'N57', vin: '', part: 'Nockenwellensensor Einlass', difficulty: 'hard' },
    { make: 'VW', model: 'Golf VII', year: '2014', motor: 'CRLB', vin: '', part: 'AGR-Ventil', difficulty: 'hard' },
    { make: 'MERCEDES', model: 'C-Klasse W205', year: '2017', motor: 'M276', vin: '', part: 'Ansaugkrümmer', difficulty: 'hard' },
    { make: 'AUDI', model: 'A4 B9', year: '2016', motor: 'CVKB', vin: '', part: 'Steuerkettensatz', difficulty: 'hard' },
    { make: 'BMW', model: '5er G30', year: '2017', motor: 'B58', vin: '', part: 'Differentialsperre', difficulty: 'hard' },

    // 🟣 EXOTIC (5) — Rare models, unusual brands
    { make: 'PORSCHE', model: 'Macan 95B', year: '2019', motor: '', vin: '', part: 'Bremsscheibe vorne', difficulty: 'exotic' },
    { make: 'HYUNDAI', model: 'Tucson TL', year: '2017', motor: 'D4HA', vin: '', part: 'Turbolader', difficulty: 'exotic' },
    { make: 'TOYOTA', model: 'Corolla E210', year: '2019', motor: '2ZR-FXE', vin: '', part: 'Wasserpumpe', difficulty: 'exotic' },
    { make: 'RENAULT', model: 'Mégane IV', year: '2017', motor: 'K9K', vin: '', part: 'Klimakompressor', difficulty: 'exotic' },
    { make: 'TESLA', model: 'Model 3', year: '2019', motor: '', vin: '', part: 'Bremsbelag vorne', difficulty: 'exotic' },
];

function createId() {
    return `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

function presetToRow(preset: typeof PRESET_DATA[number]): BatchRow {
    return { ...preset, id: createId(), oem: null, confidence: null, resolvedBy: null, elapsed: null, status: 'pending' };
}

// ── CSV helpers ──
function parseCSV(text: string): string[][] {
    return text.split(/\r?\n/).filter(l => l.trim()).map(line => {
        const cells: string[] = []; let current = ''; let inQ = false;
        for (const ch of line) {
            if (ch === '"') inQ = !inQ;
            else if ((ch === ',' || ch === ';' || ch === '\t') && !inQ) { cells.push(current.trim()); current = ''; }
            else current += ch;
        }
        cells.push(current.trim()); return cells;
    });
}

function rowsToCSV(rows: BatchRow[]): string {
    const h = 'Marke;Modell;Baujahr;Motor;VIN;Teil;OEM;Confidence;Status';
    return [h, ...rows.map(r =>
        [r.make, r.model, r.year, r.motor, r.vin, r.part, r.oem || '', r.confidence != null ? `${Math.round(r.confidence * 100)}%` : '', r.status].join(';')
    )].join('\n');
}

function downloadCSV(content: string, filename: string) {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

// ── Difficulty Badge ──
function DifficultyBadge({ d }: { d: string }) {
    const cfg: Record<string, { cls: string; label: string }> = {
        easy: { cls: 'bg-success-light text-success', label: '🟢 Easy' },
        medium: { cls: 'bg-warn-light text-warn', label: '🟡 Medium' },
        hard: { cls: 'bg-danger-light text-danger', label: '🔴 Hard' },
        exotic: { cls: 'bg-primary/10 text-primary', label: '🟣 Exotic' },
    };
    const c = cfg[d] || cfg.easy;
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.cls}`}>{c.label}</span>;
}

// ── Status Cell ──
function StatusCell({ status }: { status: BatchRow['status'] }) {
    switch (status) {
        case 'pending': return <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="w-3 h-3" /> Wartend</span>;
        case 'processing': return <span className="flex items-center gap-1.5 text-xs text-primary font-medium"><Loader2 className="w-3 h-3 animate-spin" /> Analysiert…</span>;
        case 'found': return <span className="flex items-center gap-1.5 text-xs text-success font-medium"><CheckCircle className="w-3 h-3" /> Gefunden</span>;
        case 'not_found': return <span className="flex items-center gap-1.5 text-xs text-danger font-medium"><XCircle className="w-3 h-3" /> Nicht gefunden</span>;
        case 'error': return <span className="flex items-center gap-1.5 text-xs text-warn font-medium"><AlertTriangle className="w-3 h-3" /> Fehler</span>;
    }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function OemBatchTest() {
    const [rows, setRows] = useState<BatchRow[]>([]);
    const [running, setRunning] = useState(false);
    const [paused, setPaused] = useState(false);
    const pauseRef = useRef(false);
    const abortRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentIdx, setCurrentIdx] = useState(-1);

    const total = rows.length;
    const done = rows.filter(r => r.status === 'found' || r.status === 'not_found' || r.status === 'error').length;
    const found = rows.filter(r => r.status === 'found').length;
    const avgConf = rows.filter(r => r.confidence != null).reduce((s, r) => s + (r.confidence || 0), 0) / (rows.filter(r => r.confidence != null).length || 1);
    const avgTime = rows.filter(r => r.elapsed != null).reduce((s, r) => s + (parseInt(r.elapsed || '0') || 0), 0) / (rows.filter(r => r.elapsed != null).length || 1);

    const loadPreset = () => { setRows(PRESET_DATA.map(presetToRow)); setCurrentIdx(-1); toast.success('30 Test-Zeilen geladen (Easy → Exotic)'); };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const parsed = parseCSV(ev.target?.result as string);
            const hIdx = parsed.findIndex(row => row.some(c => /marke|make|brand/i.test(c)));
            const dataRows = hIdx >= 0 ? parsed.slice(hIdx + 1) : parsed.slice(1);
            const header = hIdx >= 0 ? parsed[hIdx].map(h => h.toLowerCase()) : [];
            const ci = {
                make: header.findIndex(h => /marke|make|brand/i.test(h)),
                model: header.findIndex(h => /modell|model/i.test(h)),
                year: header.findIndex(h => /baujahr|year|jahr/i.test(h)),
                motor: header.findIndex(h => /motor|engine/i.test(h)),
                vin: header.findIndex(h => /vin|fin/i.test(h)),
                part: header.findIndex(h => /teil|part/i.test(h)),
            };
            const get = (row: string[], key: keyof typeof ci, fb: number) => (row[ci[key] >= 0 ? ci[key] : fb] || '').trim();
            const imported = dataRows.filter(r => r.some(c => c.trim())).map(row => ({
                id: createId(), make: get(row, 'make', 0), model: get(row, 'model', 1), year: get(row, 'year', 2),
                motor: get(row, 'motor', 3), vin: get(row, 'vin', 4), part: get(row, 'part', 5),
                oem: null, confidence: null, resolvedBy: null, elapsed: null, status: 'pending' as const, difficulty: 'medium' as const,
            } as BatchRow));
            if (!imported.length) { toast.error('Keine gültigen Zeilen gefunden'); return; }
            setRows(imported); setCurrentIdx(-1); toast.success(`${imported.length} Zeilen importiert`);
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const downloadTemplate = () => { downloadCSV(rowsToCSV(PRESET_DATA.map(presetToRow)), 'oem_batch_test_vorlage.csv'); toast.success('Vorlage heruntergeladen'); };
    const exportResults = () => { downloadCSV(rowsToCSV(rows), `oem_ergebnis_${new Date().toISOString().slice(0, 16).replace(/[:-]/g, '')}.csv`); toast.success('Ergebnisse exportiert'); };

    const runBatch = useCallback(async () => {
        setRunning(true); setPaused(false); pauseRef.current = false; abortRef.current = false;

        for (let i = 0; i < rows.length; i++) {
            if (abortRef.current) break;
            if (rows[i].status === 'found' || rows[i].status === 'not_found') continue;
            while (pauseRef.current && !abortRef.current) await new Promise(r => setTimeout(r, 300));
            if (abortRef.current) break;

            setCurrentIdx(i);
            setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'processing' } : r));
            setTimeout(() => document.getElementById(`batch-row-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);

            const t0 = Date.now();
            try {
                const row = rows[i];
                const r = await resolveOemForward({
                    vehicle: { make: row.make || undefined, model: row.model || undefined, vin: row.vin || undefined, year: row.year || undefined, engine: row.motor || undefined },
                    part: row.part,
                });
                const elapsed = `${Date.now() - t0}ms`;
                setRows(prev => prev.map((rr, idx) => idx === i ? {
                    ...rr, oem: r.oem || null, confidence: r.confidence != null ? r.confidence / 100 : null,
                    resolvedBy: r.notes || null, elapsed, status: r.oem ? 'found' : 'not_found',
                } : rr));
            } catch (err: any) {
                setRows(prev => prev.map((rr, idx) => idx === i ? { ...rr, status: 'error', elapsed: `${Date.now() - t0}ms`, resolvedBy: err?.message?.slice(0, 50) || 'Error' } : rr));
            }
            await new Promise(r => setTimeout(r, 500));
        }

        setRunning(false); setCurrentIdx(-1);
        toast.success(`Batch abgeschlossen: ${rows.filter(r => r.status === 'found').length}/${rows.length} gefunden`);
    }, [rows]);

    const togglePause = () => { pauseRef.current = !pauseRef.current; setPaused(pauseRef.current); };
    const stopBatch = () => { abortRef.current = true; pauseRef.current = false; setRunning(false); setPaused(false); };
    const clearAll = () => { stopBatch(); setRows([]); setCurrentIdx(-1); };

    return (
        <div className="space-y-5">
            {/* Action Bar */}
            <div className="glass-card rounded-2xl p-4">
                <div className="flex flex-wrap gap-2 items-center">
                    <button onClick={loadPreset} disabled={running} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-border/50 bg-muted/30 hover:bg-muted/60 disabled:opacity-40 transition-colors">
                        <Sparkles className="w-3.5 h-3.5" /> 30 Test-Datensätze laden
                    </button>
                    <div className="w-px h-8 bg-border/50 mx-1" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={running} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-border/50 bg-muted/30 hover:bg-muted/60 disabled:opacity-40 transition-colors">
                        <Upload className="w-3.5 h-3.5" /> CSV importieren
                    </button>
                    <input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv" onChange={handleImport} className="hidden" />
                    <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors">
                        <Download className="w-3.5 h-3.5" /> Vorlage
                    </button>
                    <div className="flex-1" />

                    {rows.length > 0 && !running && (
                        <button onClick={runBatch} className="btn-brand px-5 py-2.5 !rounded-xl text-xs">
                            <Play className="w-3.5 h-3.5" /> Alle starten ({rows.filter(r => r.status === 'pending').length})
                        </button>
                    )}
                    {running && (
                        <>
                            <button onClick={togglePause} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${paused ? 'border-amber-400 text-amber-500 bg-amber-500/10' : 'border-border/50 bg-muted/30 hover:bg-muted/60'}`}>
                                <Pause className="w-3.5 h-3.5" /> {paused ? 'Fortsetzen' : 'Pause'}
                            </button>
                            <button onClick={stopBatch} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-destructive/30 text-danger bg-danger-light hover:bg-destructive/20 transition-colors">
                                <XCircle className="w-3.5 h-3.5" /> Stopp
                            </button>
                        </>
                    )}
                    {rows.length > 0 && done > 0 && (
                        <button onClick={exportResults} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors">
                            <Download className="w-3.5 h-3.5" /> Export
                        </button>
                    )}
                    {rows.length > 0 && !running && (
                        <button onClick={clearAll} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-destructive/20 text-danger hover:bg-danger-light transition-colors">
                            <Trash2 className="w-3.5 h-3.5" /> Löschen
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Banner */}
            {rows.length > 0 && (
                <div className={`glass-card rounded-2xl p-4 border-2 transition-all duration-500 ${
                    running ? 'border-primary/40 bg-primary/5' : done === total && total > 0 ? 'border-brand/30 bg-success-light' : 'border-border/30'
                }`}>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-5">
                            <div className="flex items-center gap-3">
                                {running ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : done === total && total > 0 ? <CheckCircle className="w-5 h-5 text-success" /> : <BarChart2 className="w-5 h-5 text-muted-foreground" />}
                                <div>
                                    <div className="text-sm font-bold">{running ? `Verarbeite ${currentIdx + 1}/${total}…` : done === total && total > 0 ? 'Batch abgeschlossen' : `${total} Zeilen bereit`}</div>
                                    <div className="text-xs text-muted-foreground">{done}/{total} verarbeitet{paused && ' · ⏸️ Pausiert'}</div>
                                </div>
                            </div>
                            {done > 0 && (
                                <div className="flex items-center gap-4 text-xs">
                                    <span className="flex items-center gap-1 text-success font-bold"><CheckCircle className="w-3 h-3" /> {found}</span>
                                    <span className="flex items-center gap-1 text-danger font-medium"><XCircle className="w-3 h-3" /> {done - found}</span>
                                    <span className="flex items-center gap-1 text-muted-foreground"><Zap className="w-3 h-3" /> Ø {Math.round(avgConf * 100)}%</span>
                                    <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3 h-3" /> Ø {Math.round(avgTime)}ms</span>
                                </div>
                            )}
                        </div>
                        {total > 0 && (
                            <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700 ease-out rounded-full" style={{ width: `${(done / total) * 100}%` }} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {rows.length === 0 && (
                <div className="glass-card rounded-2xl p-12 text-center border-2 border-dashed border-border/50">
                    <FileSpreadsheet className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                    <h3 className="text-foreground font-bold text-lg mb-2">Noch keine Testdaten</h3>
                    <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                        Lade die 30 vorbereiteten Testdaten (Easy → Exotic) oder importiere eine eigene CSV-Datei.
                    </p>
                    <div className="flex gap-3 justify-center flex-wrap">
                        <button onClick={loadPreset} className="btn-brand px-5 py-3 !rounded-xl">
                            <Sparkles className="w-4 h-4" /> 30 Test-Datensätze laden
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors">
                            <Upload className="w-4 h-4" /> CSV importieren
                        </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-4 font-mono">Format: Marke;Modell;Baujahr;Motor;VIN;Teil (Semikolon-getrennt, UTF-8)</p>
                </div>
            )}

            {/* ═══ TABLE ═══ */}
            {rows.length > 0 && (
                <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/30 border-b border-border/50">
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-8">#</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Level</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Marke</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Modell</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bj.</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Motor</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ersatzteil</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[140px]">OEM-Nummer</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conf.</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Zeit</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, i) => (
                                    <tr
                                        key={row.id}
                                        id={`batch-row-${i}`}
                                        className={`border-b border-border/30 transition-all duration-500 ${
                                            row.status === 'processing' ? 'bg-primary/8 ring-2 ring-primary/30 ring-inset animate-pulse'
                                            : row.status === 'found' ? 'bg-success-light/50'
                                            : row.status === 'not_found' ? 'bg-danger-light/30'
                                            : row.status === 'error' ? 'bg-warn-light/30'
                                            : 'hover:bg-muted/20'
                                        }`}
                                    >
                                        <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{i + 1}</td>
                                        <td className="px-3 py-2.5"><DifficultyBadge d={row.difficulty} /></td>
                                        <td className="px-3 py-2.5 font-bold text-xs">{row.make}</td>
                                        <td className="px-3 py-2.5 text-xs">{row.model}</td>
                                        <td className="px-3 py-2.5 text-xs font-mono">{row.year}</td>
                                        <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{row.motor || '—'}</td>
                                        <td className="px-3 py-2.5 text-xs font-medium">{row.part}</td>
                                        <td className="px-3 py-2.5">
                                            {row.oem ? (
                                                <code className="font-mono font-black text-sm tracking-wide text-foreground">{row.oem}</code>
                                            ) : row.status === 'processing' ? (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" style={{ animationDelay: '200ms' }} />
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" style={{ animationDelay: '400ms' }} />
                                                </span>
                                            ) : row.status === 'not_found' ? (
                                                <span className="text-xs text-danger/60 italic">—</span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/30">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {row.confidence != null ? (
                                                <span className={`text-xs font-bold ${row.confidence >= 0.9 ? 'text-success' : row.confidence >= 0.7 ? 'text-warn' : 'text-danger'}`}>
                                                    {Math.round(row.confidence * 100)}%
                                                </span>
                                            ) : <span className="text-xs text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{row.elapsed || '—'}</td>
                                        <td className="px-3 py-2.5"><StatusCell status={row.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 bg-muted/20 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{total} Zeilen · {done} verarbeitet</span>
                        {found > 0 && <span className="font-bold text-success">Erfolgsrate: {Math.round((found / Math.max(done, 1)) * 100)}%</span>}
                    </div>
                </div>
            )}
        </div>
    );
}

export default OemBatchTest;
