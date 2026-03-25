/**
 * OEM Lookup Tester — Standalone OEM Number Resolution + Registry Approval
 * 
 * Enter an OEM number → AI identifies the part → Approve with ✓ → Added to registry
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Search, Loader2, CheckCircle, XCircle, Database, Hash,
    Car, Package, Sparkles, ArrowRight, Plus, AlertTriangle, RefreshCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { lookupOem, approveOemResult, OemLookupResult } from '../api/wws';

interface LookupHistoryItem {
    oem: string;
    result: OemLookupResult;
    approved: boolean;
    timestamp: Date;
}

export function OemLookupView() {
    const [searchInput, setSearchInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentResult, setCurrentResult] = useState<OemLookupResult | null>(null);
    const [approving, setApproving] = useState(false);
    const [history, setHistory] = useState<LookupHistoryItem[]>([]);

    // Editable fields (pre-filled from AI result, user can adjust before approving)
    const [editBrand, setEditBrand] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editModel, setEditModel] = useState('');
    const [editConfidence, setEditConfidence] = useState(0.9);

    const handleLookup = async () => {
        const oem = searchInput.trim();
        if (!oem || oem.length < 3) {
            toast.error('Bitte mindestens 3 Zeichen eingeben');
            return;
        }

        setLoading(true);
        setCurrentResult(null);

        try {
            const result = await lookupOem(oem);
            setCurrentResult(result);

            // Pre-fill editable fields from AI result
            setEditBrand(result.aiResult.brand || '');
            setEditCategory(result.aiResult.part_category || '');
            setEditDescription(result.aiResult.part_description || '');
            setEditModel(result.aiResult.model || '');
            setEditConfidence(result.aiResult.confidence || 0.9);

            if (result.existsInRegistry) {
                toast.info('✅ Diese OEM-Nummer ist bereits im Registry vorhanden');
            }
        } catch (err: any) {
            toast.error(`Lookup fehlgeschlagen: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!currentResult) return;

        if (!editBrand.trim()) {
            toast.error('Marke ist ein Pflichtfeld');
            return;
        }

        setApproving(true);
        try {
            const result = await approveOemResult({
                oem: currentResult.oem,
                brand: editBrand.trim().toUpperCase(),
                part_category: editCategory.trim(),
                part_description: editDescription.trim(),
                model: editModel.trim(),
                confidence: editConfidence,
            });

            toast.success(
                result.action === 'updated'
                    ? `✅ OEM ${currentResult.oem} im Registry aktualisiert`
                    : `✅ OEM ${currentResult.oem} ins Registry aufgenommen!`
            );

            // Add to history
            setHistory(prev => [{
                oem: currentResult.oem,
                result: currentResult,
                approved: true,
                timestamp: new Date(),
            }, ...prev]);

            // Reset for next lookup
            setCurrentResult(null);
            setSearchInput('');
        } catch (err: any) {
            toast.error(`Genehmigung fehlgeschlagen: ${err.message}`);
        } finally {
            setApproving(false);
        }
    };

    const confidenceColor = (c: number) =>
        c >= 0.8 ? 'text-success' : c >= 0.5 ? 'text-warn' : 'text-danger';

    const confidenceBg = (c: number) =>
        c >= 0.8 ? 'bg-success-light border-brand/15' : c >= 0.5 ? 'bg-warn-light border-amber-500/20' : 'bg-danger-light border-destructive/15';

    // Quick test OEM numbers
    const quickOems = [
        { oem: '5Q0615301F', label: 'VW Bremsscheibe' },
        { oem: '34116864906', label: 'BMW Bremssattel' },
        { oem: 'A2044231300', label: 'Mercedes Querlenker' },
        { oem: '8K0615301B', label: 'Audi Bremsscheibe' },
        { oem: '1K0407151AC', label: 'VW Querlenker' },
    ];

    return (
        <div className="space-y-6">
        <div>
                <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
                    <div className="icon-box w-10 h-10 glow-primary">
                        <Search className="w-5 h-5" />
                    </div>
                    OEM Lookup Tester
                </h2>
                <p className="text-muted-foreground text-sm mt-1.5 ml-[52px]">
                    OEM-Nummer eingeben → KI identifiziert das Teil → Bestätigen → Ins Registry aufnehmen
                </p>
            </div>

            {/* Search Bar */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                            placeholder="OEM-Nummer eingeben (z.B. 5Q0615301F)"
                            className="w-full pl-12 pr-4 py-3.5 rounded-xl text-lg font-mono outline-none transition-all premium-input !text-lg"
                            disabled={loading}
                        />
                    </div>
                    <motion.button
                        onClick={handleLookup}
                        disabled={loading || searchInput.trim().length < 3}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn-brand px-6 py-3.5 !rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        Suchen
                    </motion.button>
                </div>

                {/* Quick OEM chips */}
                <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] text-muted-foreground self-center font-mono uppercase tracking-wider font-semibold">Schnelltest:</span>
                    {quickOems.map((q) => (
                        <button
                            key={q.oem}
                            onClick={() => { setSearchInput(q.oem); }}
                            className="px-3 py-1.5 text-xs rounded-lg border border-border/50 bg-muted/50 transition-all font-mono hover:border-brand hover:bg-brand-light"
                        >
                            {q.oem} <span className="text-muted-foreground ml-1 opacity-60">({q.label})</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading State */}
            <AnimatePresence>
                {loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="stat-card p-8 flex flex-col items-center gap-3"
                    >
                        <div className="icon-box w-12 h-12 glow-primary">
                            <Sparkles className="w-6 h-6 animate-pulse" />
                        </div>
                        <p className="text-foreground font-semibold">KI analysiert OEM-Nummer...</p>
                        <p className="text-muted-foreground text-sm">Identifizierung läuft über Gemini AI</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Result Card */}
            <AnimatePresence>
                {currentResult && !loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        {/* Registry Status */}
                        {currentResult.existsInRegistry && (
                            <div className="flex items-center gap-3 p-4 bg-success-light border border-brand/15 rounded-xl">
                                <CheckCircle className="w-5 h-5 text-success" />
                                <div>
                                    <span className="text-success font-semibold">Bereits im Registry</span>
                                    <span className="text-muted-foreground text-sm ml-2">
                                        — {currentResult.registryRecord?.brand} | {currentResult.registryRecord?.part_category} | {Math.round((currentResult.registryRecord?.confidence || 0) * 100)}% Konfidenz
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* AI Result + Editable Fields */}
                        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                            {/* Result Header */}
                            <div className="px-6 py-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="icon-box w-10 h-10 glow-primary">
                                        <Sparkles className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{currentResult.aiResult.partName}</h3>
                                        <p className="text-muted-foreground text-xs">KI-Ergebnis für <code className="bg-muted px-1.5 rounded">{currentResult.oem}</code></p>
                                    </div>
                                </div>
                                <div className={`px-3 py-1.5 rounded-lg border font-bold text-sm ${confidenceBg(currentResult.aiResult.confidence)}`}>
                                    <span className={confidenceColor(currentResult.aiResult.confidence)}>
                                        {Math.round(currentResult.aiResult.confidence * 100)}% Konfidenz
                                    </span>
                                </div>
                            </div>

                            {/* AI Info Row */}
                            {(currentResult.aiResult.vehicles || currentResult.aiResult.manufacturer || currentResult.aiResult.notes) && (
                                <div className="px-6 py-3 border-b border-border/30 bg-muted/10 flex flex-wrap gap-4 text-sm">
                                    {currentResult.aiResult.vehicles && (
                                        <div className="flex items-center gap-1.5">
                                            <Car className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-muted-foreground">Fahrzeuge:</span>
                                            <span className="text-foreground">{currentResult.aiResult.vehicles}</span>
                                        </div>
                                    )}
                                    {currentResult.aiResult.manufacturer && (
                                        <div className="flex items-center gap-1.5">
                                            <Package className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-muted-foreground">Hersteller:</span>
                                            <span className="text-foreground">{currentResult.aiResult.manufacturer}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Editable Fields */}
                            <div className="p-6 space-y-4">
                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                                    Felder anpassen & bestätigen
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Marke *</label>
                                        <input
                                            value={editBrand}
                                            onChange={(e) => setEditBrand(e.target.value.toUpperCase())}
                                            className="w-full px-4 py-2.5 bg-muted/50 border border-border/50 focus:border-primary/50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                                            placeholder="VOLKSWAGEN"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Kategorie</label>
                                        <input
                                            value={editCategory}
                                            onChange={(e) => setEditCategory(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-muted/50 border border-border/50 focus:border-primary/50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                            placeholder="brake"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Beschreibung</label>
                                        <input
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-muted/50 border border-border/50 focus:border-primary/50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                            placeholder="Bremsscheibe vorne 312x25mm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Modell</label>
                                        <input
                                            value={editModel}
                                            onChange={(e) => setEditModel(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-muted/50 border border-border/50 focus:border-primary/50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                            placeholder="Golf 7"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">
                                            Konfidenz: {Math.round(editConfidence * 100)}%
                                        </label>
                                        <input
                                            type="range" min="0" max="1" step="0.05"
                                            value={editConfidence}
                                            onChange={(e) => setEditConfidence(parseFloat(e.target.value))}
                                            className="w-full accent-primary"
                                        />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-4 border-t border-border/30">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        {currentResult.aiResult.confidence < 0.5 && (
                                            <>
                                                <AlertTriangle className="w-4 h-4 text-warn" />
                                                <span>Niedrige Konfidenz — bitte Daten prüfen</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setCurrentResult(null); setSearchInput(''); }}
                                            className="px-5 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl font-medium transition-colors"
                                        >
                                            <XCircle className="w-4 h-4 inline mr-1.5" />
                                            Verwerfen
                                        </button>
                                        <motion.button
                                            onClick={handleApprove}
                                            disabled={approving || !editBrand.trim()}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="btn-success px-6 py-2.5 !rounded-xl disabled:opacity-50"
                                        >
                                            {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                            Ins Registry aufnehmen
                                        </motion.button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* AI Notes */}
                        {currentResult.aiResult.notes && (
                            <div className="p-4 bg-brand-light border border-brand/15 rounded-xl text-sm text-muted-foreground">
                                <span className="font-semibold text-brand mr-2">📝 KI-Notizen:</span>
                                {currentResult.aiResult.notes}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Lookup History */}
            {history.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        Verlauf ({history.length})
                    </h3>
                    <div className="space-y-2">
                        {history.map((item, i) => (
                            <motion.div
                                key={`${item.oem}-${i}`}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-4 p-3 bg-card border border-border/30 rounded-xl hover:bg-muted/20 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-success-light flex items-center justify-center">
                                    <CheckCircle className="w-4 h-4 text-success" />
                                </div>
                                <code className="font-mono font-bold text-sm">{item.oem}</code>
                                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">{item.result.aiResult.partName}</span>
                                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded font-bold">
                                    {item.result.aiResult.brand}
                                </span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                    {item.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state when no result and no history */}
            {!currentResult && !loading && history.length === 0 && (
                <div className="bg-card border border-border/50 rounded-2xl p-12 text-center">
                    <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-foreground font-semibold mb-2">OEM-Nummer eingeben</h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        Gib eine OEM-Teilenummer ein um sie durch die KI identifizieren zu lassen.
                        Bestätigte Ergebnisse werden automatisch ins OEM Registry aufgenommen.
                    </p>
                </div>
            )}
        </div>
    );
}

export default OemLookupView;
