/**
 * OEM Intelligence — Bidirectional OEM Lookup
 * 
 * Forward: Vehicle + Part → OEM (Hydra v2: DB → CrossRef → AI → Validation → Learning)
 * Reverse: OEM → Part + Vehicles (Gemini AI / Registry)
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Search, Loader2, CheckCircle, XCircle, Hash,
    Car, Sparkles, ArrowRight, AlertTriangle, Wrench, ArrowLeftRight, FileSpreadsheet, Flag,
    ExternalLink, Database, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { lookupOem, approveOemResult, resolveOemForward, lookupPartslink24, getPartslinkHealth, OemLookupResult, PartslinkResult } from '../api/wws';
import { OemBatchTest } from './OemBatchTest';
import { OemErrorReview, getErrorCount, addErrors, type ErrorItem } from './OemErrorReview';

interface LookupHistoryItem {
    oem: string;
    result: OemLookupResult;
    approved: boolean;
    timestamp: Date;
}

export function OemLookupView() {
    const [mode, setMode] = useState<'forward' | 'reverse' | 'batch' | 'errors'>('forward');
    const [errorCount, setErrorCount] = useState(0);

    // Poll error count for badge
    useEffect(() => {
        setErrorCount(getErrorCount());
        const interval = setInterval(() => setErrorCount(getErrorCount()), 2000);
        return () => clearInterval(interval);
    }, []);

    // ── Reverse mode state ──
    const [searchInput, setSearchInput] = useState('');
    const [reverseLoading, setReverseLoading] = useState(false);
    const [currentResult, setCurrentResult] = useState<OemLookupResult | null>(null);
    const [approving, setApproving] = useState(false);
    const [history, setHistory] = useState<LookupHistoryItem[]>([]);

    // Editable fields
    const [editBrand, setEditBrand] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editModel, setEditModel] = useState('');
    const [editConfidence, setEditConfidence] = useState(0.9);

    // ── Forward mode state ──
    const [fwdMake, setFwdMake] = useState('');
    const [fwdModel, setFwdModel] = useState('');
    const [fwdVin, setFwdVin] = useState('');
    const [fwdPart, setFwdPart] = useState('');
    const [fwdLoading, setFwdLoading] = useState(false);
    const [fwdResult, setFwdResult] = useState<{
        success: boolean; oem: string | null;
        candidates: Array<{ oem: string; brand: string; confidence: number; source: string; note?: string }>;
        notes: string | null; confidence: number;
    } | null>(null);

    // ── PartsLink24 mode ──
    const [usePartslink, setUsePartslink] = useState(false);
    const [plAvailable, setPlAvailable] = useState<boolean | null>(null);
    const [plResult, setPlResult] = useState<PartslinkResult | null>(null);

    // Check PartsLink24 scraper health on toggle
    useEffect(() => {
        if (usePartslink && plAvailable === null) {
            getPartslinkHealth()
                .then(() => { setPlAvailable(true); toast.success('PartsLink24 Scraper verbunden'); })
                .catch(() => { setPlAvailable(false); toast.error('PartsLink24 Scraper nicht erreichbar (localhost:4100)'); });
        }
    }, [usePartslink]);

    // ── Reverse Lookup ──
    const handleReverseLookup = async () => {
        const oem = searchInput.trim();
        if (!oem || oem.length < 3) {
            toast.error('Bitte mindestens 3 Zeichen eingeben');
            return;
        }

        setReverseLoading(true);
        setCurrentResult(null);

        try {
            const result = await lookupOem(oem);
            setCurrentResult(result);

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
            setReverseLoading(false);
        }
    };

    // ── Forward Lookup ──
    const handleForwardSearch = async () => {
        if (!fwdPart) {
            toast.error('Bitte ein Ersatzteil eingeben');
            return;
        }

        setFwdLoading(true);
        setFwdResult(null);
        setPlResult(null);

        // ── PartsLink24 Mode ──
        if (usePartslink) {
            if (!fwdVin) {
                toast.error('PartsLink24 benötigt eine VIN/FIN!');
                setFwdLoading(false);
                return;
            }
            try {
                const result = await lookupPartslink24({
                    vin: fwdVin,
                    part: fwdPart,
                    brand: fwdMake || undefined,
                });
                setPlResult(result);
                if (result.success && result.results.length > 0) {
                    toast.success(`✅ PartsLink24: ${result.results.length} OEM-Nummern gefunden`);
                } else {
                    toast.warning('PartsLink24: Keine Ergebnisse gefunden');
                }
            } catch (err: any) {
                toast.error(`PartsLink24 Fehler: ${err.message}`);
            } finally {
                setFwdLoading(false);
            }
            return;
        }

        // ── Standard Hydra v2 Mode ──
        try {
            const result = await resolveOemForward({
                vehicle: {
                    make: fwdMake || undefined,
                    model: fwdModel || undefined,
                    vin: fwdVin || undefined,
                },
                part: fwdPart,
            });
            setFwdResult(result);
            if (result.success && result.oem) {
                toast.success(`OEM gefunden: ${result.oem}`);
            }
        } catch (err: any) {
            toast.error(err?.message || 'Suche fehlgeschlagen');
        } finally {
            setFwdLoading(false);
        }
    };

    // ── Approve ──
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

            setHistory(prev => [{
                oem: currentResult.oem,
                result: currentResult,
                approved: true,
                timestamp: new Date(),
            }, ...prev]);

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

    const quickOems = [
        { oem: '5Q0615301F', label: 'VW Bremsscheibe' },
        { oem: '34116864906', label: 'BMW Bremssattel' },
        { oem: 'A2044231300', label: 'Mercedes Querlenker' },
        { oem: '8K0615301B', label: 'Audi Bremsscheibe' },
        { oem: '1K0407151AC', label: 'VW Querlenker' },
    ];

    return (
        <div className="space-y-6">
            {/* Header + Mode Toggle */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
                        <div className="icon-box w-10 h-10 glow-primary">
                            <Search className="w-5 h-5" />
                        </div>
                        OEM Intelligence
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1.5 ml-[52px]">
                        {mode === 'reverse'
                            ? 'OEM-Nummer → KI identifiziert das Teil → Bestätigen → Ins Registry aufnehmen'
                            : mode === 'batch'
                                ? 'CSV importieren → Bot testet alle Zeilen → OEM-Ergebnisse exportieren'
                                : 'Fahrzeug + Teil → OEM-Nummer (Hydra v2: DB → CrossRef → AI → Validation)'}
                    </p>
                </div>

                <div className="flex bg-muted/50 rounded-xl p-1 gap-1 border border-border/50">
                    <button
                        onClick={() => setMode('forward')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            mode === 'forward'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Car className="w-4 h-4" />
                        Einzeltest
                    </button>
                    <button
                        onClick={() => setMode('reverse')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            mode === 'reverse'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Hash className="w-4 h-4" />
                        OEM → Teil
                    </button>
                    <button
                        onClick={() => setMode('batch')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            mode === 'batch'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Batch-Test
                    </button>
                    <button
                        onClick={() => setMode('errors')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all relative ${
                            mode === 'errors'
                                ? 'bg-warn text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Flag className="w-4 h-4" />
                        Fehler
                        {errorCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-destructive text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                                {errorCount > 99 ? '99+' : errorCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════
               FORWARD MODE: Vehicle + Part → OEM
            ═══════════════════════════════════════════ */}
            {mode === 'forward' && (
                <>
                    <div className="glass-card rounded-2xl p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* VIN */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-wider">
                                    VIN/FIN (optional)
                                </label>
                                <input
                                    value={fwdVin}
                                    onChange={(e) => setFwdVin(e.target.value.toUpperCase())}
                                    placeholder="WVWZZZAUZJP023456"
                                    className="w-full px-4 py-3 rounded-xl text-sm font-mono outline-none premium-input"
                                />
                            </div>

                            {/* Make */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-wider">
                                    Marke
                                </label>
                                <div className="relative">
                                    <Car className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        value={fwdMake}
                                        onChange={(e) => setFwdMake(e.target.value)}
                                        placeholder="z.B. Volkswagen"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none premium-input"
                                    />
                                </div>
                            </div>

                            {/* Model */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-wider">
                                    Modell
                                </label>
                                <input
                                    value={fwdModel}
                                    onChange={(e) => setFwdModel(e.target.value)}
                                    placeholder="z.B. Golf 7 GTI"
                                    className="w-full px-4 py-3 rounded-xl text-sm outline-none premium-input"
                                />
                            </div>

                            {/* Part */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-wider">
                                    Ersatzteil *
                                </label>
                                <div className="relative">
                                    <Wrench className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        value={fwdPart}
                                        onChange={(e) => setFwdPart(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleForwardSearch()}
                                        placeholder="z.B. Bremsscheibe vorne"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none premium-input"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* PartsLink24 Toggle */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/30">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setUsePartslink(!usePartslink)}
                                    className={`relative inline-flex h-7 w-[52px] items-center rounded-full transition-colors duration-200 focus:outline-none ${
                                        usePartslink ? 'bg-amber-500' : 'bg-muted'
                                    }`}
                                >
                                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                                        usePartslink ? 'translate-x-[28px]' : 'translate-x-1'
                                    }`} />
                                </button>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold ${usePartslink ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                        PartsLink24
                                    </span>
                                    {usePartslink && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                            plAvailable === true ? 'bg-emerald-100 text-emerald-700' :
                                            plAvailable === false ? 'bg-red-100 text-red-700' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>
                                            {plAvailable === true ? '● Online' : plAvailable === false ? '● Offline' : '● Prüfe...'}
                                        </span>
                                    )}
                                </div>
                                {usePartslink && (
                                    <span className="text-xs text-muted-foreground">
                                        Echte Katalogdaten · VIN erforderlich
                                    </span>
                                )}
                            </div>
                        </div>

                        <motion.button
                            onClick={handleForwardSearch}
                            disabled={fwdLoading || !fwdPart.trim() || (usePartslink && plAvailable === false)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`px-6 py-3.5 !rounded-xl disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto ${
                                usePartslink ? 'bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-sm flex items-center gap-2' : 'btn-brand'
                            }`}
                        >
                            {fwdLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : usePartslink ? <Database className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                            {usePartslink ? 'PartsLink24 Katalog abfragen' : 'OEM-Nummer suchen (Hydra v2)'}
                        </motion.button>
                    </div>

                    {/* Forward Loading */}
                    <AnimatePresence>
                        {fwdLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="stat-card p-8 flex flex-col items-center gap-3"
                            >
                                <div className={`icon-box w-12 h-12 ${usePartslink ? 'bg-amber-500 shadow-amber-500/30 shadow-lg' : 'glow-primary'}`}>
                                    {usePartslink ? <Database className="w-6 h-6 text-white animate-pulse" /> : <Sparkles className="w-6 h-6 animate-pulse" />}
                                </div>
                                <p className="text-foreground font-semibold">
                                    {usePartslink ? 'PartsLink24 wird abgefragt...' : 'Hydra v2 Pipeline läuft...'}
                                </p>
                                <p className="text-muted-foreground text-xs font-mono">
                                    {usePartslink ? 'Browser → Login → VIN → Katalog → Extraktion' : 'DB → CrossRef → AI Search (Gemini) → Validation → Self-Learning'}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* PartsLink24 Results */}
                    <AnimatePresence>
                        {plResult && !fwdLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                {plResult.success && plResult.results.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Database className="w-4 h-4 text-amber-600" />
                                            <span className="text-sm font-bold text-amber-600">PartsLink24 Ergebnisse</span>
                                            <span className="text-xs text-muted-foreground">
                                                · {plResult.elapsedMs ? `${(plResult.elapsedMs / 1000).toFixed(1)}s` : ''}
                                                {plResult.fromCache && ' · aus Cache'}
                                            </span>
                                        </div>
                                        {plResult.results.map((r, i) => (
                                            <div key={i} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-white font-black text-sm">{i + 1}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <code className="text-2xl font-mono font-extrabold text-foreground">{r.oem}</code>
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 font-bold uppercase">Katalog</span>
                                                        </div>
                                                        {r.description && (
                                                            <p className="text-sm text-muted-foreground">{r.description}</p>
                                                        )}
                                                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                                            {r.bildtafel && <span>Bildtafel: <strong>{r.bildtafel}</strong></span>}
                                                            {r.hg && <span>HG: <strong>{r.hg}</strong></span>}
                                                            {r.fg && <span>FG: <strong>{r.fg}</strong></span>}
                                                        </div>
                                                        <div className="flex gap-2 mt-3">
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        await approveOemResult({
                                                                            oem: r.oem.replace(/\s/g, ''),
                                                                            brand: fwdMake || 'UNKNOWN',
                                                                            model: fwdModel,
                                                                            part_category: fwdPart,
                                                                            part_description: r.description || fwdPart,
                                                                            confidence: 0.99,
                                                                        });
                                                                        toast.success(`✅ ${r.oem} in DB übernommen (99% — Katalogdaten)`);
                                                                    } catch (err: any) { toast.error(`Fehler: ${err.message}`); }
                                                                }}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-success-light text-success border border-brand/30 hover:bg-success/20 transition-colors"
                                                            >
                                                                <CheckCircle className="w-3 h-3" /> In DB übernehmen
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-danger-light border border-destructive/15 rounded-2xl p-6 flex items-start gap-4">
                                        <XCircle className="w-8 h-8 text-danger flex-shrink-0 mt-0.5" />
                                        <div>
                                            <div className="font-bold text-danger mb-1">PartsLink24: Keine Ergebnisse</div>
                                            <div className="text-sm text-muted-foreground">
                                                {plResult.error || 'Kein Treffer im Katalog für diese Kombination.'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Forward Result */}
                    <AnimatePresence>
                        {fwdResult && !fwdLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                {fwdResult.success && fwdResult.oem ? (
                                    <div className="space-y-4">
                                        {/* Primary result */}
                                        <div className="bg-success-light border border-brand/15 rounded-2xl p-6">
                                            <div className="flex items-start gap-4">
                                                <div className="icon-box w-12 h-12 glow-primary">
                                                    <CheckCircle className="w-6 h-6 text-white" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <Hash className="w-4 h-4 text-muted-foreground" />
                                                        <span className="text-3xl font-mono font-bold text-foreground">{fwdResult.oem}</span>
                                                    </div>
                                                    <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
                                                        <span>Confidence: <strong className={fwdResult.confidence >= 80 ? 'text-success' : 'text-warn'}>
                                                            {fwdResult.confidence}%
                                                        </strong></span>
                                                        {fwdResult.notes && <span>· {fwdResult.notes}</span>}
                                                    </div>
                                                    <div className="flex gap-2 mt-3">
                                                        <button
                                                            onClick={() => {
                                                                addErrors([{
                                                                    id: `err-${Date.now()}`,
                                                                    make: fwdMake, model: fwdModel, year: '', motor: '', vin: fwdVin,
                                                                    part: fwdPart, oem: fwdResult!.oem, confidence: fwdResult!.confidence ? fwdResult!.confidence / 100 : null,
                                                                    source: 'forward', addedAt: new Date().toISOString(), status: 'pending',
                                                                }]);
                                                                toast.success('⚠️ Zur Fehlerliste hinzugefügt');
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-warn-light text-warn border border-warn/30 hover:bg-warn/20 transition-colors"
                                                        >
                                                            <Flag className="w-3 h-3" /> Als Fehler markieren
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await approveOemResult({
                                                                        oem: fwdResult!.oem!, brand: fwdMake, model: fwdModel,
                                                                        part_category: fwdPart, part_description: fwdPart, confidence: (fwdResult!.confidence || 90) / 100,
                                                                    });
                                                                    toast.success(`✅ ${fwdResult!.oem} in DB übernommen`);
                                                                } catch (err: any) { toast.error(`Fehler: ${err.message}`); }
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-success-light text-success border border-brand/30 hover:bg-success/20 transition-colors"
                                                        >
                                                            <CheckCircle className="w-3 h-3" /> In DB übernehmen
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Candidates */}
                                        {fwdResult.candidates && fwdResult.candidates.length > 0 && (
                                            <div className="bg-card border border-border/50 rounded-2xl p-6">
                                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                                                    Alle Kandidaten ({fwdResult.candidates.length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {fwdResult.candidates.map((c, i) => (
                                                        <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/30 hover:bg-muted/40 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                                                    {i + 1}
                                                                </span>
                                                                <code className="font-mono font-bold text-sm">{c.oem}</code>
                                                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{c.brand}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-xs">
                                                                <span className="text-muted-foreground font-mono">{c.source}</span>
                                                                <span className={`font-bold ${c.confidence >= 80 ? 'text-success' : c.confidence >= 50 ? 'text-warn' : 'text-danger'}`}>
                                                                    {c.confidence}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-danger-light border border-destructive/15 rounded-2xl p-6 flex items-start gap-4">
                                        <XCircle className="w-8 h-8 text-danger flex-shrink-0 mt-0.5" />
                                        <div>
                                            <div className="font-bold text-danger mb-1">Keine OEM-Nummer gefunden</div>
                                            <div className="text-sm text-muted-foreground">
                                                {fwdResult.notes || 'Hydra v2 konnte keine passende Nummer finden.'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}

            {/* ═══════════════════════════════════════════
               REVERSE MODE: OEM → Part (existing + approve)
            ═══════════════════════════════════════════ */}
            {mode === 'reverse' && (
                <>
                    {/* Search Bar */}
                    <div className="glass-card rounded-2xl p-6 space-y-4">
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => e.key === 'Enter' && handleReverseLookup()}
                                    placeholder="OEM-Nummer eingeben (z.B. 5Q0615301F)"
                                    className="w-full pl-12 pr-4 py-3.5 rounded-xl text-lg font-mono outline-none transition-all premium-input !text-lg"
                                    disabled={reverseLoading}
                                />
                            </div>
                            <motion.button
                                onClick={handleReverseLookup}
                                disabled={reverseLoading || searchInput.trim().length < 3}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="btn-brand px-6 py-3.5 !rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {reverseLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
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
                        {reverseLoading && (
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
                        {currentResult && !reverseLoading && (
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
                                                    <Wrench className="w-4 h-4 text-muted-foreground" />
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
                                <ArrowLeftRight className="w-4 h-4" />
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
                    {!currentResult && !reverseLoading && history.length === 0 && (
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
                </>
            )}

            {/* ═══════════════════════════════════════════
               BATCH MODE: CSV → Pipeline → Results
            ═══════════════════════════════════════════ */}
            {mode === 'batch' && <OemBatchTest />}

            {/* ═══════════════════════════════════════════
               ERRORS MODE: Review flagged OEM results
            ═══════════════════════════════════════════ */}
            {mode === 'errors' && <OemErrorReview />}
        </div>
    );
}

export default OemLookupView;
