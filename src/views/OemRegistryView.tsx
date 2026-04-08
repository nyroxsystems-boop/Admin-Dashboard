import { useState, useEffect, useCallback } from 'react';
import {
    Search, RefreshCcw, Plus, Trash2, Edit2, Save, X, ChevronLeft, ChevronRight,
    Database, Filter, AlertTriangle, CheckCircle, Loader2, Download, Car
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
    getOemRecords, updateOemRecord, createOemRecord, deleteOemRecord,
    bulkDeleteOemRecords, runOemValidator, searchOemByVin,
    OemRecord, OemRecordsResponse, VinDecodedInfo
} from '../api/wws';
import { toast } from 'sonner';

// ============================================================================
// OEM Registry View - Full CRUD Management
// ============================================================================

export function OemRegistryView() {
    // Data State
    const [data, setData] = useState<OemRecordsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    // Search & Filter State
    const [search, setSearch] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [modelCodeFilter, setModelCodeFilter] = useState('');
    const [yearFilter, setYearFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const [limit] = useState(50);

    // VIN Search State — when set, overrides the normal filter-based listing
    const [vinQuery, setVinQuery] = useState('');
    const [vinDecoded, setVinDecoded] = useState<VinDecodedInfo | null>(null);
    const [vinSearching, setVinSearching] = useState(false);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Modal State
    const [editingRecord, setEditingRecord] = useState<OemRecord | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // Validator State
    const [validating, setValidating] = useState(false);

    // Form State for Create/Edit
    const [formData, setFormData] = useState({
        oem: '',
        brand: '',
        part_category: '',
        part_description: '',
        model: '',
        confidence: 0.9
    });

    // Load Data
    const loadData = useCallback(async () => {
        // Skip normal loading while a VIN result is displayed —
        // the VIN search populates `data` separately
        if (vinDecoded) return;
        try {
            setLoading(true);
            const result = await getOemRecords({
                page,
                limit,
                search: search || undefined,
                brand: brandFilter || undefined,
                category: categoryFilter || undefined,
                modelCode: modelCodeFilter || undefined,
                year: yearFilter ? parseInt(yearFilter) : undefined,
                sortBy: 'oem',
                sortOrder: 'asc'
            });
            setData(result);
        } catch (err: any) {
            toast.error('Fehler beim Laden der OEM-Daten');
        } finally {
            setLoading(false);
        }
    }, [page, limit, search, brandFilter, categoryFilter, modelCodeFilter, yearFilter, vinDecoded]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // VIN search
    const handleVinSearch = async () => {
        const vin = vinQuery.trim().toUpperCase();
        if (vin.length < 11) {
            toast.error('VIN muss mindestens 11 Zeichen haben');
            return;
        }
        setVinSearching(true);
        try {
            const result = await searchOemByVin(vin, { limit: 500 });
            setVinDecoded(result.decoded);
            // Adapt VIN response into the OemRecordsResponse shape the table expects
            setData({
                records: result.records,
                total: result.total,
                page: 1,
                limit: result.records.length,
                totalPages: 1,
                filters: data?.filters || { brands: [], categories: [] },
            });
            toast.success(`${result.decoded.brand || '?'} ${result.decoded.year || ''} — ${result.total} OEMs gefunden`);
        } catch (err: any) {
            toast.error(err?.message || 'VIN-Suche fehlgeschlagen');
        } finally {
            setVinSearching(false);
        }
    };

    const clearVinSearch = () => {
        setVinDecoded(null);
        setVinQuery('');
        // Trigger normal reload via loadData's dependency on vinDecoded
    };

    // Debounced search — only reset page; loadData triggers via useCallback dependency chain
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Actions
    const handleEdit = (record: OemRecord) => {
        setEditingRecord(record);
        setFormData({
            oem: record.oem,
            brand: record.brand,
            part_category: record.part_category,
            part_description: record.part_description || '',
            model: record.model || '',
            confidence: record.confidence
        });
    };

    const handleSave = async () => {
        if (!editingRecord) return;

        setSaving(true);
        try {
            await updateOemRecord(editingRecord.id, formData);
            toast.success('OEM-Eintrag aktualisiert');
            setEditingRecord(null);
            loadData();
        } catch (err: any) {
            toast.error('Fehler beim Speichern');
        } finally {
            setSaving(false);
        }
    };

    const handleCreate = async () => {
        if (!formData.oem || !formData.brand) {
            toast.error('OEM und Marke sind Pflichtfelder');
            return;
        }

        setSaving(true);
        try {
            await createOemRecord(formData as any);
            toast.success('OEM-Eintrag erstellt');
            setShowCreateModal(false);
            setFormData({ oem: '', brand: '', part_category: '', part_description: '', model: '', confidence: 0.9 });
            loadData();
        } catch (err: any) {
            toast.error('Fehler beim Erstellen');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Diesen OEM-Eintrag wirklich löschen?')) return;

        try {
            await deleteOemRecord(id);
            toast.success('OEM-Eintrag gelöscht');
            loadData();
        } catch (err: any) {
            toast.error('Fehler beim Löschen');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`${selectedIds.size} OEM-Einträge wirklich löschen?`)) return;

        try {
            await bulkDeleteOemRecords(Array.from(selectedIds));
            toast.success(`${selectedIds.size} Einträge gelöscht`);
            setSelectedIds(new Set());
            loadData();
        } catch (err: any) {
            toast.error('Fehler beim Löschen');
        }
    };

    const handleRunValidator = async (fix: boolean) => {
        setValidating(true);
        try {
            const result = await runOemValidator(fix);
            toast.success(result.message);
            // Reload after delay
            setTimeout(() => loadData(), 3000);
        } catch (err: any) {
            toast.error('Validator-Fehler');
        } finally {
            setValidating(false);
        }
    };

    const toggleSelectAll = () => {
        if (!data?.records?.length) return;
        if (selectedIds.size === data.records.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(data.records.map(r => r.id)));
        }
    };

    const toggleSelect = (id: number) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedIds(newSelection);
    };

    // Render
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Database className="w-6 h-6 text-primary" />
                        OEM Registry
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {data?.total.toLocaleString() || 0} Einträge • Seite {page} von {data?.totalPages || 1}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleRunValidator(false)}
                        disabled={validating}
                        className="flex items-center gap-2 px-3 py-2 bg-warn-light hover:bg-warn-light text-warn rounded-lg text-sm font-medium transition-all"
                    >
                        {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                        Prüfen
                    </button>
                    <button
                        onClick={() => handleRunValidator(true)}
                        disabled={validating}
                        className="flex items-center gap-2 px-3 py-2 bg-danger-light hover:bg-danger-light text-danger rounded-lg text-sm font-medium transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                        Bereinigen
                    </button>
                    <button
                        onClick={() => { setShowCreateModal(true); setFormData({ oem: '', brand: '', part_category: '', part_description: '', model: '', confidence: 0.9 }); }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/25 transition-all hover:shadow-xl"
                    >
                        <Plus className="w-4 h-4" />
                        Neuer Eintrag
                    </button>
                </div>
            </div>

            {/* VIN Search Panel */}
            <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Car className="w-4 h-4 text-primary" />
                    Suche per Fahrgestellnummer (VIN)
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="z.B. WAUZZZ8V6FA123456"
                        value={vinQuery}
                        onChange={(e) => setVinQuery(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').substring(0, 17))}
                        onKeyDown={(e) => e.key === 'Enter' && handleVinSearch()}
                        maxLength={17}
                        className="flex-1 px-4 py-2.5 bg-muted/50 border border-transparent focus:border-primary/50 rounded-xl font-mono text-sm outline-none"
                    />
                    <button
                        onClick={handleVinSearch}
                        disabled={vinSearching || vinQuery.length < 11}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium shadow-md shadow-primary/20 disabled:opacity-50 hover:opacity-90"
                    >
                        {vinSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Decodieren & Suchen
                    </button>
                    {vinDecoded && (
                        <button
                            onClick={clearVinSearch}
                            className="px-4 py-2.5 bg-muted hover:bg-muted/80 rounded-xl font-medium"
                        >
                            Zurück zur Liste
                        </button>
                    )}
                </div>

                {vinDecoded && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
                        <span className="text-xs text-muted-foreground">Dekodiert:</span>
                        {vinDecoded.brand && (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-bold">
                                {vinDecoded.brand}
                            </span>
                        )}
                        {vinDecoded.year && (
                            <span className="px-2 py-0.5 bg-muted text-foreground rounded text-xs font-mono">
                                {vinDecoded.year}
                            </span>
                        )}
                        {vinDecoded.group && (
                            <span className="px-2 py-0.5 bg-muted text-foreground rounded text-xs">
                                {vinDecoded.group}
                            </span>
                        )}
                        {vinDecoded.nhtsaModel && (
                            <span className="px-2 py-0.5 bg-muted text-foreground rounded text-xs">
                                {vinDecoded.nhtsaModel}
                            </span>
                        )}
                        {vinDecoded.nhtsaEngine && (
                            <span className="px-2 py-0.5 bg-muted text-foreground rounded text-xs">
                                Motor: {vinDecoded.nhtsaEngine}
                            </span>
                        )}
                        {vinDecoded.motorcode && (
                            <span className="px-2 py-0.5 bg-muted text-foreground rounded text-xs font-mono">
                                MCode: {vinDecoded.motorcode}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Search & Filters */}
            <div className={`flex flex-col md:flex-row gap-4 ${vinDecoded ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Suche nach OEM, Beschreibung, Modell..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                </div>

                <select
                    value={brandFilter}
                    onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                    className="px-4 py-2.5 bg-card border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none min-w-[150px]"
                >
                    <option value="">Alle Marken</option>
                    {(data?.filters?.brands || []).map(b => (
                        <option key={b} value={b}>{b}</option>
                    ))}
                </select>

                <select
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                    className="px-4 py-2.5 bg-card border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none min-w-[150px]"
                >
                    <option value="">Alle Kategorien</option>
                    {(data?.filters?.categories || []).map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>

                <select
                    value={modelCodeFilter}
                    onChange={(e) => { setModelCodeFilter(e.target.value); setPage(1); }}
                    className="px-4 py-2.5 bg-card border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none min-w-[130px]"
                >
                    <option value="">Alle Modellcodes</option>
                    {(data?.filters?.modelCodes || []).map(mc => (
                        <option key={mc} value={mc}>{mc}</option>
                    ))}
                </select>

                <input
                    type="number"
                    placeholder="Jahr"
                    value={yearFilter}
                    onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
                    min="1990"
                    max="2030"
                    className="w-24 px-3 py-2.5 bg-card border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                />

                <button
                    onClick={loadData}
                    disabled={loading}
                    className="p-2.5 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
                >
                    <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl"
                >
                    <span className="font-medium">{selectedIds.size} ausgewählt</span>
                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 px-3 py-1.5 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Alle löschen
                    </button>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        Auswahl aufheben
                    </button>
                </motion.div>
            )}

            {/* Table */}
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-muted/40 border-b border-border/50">
                                <th className="w-10 px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === data?.records.length && data?.records.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-border"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">OEM</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">Marke</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">Kategorie</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">Beschreibung</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">Modell</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">Code</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">Jahre</th>
                                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-muted-foreground">Konfidenz</th>
                                <th className="px-4 py-3 text-right text-xs font-bold uppercase text-muted-foreground">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Laden...
                                    </td>
                                </tr>
                            ) : data?.records.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                                        Keine OEM-Einträge gefunden
                                    </td>
                                </tr>
                            ) : (
                                data?.records.map((record) => (
                                    <tr key={record.id} className="hover:bg-muted/20 transition-colors group">
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(record.id)}
                                                onChange={() => toggleSelect(record.id)}
                                                className="w-4 h-4 rounded border-border"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{record.oem}</code>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-bold">{record.brand}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{record.part_category || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[200px]">{record.part_description || '-'}</td>
                                        <td className="px-4 py-3 text-sm">{record.model || '-'}</td>
                                        <td className="px-4 py-3 text-sm font-mono">
                                            {record.model_code
                                                ? <span className="px-1.5 py-0.5 bg-muted rounded text-xs">{record.model_code}</span>
                                                : <span className="text-muted-foreground">-</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                                            {record.year_from || record.year_to
                                                ? `${record.year_from || '?'}–${record.year_to || '?'}`
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${record.confidence >= 0.8 ? 'bg-success-light text-success' :
                                                record.confidence >= 0.5 ? 'bg-warn-light text-warn' :
                                                    'bg-danger-light text-danger'
                                                }`}>
                                                {record.confidence >= 0.8 ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                                {Math.round(record.confidence * 100)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(record)}
                                                    className="p-2 hover:bg-primary hover:text-white rounded-lg transition-colors text-muted-foreground"
                                                    title="Bearbeiten"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(record.id)}
                                                    className="p-2 hover:bg-danger hover:text-white rounded-lg transition-colors text-muted-foreground"
                                                    title="Löschen"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {data && data.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20">
                        <div className="text-sm text-muted-foreground">
                            Zeige {((page - 1) * limit) + 1} - {Math.min(page * limit, data.total)} von {data.total.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 hover:bg-muted rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="px-3 py-1 bg-muted rounded-lg text-sm font-medium">
                                {page} / {data.totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                                disabled={page === data.totalPages}
                                className="p-2 hover:bg-muted rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {(editingRecord || showCreateModal) && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border/50 overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/20">
                                <h3 className="font-bold text-lg">
                                    {editingRecord ? 'OEM bearbeiten' : 'Neuer OEM-Eintrag'}
                                </h3>
                                <button
                                    onClick={() => { setEditingRecord(null); setShowCreateModal(false); }}
                                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">OEM Nummer *</label>
                                        <input
                                            value={formData.oem}
                                            onChange={(e) => setFormData(f => ({ ...f, oem: e.target.value.toUpperCase() }))}
                                            className="w-full px-4 py-2.5 bg-muted/50 border border-transparent focus:border-primary/50 rounded-xl font-mono"
                                            placeholder="5Q0615301F"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Marke *</label>
                                        <input
                                            value={formData.brand}
                                            onChange={(e) => setFormData(f => ({ ...f, brand: e.target.value.toUpperCase() }))}
                                            className="w-full px-4 py-2.5 bg-muted/50 border border-transparent focus:border-primary/50 rounded-xl"
                                            placeholder="VOLKSWAGEN"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Kategorie</label>
                                        <input
                                            value={formData.part_category}
                                            onChange={(e) => setFormData(f => ({ ...f, part_category: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-muted/50 border border-transparent focus:border-primary/50 rounded-xl"
                                            placeholder="brake"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Modell</label>
                                        <input
                                            value={formData.model}
                                            onChange={(e) => setFormData(f => ({ ...f, model: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-muted/50 border border-transparent focus:border-primary/50 rounded-xl"
                                            placeholder="Golf 7"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Beschreibung</label>
                                    <input
                                        value={formData.part_description}
                                        onChange={(e) => setFormData(f => ({ ...f, part_description: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-transparent focus:border-primary/50 rounded-xl"
                                        placeholder="Bremsscheibe vorne 312x25mm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Konfidenz: {Math.round(formData.confidence * 100)}%</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={formData.confidence}
                                        onChange={(e) => setFormData(f => ({ ...f, confidence: parseFloat(e.target.value) }))}
                                        className="w-full"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        onClick={() => { setEditingRecord(null); setShowCreateModal(false); }}
                                        className="px-5 py-2.5 rounded-xl font-medium hover:bg-muted transition-colors"
                                    >
                                        Abbrechen
                                    </button>
                                    <button
                                        onClick={editingRecord ? handleSave : handleCreate}
                                        disabled={saving}
                                        className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {editingRecord ? 'Speichern' : 'Erstellen'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default OemRegistryView;
