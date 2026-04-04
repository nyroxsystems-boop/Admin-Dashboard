import { useState, useEffect, useCallback } from 'react';
import {
    Play, Pause, Square, Plus, Trash2, RefreshCcw, Upload, Download,
    Car, Loader2, CheckCircle, XCircle, AlertTriangle, Clock, ChevronDown, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    getBulkStatus, getBulkVehicles, createBulkVehicle, updateBulkVehicle, deleteBulkVehicle,
    seedBulkVins, discoverFromPL24, startBulkJob, startAllBulkJobs, pauseBulkJob, resumeBulkJob, cancelBulkJob,
    getBulkJobs, getBulkJobDetail, getBulkJobResults, exportBulkToOemDb,
    BulkVehicle, BulkJob, BulkStatus, BulkResultRow, BulkJobProgress,
} from '../api/wws';

const BRANDS = [
    'VW', 'AUDI', 'BMW', 'MERCEDES', 'PORSCHE', 'SEAT', 'SKODA', 'CUPRA',
    'FORD', 'OPEL', 'TOYOTA', 'HYUNDAI', 'KIA', 'RENAULT', 'PEUGEOT',
    'CITROEN', 'FIAT', 'VOLVO', 'JAGUAR', 'LAND ROVER', 'MINI', 'NISSAN',
    'HONDA', 'MAZDA', 'SUZUKI', 'DACIA', 'JEEP',
];

