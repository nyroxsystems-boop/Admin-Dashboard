import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Play, Pause, Square, Loader2, CheckCircle, XCircle, AlertTriangle,
    ChevronDown, ChevronRight, Upload, Database, RefreshCcw, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    getBulkStatus, discoverFromPL24, startAllBulkJobs,
    pauseBulkJob, resumeBulkJob, cancelBulkJob,
    getBulkJobs, getBulkJobDetail, getBulkJobResults, exportBulkToOemDb,
    getBrands, crawlBrand,
    BulkJob, BulkStatus, BulkResultRow, BulkJobProgress,
} from '../api/wws';

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function BulkScraperView() {
    const [status, setStatus] = useState<BulkStatus | null>(null);
    const [jobs, setJobs] = useState<BulkJob[]>([]);
    const [liveResults, setLiveResults] = useState<BulkResultRow[]>([]);
    const [liveTotal, setLiveTotal] = useState(0);
    const [expandedJob, setExpandedJob] = useState<number | null>(null);
    const [jobProgress, setJobProgress] = useState<BulkJobProgress | null>(null);
    const [starting, setStarting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [brands, setBrands] = useState<string[]>([]);
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [crawlMode, setCrawlMode] = useState<'api' | 'browser'>('api');
    const tableBottomRef = useRef<HTMLDivElement>(null);

    // Load brands on mount
    useEffect(() => {
        getBrands()
            .then(r => {
                setBrands(r.brands);
                if (r.brands.length > 0 && !selectedBrand) {
                    setSelectedBrand(r.brands[0]);
                }
            })
            .catch(() => {
                // Fallback brand list if API is down
                setBrands(['VW', 'AUDI', 'BMW', 'MERCEDES', 'PORSCHE', 'SEAT', 'SKODA', 'CUPRA',
                    'FORD', 'OPEL', 'TOYOTA', 'HYUNDAI', 'KIA', 'RENAULT', 'PEUGEOT', 'CITROEN',
                    'FIAT', 'VOLVO', 'JAGUAR', 'LAND ROVER', 'MINI', 'NISSAN', 'HONDA', 'MAZDA',
                    'SUZUKI', 'LEXUS', 'BENTLEY', 'DACIA', 'JEEP', 'ALPINE', 'IVECO', 'INFINITI', 'MAN']);
                setSelectedBrand('VW');
            });
    }, []);

    // Auto-refresh status + jobs + live results
    const loadAll = useCallback(async () => {
        try {
            const [s, j] = await Promise.all([
                getBulkStatus().catch(() => null),
                getBulkJobs().catch(() => ({ jobs: [], total: 0 })),
            ]);
            if (s) setStatus(s);
            setJobs(j.jobs);

            // Load live results from the running or most recent job
            const activeJob = j.jobs.find(job => job.status === 'running') || j.jobs[0];
            if (activeJob && activeJob.total_parts_found > 0) {
                const r = await getBulkJobResults(activeJob.id, { limit: 100 }).catch(() => ({ results: [], total: 0 }));
                setLiveResults(r.results);
                setLiveTotal(r.total);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        loadAll();
        const interval = setInterval(loadAll, 3000);
        return () => clearInterval(interval);
    }, [loadAll]);

    // Start single brand crawl
    const handleStartBrand = async () => {
        if (!selectedBrand) {
            toast.error('Bitte Marke auswählen');
            return;
        }
        setStarting(true);
        try {
            toast.info(`Starte ${crawlMode === 'api' ? '⚡ API' : '🌐 Browser'} Crawl für ${selectedBrand}...`);
            await crawlBrand(selectedBrand, crawlMode);
            toast.success(`${selectedBrand} Crawl gestartet — Fortschritt in den Logs`);
            await loadAll();
        } catch (err: any) {
            toast.error('Start fehlgeschlagen: ' + err.message);
        } finally {
            setStarting(false);
        }
    };

    // Start all brands (discover → start-all)
    const handleStartAll = async () => {
        setStarting(true);
        try {
            toast.info('Starte Discovery aller Marken...');
            const discovery = await discoverFromPL24();
            toast.success(`${discovery.models.length} Modelle von ${discovery.brands.length} Marken entdeckt`);
            const result = await startAllBulkJobs();
            toast.success(`${result.queued} Jobs gestartet`);
            await loadAll();
        } catch (err: any) {
            toast.error('Start fehlgeschlagen: ' + err.message);
        } finally {
            setStarting(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const result = await exportBulkToOemDb();
            toast.success(`${result.exported} OEMs in die Datenbank exportiert`);
        } catch (err: any) {
            toast.error('Export fehlgeschlagen: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    const handleExpandJob = async (jobId: number) => {
        if (expandedJob === jobId) {
            setExpandedJob(null);
            return;
        }
        try {
            const { progress } = await getBulkJobDetail(jobId);
            setJobProgress(progress);
            setExpandedJob(jobId);
        } catch { /* ignore */ }
    };

    const isRunning = status?.running && !status?.paused;
    const isPaused = status?.running && status?.paused;
    const activeJob = status?.currentJob;

    return (
        <div className="space-y-6">

            {/* ── Brand Selector + Control Bar ────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
                {!isRunning && !isPaused ? (
                    <>
                        {/* Brand Selector */}
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedBrand}
                                onChange={e => setSelectedBrand(e.target.value)}
                                className="px-3 py-2.5 bg-background border border-border rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-w-[140px]"
                            >
                                {brands.map(b => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>

                            <button onClick={handleStartBrand} disabled={starting || !selectedBrand}
                                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm">
                                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                Marke crawlen
                            </button>
                        </div>

                        {/* Mode Toggle */}
                        <button
                            onClick={() => setCrawlMode(m => m === 'api' ? 'browser' : 'api')}
                            className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition-all ${
                                crawlMode === 'api'
                                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                                    : 'bg-blue-50 border-blue-300 text-blue-700'
                            }`}
                            title={crawlMode === 'api' ? 'API-Modus: 10-20x schneller, direkte REST-Calls' : 'Browser-Modus: Langsamer, aber stabiler'}
                        >
                            {crawlMode === 'api' ? '⚡ API' : '🌐 Browser'}
                        </button>

                        {/* Divider */}
                        <div className="h-8 w-px bg-border mx-1" />

                        {/* Start all (secondary) */}
                        <button onClick={handleStartAll} disabled={starting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-muted text-foreground border border-border rounded-lg text-sm font-medium hover:bg-muted/80 disabled:opacity-50"
                            title="Discovery + alle Marken nacheinander">
                            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            Alle Marken
                        </button>
                    </>
                ) : (
                    <>
                        {isRunning && (
                            <button onClick={() => { if (activeJob) pauseBulkJob(activeJob.id); }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:opacity-90">
                                <Pause className="w-4 h-4" /> Pausieren
                            </button>
                        )}
                        {isPaused && (
                            <button onClick={() => { if (activeJob) resumeBulkJob(activeJob.id); }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:opacity-90">
                                <Play className="w-4 h-4" /> Fortsetzen
                            </button>
                        )}
                        <button onClick={() => { if (activeJob) cancelBulkJob(activeJob.id); }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:opacity-90">
                            <Square className="w-4 h-4" /> Stoppen
                        </button>
                    </>
                )}

                {(status?.totalResults || 0) > 0 && (
                    <button onClick={handleExport} disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        In OEM-DB exportieren
                    </button>
                )}

                <div className="ml-auto flex items-center gap-4 text-sm">
                    {isRunning && (
                        <span className="flex items-center gap-2 text-primary font-medium">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {activeJob ? `${activeJob.brand} ${activeJob.model}` : 'Läuft...'}
                        </span>
                    )}
                    {isPaused && (
                        <span className="flex items-center gap-2 text-amber-600 font-medium">
                            <AlertTriangle className="w-4 h-4" /> Pausiert
                        </span>
                    )}
                    <span className="text-muted-foreground">
                        <Database className="w-4 h-4 inline mr-1" />
                        {(status?.totalResults || 0).toLocaleString()} OEMs
                    </span>
                </div>
            </div>

            {/* ── Marke/Modell Übersicht (PL24-Style) ─────────────────── */}
            {jobs.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-border px-4 py-2.5 flex items-center gap-3">
                        <span className="font-semibold text-sm">Marke / Modell</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                            {jobs.filter(j => j.status === 'completed').length} / {jobs.length} fertig
                        </span>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
                        {jobs.map(job => (
                            <div key={job.id}>
                                <div className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30 cursor-pointer text-sm"
                                    onClick={() => handleExpandJob(job.id)}>
                                    {expandedJob === job.id
                                        ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}

                                    <span className="font-medium w-24">{job.brand}</span>
                                    <span className="text-muted-foreground flex-1">{job.model}</span>

                                    <StatusBadge status={job.status} />

                                    {job.total_hg > 0 && (
                                        <div className="flex items-center gap-2 w-28">
                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-primary rounded-full transition-all"
                                                    style={{ width: `${Math.round((job.completed_hg / job.total_hg) * 100)}%` }} />
                                            </div>
                                            <span className="text-xs text-muted-foreground w-10 text-right">
                                                {Math.round((job.completed_hg / job.total_hg) * 100)}%
                                            </span>
                                        </div>
                                    )}

                                    <span className="text-xs font-mono w-16 text-right">
                                        {job.total_parts_found} OEMs
                                    </span>
                                </div>

                                {/* Expanded: HG Breakdown */}
                                {expandedJob === job.id && jobProgress && (
                                    <div className="bg-muted/20 border-t border-border/50 px-6 py-2">
                                        {job.last_error && (
                                            <div className="flex items-start gap-2 mb-2 p-2 bg-red-50 dark:bg-red-950/20 rounded text-xs text-red-700 dark:text-red-400">
                                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                                <span>{job.last_error}</span>
                                            </div>
                                        )}
                                        {jobProgress.byHg.length > 0 ? (
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                                                {jobProgress.byHg.map(hg => (
                                                    <div key={hg.hg_code} className="flex items-center gap-2 p-1.5 rounded bg-background border border-border/50">
                                                        <span className="font-mono text-primary font-bold">{hg.hg_code}</span>
                                                        <span className="truncate flex-1">{hg.hg_name || '-'}</span>
                                                        <span className="font-mono">{hg.parts_found || 0}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground py-1">Noch keine Hauptgruppen erkannt</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Live OEM Tabelle ────────────────────────────────────── */}
            <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-border px-4 py-2.5 flex items-center gap-3">
                    <span className="font-semibold text-sm">Gefundene Teile</span>
                    {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                    <span className="text-xs text-muted-foreground ml-auto">
                        {liveTotal.toLocaleString()} Ergebnisse
                    </span>
                </div>

                {liveResults.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                        {isRunning
                            ? 'Warte auf erste Ergebnisse...'
                            : 'Starte den Scraper um OEMs zu sammeln'}
                    </div>
                ) : (
                    <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/30 sticky top-0">
                                <tr className="text-left">
                                    <th className="px-4 py-2 font-medium text-muted-foreground">Teilenummer</th>
                                    <th className="px-4 py-2 font-medium text-muted-foreground">Benennung</th>
                                    <th className="px-4 py-2 font-medium text-muted-foreground">Marke</th>
                                    <th className="px-4 py-2 font-medium text-muted-foreground">Modell</th>
                                    <th className="px-4 py-2 font-medium text-muted-foreground">HG</th>
                                    <th className="px-4 py-2 font-medium text-muted-foreground">Bildtafel</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {liveResults.map((r, i) => (
                                    <tr key={i} className="hover:bg-muted/20">
                                        <td className="px-4 py-1.5 font-mono font-semibold text-primary">{r.oem}</td>
                                        <td className="px-4 py-1.5 text-muted-foreground truncate max-w-[200px]">{r.description || '-'}</td>
                                        <td className="px-4 py-1.5">{r.brand}</td>
                                        <td className="px-4 py-1.5">{r.model}</td>
                                        <td className="px-4 py-1.5 font-mono text-xs">
                                            {r.hg_code}{r.hg_name ? ` ${r.hg_name}` : ''}
                                        </td>
                                        <td className="px-4 py-1.5 font-mono text-xs">{r.bildtafel || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div ref={tableBottomRef} />
                    </div>
                )}
            </div>

            {/* ── Stats by Brand ──────────────────────────────────────── */}
            {status && status.resultsByBrand && status.resultsByBrand.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-border px-4 py-2.5">
                        <span className="font-semibold text-sm">OEMs pro Marke</span>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-px bg-border">
                        {status.resultsByBrand.map(b => (
                            <div key={b.brand} className="bg-background px-3 py-2 text-center">
                                <div className="text-xs text-muted-foreground">{b.brand}</div>
                                <div className="text-sm font-bold font-mono">{b.count.toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; label: string }> = {
        pending: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: 'Wartend' },
        queued: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-400', label: 'Queue' },
        running: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-400', label: 'Läuft' },
        paused: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400', label: 'Pause' },
        completed: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400', label: 'Fertig' },
        failed: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-600 dark:text-red-400', label: 'Fehler' },
    };
    const c = config[status] || config.pending;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${c.bg} ${c.text}`}>
            {status === 'running' && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            {status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
            {status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
            {c.label}
        </span>
    );
}
