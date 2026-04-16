/**
 * OEM Error Review — Review flagged OEM results
 * 
 * Items can be pushed here from:
 * - Batch test (checkbox → "Als Fehler markieren")
 * - Einzeltest ("Ergebnis prüfen")
 * 
 * Actions:
 * - ✅ "In DB übernehmen" — pushes verified OEM to the bot's registry
 * - 🗑️ "Verwerfen" — removes from error list
 * - 📤 "Exportieren" — downloads full error list as CSV
 */

import { useState, useEffect } from 'react';
import {
    Download, Trash2, CheckCircle, XCircle, Database, AlertTriangle, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { approveOemResult } from '../api/wws';

// ═══════════════════════════════════════════════════════════════════
// Types & Storage
// ═══════════════════════════════════════════════════════════════════

export interface ErrorItem {
    id: string;
    make: string;
    model: string;
    year: string;
    motor: string;
    vin: string;
    part: string;
    oem: string | null;
    confidence: number | null;
    source: string;         // 'batch' | 'forward' | 'reverse'
    addedAt: string;        // ISO timestamp
    status: 'pending' | 'approved' | 'rejected';
}

const STORAGE_KEY = 'partsunion_oem_errors';

export function loadErrors(): ErrorItem[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveErrors(items: ErrorItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addErrors(newItems: ErrorItem[]) {
    const existing = loadErrors();
    const merged = [...existing, ...newItems];
    saveErrors(merged);
}

export function removeErrors(ids: string[]) {
    const existing = loadErrors();
    saveErrors(existing.filter(e => !ids.includes(e.id)));
}

export function getErrorCount(): number {
    return loadErrors().length;
}

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════

export function OemErrorReview() {
    const [items, setItems] = useState<ErrorItem[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [approving, setApproving] = useState<string | null>(null);

    // Load from localStorage
    useEffect(() => {
        setItems(loadErrors());
        const interval = setInterval(() => setItems(loadErrors()), 2000);
        return () => clearInterval(interval);
    }, []);

    const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);
    const allSelected = filtered.length > 0 && filtered.every(i => selected.has(i.id));

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filtered.map(i => i.id)));
        }
    };

    // ── Push to DB (approve OEM) ──
    const approveItem = async (item: ErrorItem) => {
        if (!item.oem) { toast.error('Keine OEM-Nummer vorhanden'); return; }
        setApproving(item.id);
        try {
            await approveOemResult({
                oem: item.oem!,
                brand: item.make,
                model: item.model,
                part_category: item.part,
                part_description: `${item.part} (${item.model} ${item.year})`,
                confidence: item.confidence || 0.95,
            });
            // Mark as approved
            const updated = items.map(i => i.id === item.id ? { ...i, status: 'approved' as const } : i);
            setItems(updated);
            saveErrors(updated);
            toast.success(`✅ ${item.oem} in DB übernommen`);
        } catch (err: unknown) {
            toast.error(`DB-Fehler: ${err.message}`);
        } finally {
            setApproving(null);
        }
    };

    // ── Bulk approve selected ──
    const approveSelected = async () => {
        const toApprove = items.filter(i => selected.has(i.id) && i.oem && i.status === 'pending');
        if (!toApprove.length) { toast.info('Keine gültigen Einträge ausgewählt'); return; }
        for (const item of toApprove) {
            await approveItem(item);
        }
        setSelected(new Set());
    };

    // ── Delete / reject ──
    const rejectItem = (id: string) => {
        const updated = items.filter(i => i.id !== id);
        setItems(updated);
        saveErrors(updated);
        setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    };

    const rejectSelected = () => {
        const ids = [...selected];
        const updated = items.filter(i => !ids.includes(i.id));
        setItems(updated);
        saveErrors(updated);
        setSelected(new Set());
        toast.success(`${ids.length} Einträge verworfen`);
    };

    const clearAll = () => {
        setItems([]);
        saveErrors([]);
        setSelected(new Set());
        toast.success('Fehlerliste geleert');
    };

    // ── Export CSV ──
    const exportCSV = () => {
        const h = 'Marke;Modell;Baujahr;Motor;VIN;Teil;OEM;Confidence;Quelle;Status;Datum';
        const csv = [h, ...items.map(i =>
            [i.make, i.model, i.year, i.motor, i.vin, i.part, i.oem || '', i.confidence != null ? `${Math.round(i.confidence * 100)}%` : '', i.source, i.status, i.addedAt].join(';')
        )].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `oem_fehler_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        toast.success('Fehlerliste exportiert');
    };

    return (
        <div className="space-y-5">
            {/* Action Bar */}
            <div className="glass-card rounded-2xl p-4">
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Filter pills */}
                    <div className="flex bg-muted/50 rounded-lg p-0.5 gap-0.5 border border-border/50 text-[10px] font-bold">
                        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-md transition-all ${filter === f ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                {f === 'all' ? `Alle (${items.length})` : f === 'pending' ? `Offen (${items.filter(i => i.status === 'pending').length})` : f === 'approved' ? `✅ DB (${items.filter(i => i.status === 'approved').length})` : `❌ Verworfen (${items.filter(i => i.status === 'rejected').length})`}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1" />

                    {selected.size > 0 && (
                        <>
                            <button onClick={approveSelected} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-success-light text-success border border-brand/30 hover:bg-success/20 transition-colors">
                                <Database className="w-3.5 h-3.5" /> {selected.size}× In DB übernehmen
                            </button>
                            <button onClick={rejectSelected} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-destructive/30 text-danger bg-danger-light hover:bg-destructive/20 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" /> {selected.size}× Verwerfen
                            </button>
                            <div className="w-px h-8 bg-border/50 mx-1" />
                        </>
                    )}

                    <button onClick={exportCSV} disabled={items.length === 0} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-border/50 bg-muted/30 hover:bg-muted/60 disabled:opacity-40 transition-colors">
                        <Download className="w-3.5 h-3.5" /> Exportieren
                    </button>
                    <button onClick={clearAll} disabled={items.length === 0} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-destructive/20 text-danger hover:bg-danger-light disabled:opacity-40 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Alles löschen
                    </button>
                </div>
            </div>

            {/* Summary Banner */}
            {items.length > 0 && (
                <div className="glass-card rounded-2xl p-4 border-2 border-warn/30 bg-warn-light/30">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-warn" />
                        <div>
                            <div className="text-sm font-bold">{items.filter(i => i.status === 'pending').length} offene Einträge zur Prüfung</div>
                            <div className="text-xs text-muted-foreground">{items.filter(i => i.status === 'approved').length} in DB übernommen · {items.filter(i => i.oem).length} mit OEM · {items.filter(i => !i.oem).length} ohne OEM</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {items.length === 0 && (
                <div className="glass-card rounded-2xl p-12 text-center border-2 border-dashed border-border/50">
                    <CheckCircle className="w-16 h-16 text-success/20 mx-auto mb-4" />
                    <h3 className="text-foreground font-bold text-lg mb-2">Keine Fehler</h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        Markiere Ergebnisse im Batch-Test oder Einzeltest als „Fehler", um sie hier zu prüfen.
                        Korrekte Ergebnisse können direkt in die Datenbank übernommen werden.
                    </p>
                </div>
            )}

            {/* Table */}
            {filtered.length > 0 && (
                <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/30 border-b border-border/50">
                                    <th className="px-3 py-3 w-8">
                                        <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-border/50 accent-primary" />
                                    </th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Marke</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Modell</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bj.</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Motor</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Teil</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[120px]">OEM</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conf.</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quelle</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(item => (
                                    <tr
                                        key={item.id}
                                        className={`border-b border-border/30 transition-all ${
                                            item.status === 'approved' ? 'bg-success-light/40 opacity-60'
                                            : selected.has(item.id) ? 'bg-primary/5 ring-1 ring-primary/20 ring-inset'
                                            : 'hover:bg-muted/20'
                                        }`}
                                    >
                                        <td className="px-3 py-2.5">
                                            <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} className="rounded border-border/50 accent-primary" />
                                        </td>
                                        <td className="px-3 py-2.5 font-bold text-xs">{item.make}</td>
                                        <td className="px-3 py-2.5 text-xs">{item.model}</td>
                                        <td className="px-3 py-2.5 text-xs font-mono">{item.year}</td>
                                        <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{item.motor || '—'}</td>
                                        <td className="px-3 py-2.5 text-xs font-medium">{item.part}</td>
                                        <td className="px-3 py-2.5">
                                            {item.oem ? (
                                                <code className="font-mono font-black text-sm tracking-wide">{item.oem}</code>
                                            ) : (
                                                <span className="text-xs text-danger/60 italic">Keine OEM</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {item.confidence != null ? (
                                                <span className={`text-xs font-bold ${item.confidence >= 0.9 ? 'text-success' : item.confidence >= 0.7 ? 'text-warn' : 'text-danger'}`}>
                                                    {Math.round(item.confidence * 100)}%
                                                </span>
                                            ) : <span className="text-xs text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-[10px] text-muted-foreground uppercase">{item.source}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-1">
                                                {item.status === 'pending' && item.oem && (
                                                    <button
                                                        onClick={() => approveItem(item)}
                                                        disabled={approving === item.id}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-success-light text-success hover:bg-success/20 disabled:opacity-40 transition-colors"
                                                        title="In Datenbank übernehmen"
                                                    >
                                                        <Database className="w-3 h-3" /> DB
                                                    </button>
                                                )}
                                                {item.status === 'approved' && (
                                                    <span className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-success bg-success-light/60">
                                                        <CheckCircle className="w-3 h-3" /> In DB
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => rejectItem(item.id)}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-danger hover:bg-danger-light transition-colors"
                                                    title="Verwerfen"
                                                >
                                                    <XCircle className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 bg-muted/20 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{filtered.length} Einträge {filter !== 'all' ? `(Filter: ${filter})` : ''}</span>
                        {selected.size > 0 && <span className="font-bold text-primary">{selected.size} ausgewählt</span>}
                    </div>
                </div>
            )}
        </div>
    );
}

export default OemErrorReview;