export function BulkScraperView() {
    const [subTab, setSubTab] = useState<'vehicles' | 'jobs' | 'results'>('vehicles');
    const [status, setStatus] = useState<BulkStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const loadStatus = useCallback(async () => {
        try {
            const s = await getBulkStatus();
            setStatus(s);
        } catch {
            // Service might be down
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStatus();
        const interval = setInterval(loadStatus, 5000);
        return () => clearInterval(interval);
    }, [loadStatus]);

    return (
        <div>

            {/* Status Bar */}
            {status && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    <div className="bg-card border border-border rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Status</div>
                        <div className="flex items-center gap-2 mt-1">
                            {status.running ? (
                                status.paused
                                    ? <><AlertTriangle className="w-4 h-4 text-yellow-500" /><span className="font-medium text-yellow-500">Pausiert</span></>
                                    : <><Loader2 className="w-4 h-4 text-blue-500 animate-spin" /><span className="font-medium text-blue-500">Läuft</span></>
                            ) : (
                                <><Clock className="w-4 h-4 text-muted-foreground" /><span className="font-medium">Idle</span></>
                            )}
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Fahrzeuge</div>
                        <div className="text-lg font-bold mt-1">{status.activeVehicles} / {status.totalVehicles}</div>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Jobs</div>
                        <div className="text-lg font-bold mt-1">{status.totalJobs}</div>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">OEMs gefunden</div>
                        <div className="text-lg font-bold mt-1">{status.totalResults.toLocaleString()}</div>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Aktueller Job</div>
                        <div className="text-sm font-medium mt-1 truncate">
                            {status.currentJob ? `${status.currentJob.brand} ${status.currentJob.model}` : '-'}
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-tabs */}
            <div className="flex gap-1 mb-6 border-b border-border">
                {(['vehicles', 'jobs', 'results'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setSubTab(tab)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            subTab === tab
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {tab === 'vehicles' ? 'Fahrzeuge' : tab === 'jobs' ? 'Jobs' : 'Ergebnisse'}
                    </button>
                ))}
            </div>

            {subTab === 'vehicles' && <VehiclesPanel onRefresh={loadStatus} />}
            {subTab === 'jobs' && <JobsPanel />}
            {subTab === 'results' && <ResultsPanel />}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// VEHICLES PANEL
// ═══════════════════════════════════════════════════════════════════════════

function VehiclesPanel({ onRefresh }: { onRefresh: () => void }) {
    const [vehicles, setVehicles] = useState<BulkVehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [discovering, setDiscovering] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ vin: '', brand: 'VW', model: '', model_code: '', year_from: '', year_to: '', notes: '' });

    const load = useCallback(async () => {
        try {
            const { vehicles } = await getBulkVehicles();
            setVehicles(vehicles);
        } catch (err: any) {
            toast.error('Fehler beim Laden: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async () => {
        if (!form.vin || !form.brand || !form.model) {
            toast.error('VIN, Marke und Modell sind Pflichtfelder');
            return;
        }
        try {
            await createBulkVehicle({
                vin: form.vin, brand: form.brand, model: form.model,
                model_code: form.model_code || undefined,
                year_from: form.year_from ? parseInt(form.year_from) : undefined,
                year_to: form.year_to ? parseInt(form.year_to) : undefined,
                notes: form.notes || undefined,
            });
            toast.success(`${form.brand} ${form.model} hinzugefügt`);
            setForm({ vin: '', brand: 'VW', model: '', model_code: '', year_from: '', year_to: '', notes: '' });
            setShowForm(false);
            load();
            onRefresh();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleDelete = async (id: number, label: string) => {
        if (!confirm(`${label} wirklich löschen?`)) return;
        try {
            await deleteBulkVehicle(id);
            toast.success('Gelöscht');
            load();
            onRefresh();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleToggleActive = async (v: BulkVehicle) => {
        try {
            await updateBulkVehicle(v.id, { is_active: !v.is_active });
            load();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleStartJob = async (vehicleId: number) => {
        try {
            const { jobId } = await startBulkJob(vehicleId);
            toast.success(`Job ${jobId} gestartet`);
            onRefresh();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleStartAll = async () => {
        try {
            const { queued } = await startAllBulkJobs();
            toast.success(`${queued} Jobs gestartet/gequeued`);
            onRefresh();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                    <button onClick={async () => {
                        setDiscovering(true);
                        try {
                            const result = await discoverFromPL24();
                            toast.success(`${result.models.length} Modelle von ${result.brands.length} Marken entdeckt!`);
                            load();
                            onRefresh();
                        } catch (err: any) { toast.error('Discovery: ' + err.message); }
                        finally { setDiscovering(false); }
                    }}
                        disabled={discovering || seeding}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50">
                        {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                        Von PL24 entdecken
                    </button>
                    <button onClick={async () => {
                        setSeeding(true);
                        try {
                            const result = await seedBulkVins();
                            toast.success(`${result.added} Fahrzeuge geladen (${result.total} gesamt)`);
                            load();
                            onRefresh();
                        } catch (err: any) { toast.error(err.message); }
                        finally { setSeeding(false); }
                    }}
                        disabled={seeding || discovering}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50">
                        {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        VINs auto-laden
                    </button>
                    <button onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90">
                        <Plus className="w-4 h-4" /> Manuell hinzufügen
                    </button>
                    <button onClick={handleStartAll}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:opacity-90">
                        <Play className="w-4 h-4" /> Alle starten
                    </button>
                </div>
                <span className="text-sm text-muted-foreground">{vehicles.length} Fahrzeuge</span>
            </div>

            {/* Add Form */}
            {showForm && (
                <div className="bg-card border border-border rounded-lg p-4 mb-4 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground">Marke *</label>
                            <select value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}
                                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm">
                                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">Modell *</label>
                            <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}
                                placeholder="z.B. Golf 7" className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">VIN / Fahrgestellnr. *</label>
                            <input value={form.vin} onChange={e => setForm({ ...form, vin: e.target.value.toUpperCase() })}
                                placeholder="WVWZZZ..." maxLength={17} className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm font-mono" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">Modellcode</label>
                            <input value={form.model_code} onChange={e => setForm({ ...form, model_code: e.target.value })}
                                placeholder="z.B. 5G" className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground">Baujahr von</label>
                            <input type="number" value={form.year_from} onChange={e => setForm({ ...form, year_from: e.target.value })}
                                placeholder="2015" className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">Baujahr bis</label>
                            <input type="number" value={form.year_to} onChange={e => setForm({ ...form, year_to: e.target.value })}
                                placeholder="2020" className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm" />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-muted-foreground">Notizen</label>
                            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                                placeholder="Optional" className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleAdd} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90">
                            Speichern
                        </button>
                        <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-muted text-muted-foreground rounded-md text-sm hover:opacity-80">
                            Abbrechen
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : vehicles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Noch keine Fahrzeuge angelegt</p>
                    <p className="text-sm mt-1">Füge Fahrzeuge mit VINs hinzu, um den Bulk-Scrape zu starten</p>
                </div>
            ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium">Marke</th>
                                <th className="text-left px-4 py-3 font-medium">Modell</th>
                                <th className="text-left px-4 py-3 font-medium">VIN</th>
                                <th className="text-left px-4 py-3 font-medium">Baujahr</th>
                                <th className="text-left px-4 py-3 font-medium">Aktiv</th>
                                <th className="text-right px-4 py-3 font-medium">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {vehicles.map(v => (
                                <tr key={v.id} className="hover:bg-muted/30">
                                    <td className="px-4 py-3 font-medium">{v.brand}</td>
                                    <td className="px-4 py-3">{v.model}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{v.vin}</td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {v.year_from ? `${v.year_from}${v.year_to ? `-${v.year_to}` : ''}` : '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleToggleActive(v)}
                                            className={`w-10 h-5 rounded-full transition-colors ${v.is_active ? 'bg-green-500' : 'bg-muted'}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${v.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => handleStartJob(v.id)} title="Job starten"
                                                className="p-1.5 rounded hover:bg-muted text-green-500"><Play className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(v.id, `${v.brand} ${v.model}`)} title="Löschen"
                                                className="p-1.5 rounded hover:bg-muted text-red-500"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// JOBS PANEL
// ═══════════════════════════════════════════════════════════════════════════

function JobsPanel() {
    const [jobs, setJobs] = useState<BulkJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedJob, setExpandedJob] = useState<number | null>(null);
    const [jobProgress, setJobProgress] = useState<BulkJobProgress | null>(null);

    const load = useCallback(async () => {
        try {
            const { jobs } = await getBulkJobs();
            setJobs(jobs);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const hasRunning = jobs.some(j => j.status === 'running');
        if (hasRunning) {
            const interval = setInterval(load, 5000);
            return () => clearInterval(interval);
        }
    }, [load, jobs.length]);

    const handleExpand = async (jobId: number) => {
        if (expandedJob === jobId) {
            setExpandedJob(null);
            return;
        }
        try {
            const { progress } = await getBulkJobDetail(jobId);
            setJobProgress(progress);
            setExpandedJob(jobId);
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const statusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-gray-100 text-gray-600',
            queued: 'bg-blue-100 text-blue-600',
            running: 'bg-blue-100 text-blue-600 animate-pulse',
            paused: 'bg-yellow-100 text-yellow-700',
            completed: 'bg-green-100 text-green-700',
            failed: 'bg-red-100 text-red-700',
        };
        const labels: Record<string, string> = {
            pending: 'Wartend', queued: 'In Warteschlange', running: 'Läuft',
            paused: 'Pausiert', completed: 'Fertig', failed: 'Fehler',
        };
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || ''}`}>
                {labels[status] || status}
            </span>
        );
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm hover:opacity-80">
                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : jobs.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">Keine Jobs vorhanden</p>
            ) : (
                <div className="space-y-2">
                    {jobs.map(job => (
                        <div key={job.id} className="border border-border rounded-lg overflow-hidden">
                            <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 cursor-pointer"
                                onClick={() => handleExpand(job.id)}>
                                {expandedJob === job.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                <div className="flex-1 min-w-0">
                                    <span className="font-medium">{job.brand} {job.model}</span>
                                    <span className="ml-2 text-xs text-muted-foreground font-mono">{job.vin}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {statusBadge(job.status)}
                                    {job.total_hg > 0 && (
                                        <div className="flex items-center gap-2 min-w-[120px]">
                                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-primary rounded-full transition-all"
                                                    style={{ width: `${Math.round((job.completed_hg / job.total_hg) * 100)}%` }} />
                                            </div>
                                            <span className="text-xs text-muted-foreground">{job.completed_hg}/{job.total_hg}</span>
                                        </div>
                                    )}
                                    <span className="text-sm font-medium min-w-[60px] text-right">{job.total_parts_found} OEMs</span>
                                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                        {job.status === 'running' && (
                                            <button onClick={() => { pauseBulkJob(job.id); load(); }} title="Pausieren"
                                                className="p-1.5 rounded hover:bg-muted"><Pause className="w-4 h-4 text-yellow-500" /></button>
                                        )}
                                        {job.status === 'paused' && (
                                            <button onClick={() => { resumeBulkJob(job.id); load(); }} title="Fortsetzen"
                                                className="p-1.5 rounded hover:bg-muted"><Play className="w-4 h-4 text-green-500" /></button>
                                        )}
                                        {(job.status === 'running' || job.status === 'paused') && (
                                            <button onClick={() => { cancelBulkJob(job.id); load(); }} title="Abbrechen"
                                                className="p-1.5 rounded hover:bg-muted"><Square className="w-4 h-4 text-red-500" /></button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded: HG progress */}
                            {expandedJob === job.id && jobProgress && (
                                <div className="border-t border-border bg-muted/20 px-4 py-3">
                                    {job.last_error && (
                                        <div className="flex items-start gap-2 mb-3 p-2 bg-red-50 rounded text-xs text-red-700">
                                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <span>{job.last_error}</span>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                                        <div><span className="text-muted-foreground">Gesamt:</span> {jobProgress.total}</div>
                                        <div><span className="text-green-600">Fertig:</span> {jobProgress.completed}</div>
                                        <div><span className="text-red-600">Fehler:</span> {jobProgress.failed}</div>
                                        <div><span className="text-blue-600">Offen:</span> {jobProgress.pending}</div>
                                    </div>
                                    {jobProgress.byHg.length > 0 && (
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-muted-foreground">
                                                    <th className="text-left py-1">HG</th>
                                                    <th className="text-left py-1">Name</th>
                                                    <th className="text-right py-1">Fortschritt</th>
                                                    <th className="text-right py-1">Fehler</th>
                                                    <th className="text-right py-1">OEMs</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {jobProgress.byHg.map(hg => (
                                                    <tr key={hg.hg_code} className="border-t border-border/50">
                                                        <td className="py-1 font-mono">{hg.hg_code}</td>
                                                        <td className="py-1">{hg.hg_name || '-'}</td>
                                                        <td className="py-1 text-right">{hg.completed}/{hg.total}</td>
                                                        <td className="py-1 text-right text-red-500">{hg.failed || '-'}</td>
                                                        <td className="py-1 text-right font-medium">{hg.parts_found || 0}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// RESULTS PANEL
// ═══════════════════════════════════════════════════════════════════════════

function ResultsPanel() {
    const [jobs, setJobs] = useState<BulkJob[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
    const [results, setResults] = useState<BulkResultRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        getBulkJobs().then(({ jobs }) => {
            const completedJobs = jobs.filter(j => j.status === 'completed' || j.total_parts_found > 0);
            setJobs(completedJobs);
            if (completedJobs.length > 0 && !selectedJobId) {
                setSelectedJobId(completedJobs[0].id);
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (!selectedJobId) return;
        setLoading(true);
        getBulkJobResults(selectedJobId, { limit: 50, offset: (page - 1) * 50, search: search || undefined })
            .then(({ results, total }) => {
                setResults(results);
                setTotal(total);
            })
            .catch(err => toast.error(err.message))
            .finally(() => setLoading(false));
    }, [selectedJobId, page, search]);

    const handleExport = async () => {
        if (!confirm('Alle Ergebnisse in die OEM-Datenbank exportieren?')) return;
        setExporting(true);
        try {
            const result = await exportBulkToOemDb(selectedJobId ? [selectedJobId] : undefined);
            toast.success(`${result.exported} OEMs exportiert (${result.errors} Fehler)`);
        } catch (err: any) {
            toast.error('Export fehlgeschlagen: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    const totalPages = Math.ceil(total / 50);

    return (
        <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <select value={selectedJobId || ''} onChange={e => { setSelectedJobId(Number(e.target.value)); setPage(1); }}
                    className="px-3 py-2 bg-background border border-border rounded-md text-sm">
                    <option value="">Job wählen...</option>
                    {jobs.map(j => (
                        <option key={j.id} value={j.id}>
                            #{j.id} — {j.brand} {j.model} ({j.total_parts_found} OEMs)
                        </option>
                    ))}
                </select>
                <input
                    value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="OEM oder Beschreibung suchen..."
                    className="flex-1 min-w-[200px] px-3 py-2 bg-background border border-border rounded-md text-sm"
                />
                <button onClick={handleExport} disabled={exporting || !selectedJobId}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50">
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    In OEM-DB exportieren
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : results.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">
                    {selectedJobId ? 'Keine Ergebnisse gefunden' : 'Wähle einen Job aus'}
                </p>
            ) : (
                <>
                    <div className="border border-border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left px-4 py-3 font-medium">OEM-Nummer</th>
                                    <th className="text-left px-4 py-3 font-medium">Beschreibung</th>
                                    <th className="text-left px-4 py-3 font-medium">Marke/Modell</th>
                                    <th className="text-left px-4 py-3 font-medium">HG</th>
                                    <th className="text-left px-4 py-3 font-medium">FG</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {results.map((r, i) => (
                                    <tr key={i} className="hover:bg-muted/30">
                                        <td className="px-4 py-2 font-mono font-medium">{r.oem}</td>
                                        <td className="px-4 py-2 text-muted-foreground truncate max-w-[250px]">{r.description || '-'}</td>
                                        <td className="px-4 py-2">{r.brand} {r.model}</td>
                                        <td className="px-4 py-2 text-xs">{r.hg_code}{r.hg_name ? ` ${r.hg_name}` : ''}</td>
                                        <td className="px-4 py-2 text-xs">{r.fg_code || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                        <span className="text-sm text-muted-foreground">{total.toLocaleString()} Ergebnisse</span>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                className="px-3 py-1.5 bg-muted rounded text-sm disabled:opacity-50">Zurück</button>
                            <span className="px-3 py-1.5 text-sm">Seite {page} / {totalPages || 1}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                className="px-3 py-1.5 bg-muted rounded text-sm disabled:opacity-50">Weiter</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
