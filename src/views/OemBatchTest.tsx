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
    FileSpreadsheet, Dice5, Database, Flag
} from 'lucide-react';
import { toast } from 'sonner';
import { resolveOemForward, approveOemResult } from '../api/wws';
import { addErrors, type ErrorItem } from './OemErrorReview';

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
    { make: 'VW', model: 'Golf VII', year: '2017', motor: 'DFGA', vin: 'WVWZZZ1KZHW123456', part: 'Bremsscheibe vorne', difficulty: 'easy' },
    { make: 'VW', model: 'Golf VII', year: '2016', motor: 'CRLB', vin: 'WVWZZZ1KZGW234567', part: 'Ölfilter', difficulty: 'easy' },
    { make: 'BMW', model: '3er F30', year: '2016', motor: 'B47', vin: 'WBA8E11050G567890', part: 'Bremsbelag vorne', difficulty: 'easy' },
    { make: 'BMW', model: '3er F30', year: '2017', motor: 'B47', vin: 'WBA8E11060H678901', part: 'Luftfilter', difficulty: 'easy' },
    { make: 'MERCEDES', model: 'C-Klasse W205', year: '2016', motor: 'OM654', vin: 'WDD2050041R234567', part: 'Bremsscheibe hinten', difficulty: 'easy' },
    { make: 'AUDI', model: 'A4 B9', year: '2017', motor: 'DETA', vin: 'WAUZZZF40HA012345', part: 'Ölfilter', difficulty: 'easy' },
    { make: 'OPEL', model: 'Astra K', year: '2017', motor: 'B14XFT', vin: 'W0LBD8EA1H8012345', part: 'Bremsbelag hinten', difficulty: 'easy' },
    { make: 'FORD', model: 'Focus IV', year: '2019', motor: 'M1DA', vin: 'WF0XXXGCHXKY12345', part: 'Luftfilter', difficulty: 'easy' },
    { make: 'VW', model: 'Passat B8', year: '2017', motor: 'DFGA', vin: 'WVWZZZ3CZHP345678', part: 'Bremsscheibe vorne', difficulty: 'easy' },
    { make: 'VW', model: 'Tiguan II', year: '2018', motor: 'DFGA', vin: 'WVGZZZ5NZJW456789', part: 'Bremsbelag vorne', difficulty: 'easy' },

    // 🟡 MEDIUM (10) — Platform-specific, less common parts
    { make: 'BMW', model: '5er G30', year: '2018', motor: 'B57', vin: 'WBAJC51060G789012', part: 'Turbolader', difficulty: 'medium' },
    { make: 'VW', model: 'Golf VII', year: '2015', motor: 'CHHB', vin: 'WVWZZZ1KZFW567890', part: 'Kupplung', difficulty: 'medium' },
    { make: 'MERCEDES', model: 'E-Klasse W213', year: '2017', motor: 'OM654', vin: 'WDD2130041A890123', part: 'Stoßdämpfer vorne', difficulty: 'medium' },
    { make: 'AUDI', model: 'Q5 FY', year: '2018', motor: 'DTUA', vin: 'WAUZZZFY9JA901234', part: 'Querlenker vorne links', difficulty: 'medium' },
    { make: 'BMW', model: 'X3 G01', year: '2018', motor: 'B47', vin: 'WBATX71060L012345', part: 'Wasserpumpe', difficulty: 'medium' },
    { make: 'VW', model: 'Passat B8', year: '2016', motor: 'DFHA', vin: 'WVWZZZ3CZGP123456', part: 'Lichtmaschine', difficulty: 'medium' },
    { make: 'OPEL', model: 'Insignia B', year: '2018', motor: 'B20DTH', vin: 'W0LGA8EM5J1234567', part: 'Klimakompressor', difficulty: 'medium' },
    { make: 'FORD', model: 'Kuga II', year: '2017', motor: 'T7CL', vin: 'WF0XXXGCDXHB23456', part: 'Radlager vorne', difficulty: 'medium' },
    { make: 'MERCEDES', model: 'GLC X253', year: '2017', motor: 'OM654', vin: 'WDC2539041F345678', part: 'Thermostat', difficulty: 'medium' },
    { make: 'AUDI', model: 'A3 8V', year: '2016', motor: 'DFGA', vin: 'WAUZZZGF7GA456789', part: 'Spurstange', difficulty: 'medium' },

    // 🔴 HARD (5) — Niche parts, specific sub-assemblies
    { make: 'BMW', model: '3er F30', year: '2015', motor: 'N57', vin: 'WBA3E31050F567890', part: 'Nockenwellensensor Einlass', difficulty: 'hard' },
    { make: 'VW', model: 'Golf VII', year: '2014', motor: 'CRLB', vin: 'WVWZZZ1KZEW678901', part: 'AGR-Ventil', difficulty: 'hard' },
    { make: 'MERCEDES', model: 'C-Klasse W205', year: '2017', motor: 'M276', vin: 'WDD2050491R789012', part: 'Ansaugkrümmer', difficulty: 'hard' },
    { make: 'AUDI', model: 'A4 B9', year: '2016', motor: 'CVKB', vin: 'WAUZZZF44GA890123', part: 'Steuerkettensatz', difficulty: 'hard' },
    { make: 'BMW', model: '5er G30', year: '2017', motor: 'B58', vin: 'WBAJC11060G901234', part: 'Differentialsperre', difficulty: 'hard' },

    // 🟣 EXOTIC (5) — Rare models, unusual brands
    { make: 'PORSCHE', model: 'Macan 95B', year: '2019', motor: '', vin: 'WP1ZZZ95ZKB012345', part: 'Bremsscheibe vorne', difficulty: 'exotic' },
    { make: 'HYUNDAI', model: 'Tucson TL', year: '2017', motor: 'D4HA', vin: 'TMAJ3812AHJ123456', part: 'Turbolader', difficulty: 'exotic' },
    { make: 'TOYOTA', model: 'Corolla E210', year: '2019', motor: '2ZR-FXE', vin: 'SB1K83BE60E234567', part: 'Wasserpumpe', difficulty: 'exotic' },
    { make: 'RENAULT', model: 'Mégane IV', year: '2017', motor: 'K9K', vin: 'VF1RFB00X57345678', part: 'Klimakompressor', difficulty: 'exotic' },
    { make: 'TESLA', model: 'Model 3', year: '2019', motor: '', vin: '5YJ3E1EA1KF456789', part: 'Bremsbelag vorne', difficulty: 'exotic' },
];

function createId() {
    return `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

function presetToRow(preset: typeof PRESET_DATA[number]): BatchRow {
    return { ...preset, id: createId(), oem: null, confidence: null, resolvedBy: null, elapsed: null, status: 'pending' };
}

// ═══════════════════════════════════════════════════════════════════
// 🎲 Random Vehicle + Part Generator
// ═══════════════════════════════════════════════════════════════════

interface VehiclePool {
    make: string;
    models: { name: string; yearFrom: number; yearTo: number; engines: string[]; vinPrefix: string }[];
}

const VEHICLE_POOL: VehiclePool[] = [
    { make: 'VW', models: [
        { name: 'Golf VII', yearFrom: 2012, yearTo: 2020, engines: ['DFGA', 'CRLB', 'CHHB', 'CZCA', 'DFHA', 'CHZJ'], vinPrefix: 'WVWZZZ1KZ' },
        { name: 'Golf VIII', yearFrom: 2020, yearTo: 2025, engines: ['DTGA', 'DFKA', 'DLBA'], vinPrefix: 'WVWZZZ1UZ' },
        { name: 'Passat B8', yearFrom: 2014, yearTo: 2023, engines: ['DFGA', 'DFHA', 'CZCA'], vinPrefix: 'WVWZZZ3CZ' },
        { name: 'Tiguan II', yearFrom: 2016, yearTo: 2024, engines: ['DFGA', 'DFHA', 'CZPA'], vinPrefix: 'WVGZZZ5NZ' },
        { name: 'T-Roc', yearFrom: 2017, yearTo: 2024, engines: ['DFGA', 'DKRA', 'CZCA'], vinPrefix: 'WVGZZZ2GZ' },
        { name: 'Polo VI', yearFrom: 2017, yearTo: 2024, engines: ['CZCA', 'DKLA'], vinPrefix: 'WVWZZZ6RZ' },
    ]},
    { make: 'BMW', models: [
        { name: '3er F30', yearFrom: 2012, yearTo: 2019, engines: ['B47', 'N47', 'N20', 'N57', 'B48'], vinPrefix: 'WBA8E110' },
        { name: '3er G20', yearFrom: 2019, yearTo: 2025, engines: ['B47', 'B48', 'B58'], vinPrefix: 'WBA5U110' },
        { name: '5er G30', yearFrom: 2017, yearTo: 2023, engines: ['B57', 'B58', 'B47', 'B48'], vinPrefix: 'WBAJC510' },
        { name: 'X3 G01', yearFrom: 2017, yearTo: 2023, engines: ['B47', 'B48', 'B58'], vinPrefix: 'WBATX710' },
        { name: 'X1 F48', yearFrom: 2015, yearTo: 2022, engines: ['B47', 'B38', 'B48'], vinPrefix: 'WBAHT110' },
        { name: '1er F40', yearFrom: 2019, yearTo: 2025, engines: ['B47', 'B48'], vinPrefix: 'WBA7C110' },
    ]},
    { make: 'MERCEDES', models: [
        { name: 'C-Klasse W205', yearFrom: 2014, yearTo: 2021, engines: ['OM654', 'M274', 'M276', 'OM651'], vinPrefix: 'WDD20500' },
        { name: 'E-Klasse W213', yearFrom: 2016, yearTo: 2023, engines: ['OM654', 'M256', 'M274'], vinPrefix: 'WDD21300' },
        { name: 'GLC X253', yearFrom: 2015, yearTo: 2022, engines: ['OM654', 'M274', 'M276'], vinPrefix: 'WDC25390' },
        { name: 'A-Klasse W177', yearFrom: 2018, yearTo: 2025, engines: ['OM608', 'M282', 'M260'], vinPrefix: 'WDD17700' },
    ]},
    { make: 'AUDI', models: [
        { name: 'A4 B9', yearFrom: 2015, yearTo: 2023, engines: ['DETA', 'CVKB', 'DFGA', 'CZHA'], vinPrefix: 'WAUZZZF4' },
        { name: 'A3 8V', yearFrom: 2012, yearTo: 2020, engines: ['DFGA', 'CRLB', 'CHHB', 'CZCA'], vinPrefix: 'WAUZZZGF' },
        { name: 'Q5 FY', yearFrom: 2017, yearTo: 2024, engines: ['DTUA', 'DFGA', 'DAXB'], vinPrefix: 'WAUZZZFY' },
        { name: 'Q3 F3', yearFrom: 2019, yearTo: 2024, engines: ['DFGA', 'DKTA', 'CZPA'], vinPrefix: 'WAUZZZF5' },
    ]},
    { make: 'OPEL', models: [
        { name: 'Astra K', yearFrom: 2015, yearTo: 2022, engines: ['B14XFT', 'B16DTH', 'B16SHT'], vinPrefix: 'W0LBD8EA' },
        { name: 'Insignia B', yearFrom: 2017, yearTo: 2022, engines: ['B20DTH', 'B16SHT'], vinPrefix: 'W0LGA8EM' },
        { name: 'Corsa F', yearFrom: 2019, yearTo: 2024, engines: ['F12XHL', 'F12XHT'], vinPrefix: 'W0VF6800' },
    ]},
    { make: 'FORD', models: [
        { name: 'Focus IV', yearFrom: 2018, yearTo: 2024, engines: ['M1DA', 'M2DA', 'XWDB'], vinPrefix: 'WF0XXXGCH' },
        { name: 'Kuga II', yearFrom: 2012, yearTo: 2020, engines: ['T7CL', 'JTMA', 'XWDB'], vinPrefix: 'WF0XXXGCD' },
        { name: 'Fiesta VIII', yearFrom: 2017, yearTo: 2023, engines: ['M1DA', 'XWJB'], vinPrefix: 'WF0XXXGCE' },
    ]},
    { make: 'PORSCHE', models: [
        { name: 'Macan 95B', yearFrom: 2014, yearTo: 2024, engines: ['', 'CYP', 'DCB'], vinPrefix: 'WP1ZZZ95Z' },
        { name: 'Cayenne E3', yearFrom: 2018, yearTo: 2024, engines: ['', 'DJH'], vinPrefix: 'WP1ZZZ9YZ' },
    ]},
    { make: 'HYUNDAI', models: [
        { name: 'Tucson TL', yearFrom: 2015, yearTo: 2020, engines: ['D4HA', 'G4FJ', 'G4FD'], vinPrefix: 'TMAJ3812A' },
        { name: 'i30 PD', yearFrom: 2017, yearTo: 2023, engines: ['D4FC', 'G4FJ', 'G4LD'], vinPrefix: 'TMAJ381AA' },
    ]},
    { make: 'TOYOTA', models: [
        { name: 'Corolla E210', yearFrom: 2019, yearTo: 2024, engines: ['2ZR-FXE', 'M20A-FKS'], vinPrefix: 'SB1K83BE6' },
        { name: 'RAV4 XA50', yearFrom: 2019, yearTo: 2024, engines: ['A25A-FXS', 'M20A-FKS'], vinPrefix: 'JTMDA3FV0' },
    ]},
    { make: 'RENAULT', models: [
        { name: 'Mégane IV', yearFrom: 2016, yearTo: 2023, engines: ['K9K', 'H5F', 'M5M'], vinPrefix: 'VF1RFB00X' },
        { name: 'Clio V', yearFrom: 2019, yearTo: 2024, engines: ['H5F', 'K9K'], vinPrefix: 'VF1RJA00X' },
    ]},
    { make: 'TESLA', models: [
        { name: 'Model 3', yearFrom: 2019, yearTo: 2024, engines: [''], vinPrefix: '5YJ3E1EA' },
        { name: 'Model Y', yearFrom: 2020, yearTo: 2024, engines: [''], vinPrefix: '7SAYGDEE' },
    ]},
    { make: 'SKODA', models: [
        { name: 'Octavia III', yearFrom: 2012, yearTo: 2020, engines: ['DFGA', 'CRLB', 'CZCA', 'CHHB'], vinPrefix: 'TMBAG7NE' },
        { name: 'Superb III', yearFrom: 2015, yearTo: 2023, engines: ['DFGA', 'DFHA', 'CZPA'], vinPrefix: 'TMBAJ7NS' },
    ]},
];

interface PartPool {
    name: string;
    difficulty: 'easy' | 'medium' | 'hard';
}

const PARTS_POOL: PartPool[] = [
    // Easy — common wear parts
    { name: 'Bremsscheibe vorne', difficulty: 'easy' },
    { name: 'Bremsscheibe hinten', difficulty: 'easy' },
    { name: 'Bremsbelag vorne', difficulty: 'easy' },
    { name: 'Bremsbelag hinten', difficulty: 'easy' },
    { name: 'Ölfilter', difficulty: 'easy' },
    { name: 'Luftfilter', difficulty: 'easy' },
    { name: 'Pollenfilter', difficulty: 'easy' },
    { name: 'Kraftstofffilter', difficulty: 'easy' },
    { name: 'Zündkerze', difficulty: 'easy' },
    { name: 'Scheibenwischer vorne', difficulty: 'easy' },
    // Medium — suspension, cooling, steering
    { name: 'Stoßdämpfer vorne', difficulty: 'medium' },
    { name: 'Stoßdämpfer hinten', difficulty: 'medium' },
    { name: 'Querlenker vorne links', difficulty: 'medium' },
    { name: 'Querlenker vorne rechts', difficulty: 'medium' },
    { name: 'Spurstangenkopf außen', difficulty: 'medium' },
    { name: 'Radlager vorne', difficulty: 'medium' },
    { name: 'Radlager hinten', difficulty: 'medium' },
    { name: 'Koppelstange vorne', difficulty: 'medium' },
    { name: 'Wasserpumpe', difficulty: 'medium' },
    { name: 'Thermostat', difficulty: 'medium' },
    { name: 'Lichtmaschine', difficulty: 'medium' },
    { name: 'Klimakompressor', difficulty: 'medium' },
    { name: 'Kupplung', difficulty: 'medium' },
    { name: 'Turbolader', difficulty: 'medium' },
    { name: 'Anlasser', difficulty: 'medium' },
    { name: 'Keilrippenriemen', difficulty: 'medium' },
    // Hard — niche parts
    { name: 'Nockenwellensensor', difficulty: 'hard' },
    { name: 'Kurbelwellensensor', difficulty: 'hard' },
    { name: 'AGR-Ventil', difficulty: 'hard' },
    { name: 'Ansaugkrümmer', difficulty: 'hard' },
    { name: 'Steuerkettensatz', difficulty: 'hard' },
    { name: 'Differentialsperre', difficulty: 'hard' },
    { name: 'Öldrucksensor', difficulty: 'hard' },
    { name: 'Ladedrucksensor', difficulty: 'hard' },
    { name: 'DPF Differenzdrucksensor', difficulty: 'hard' },
    { name: 'EGR-Kühler', difficulty: 'hard' },
    { name: 'Dosierpumpe AdBlue', difficulty: 'hard' },
    { name: 'Ölpumpe', difficulty: 'hard' },
    { name: 'Einspritzdüse', difficulty: 'hard' },
    { name: 'Lambda-Sonde', difficulty: 'hard' },
];

const YEAR_CHARS = '0123456789ABCDEFGHJKLMNPRSTVWXY';
function randomVin(prefix: string): string {
    const yearIdx = Math.floor(Math.random() * 10);
    const serial = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
    return (prefix + YEAR_CHARS[yearIdx] + serial).slice(0, 17);
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomYear(from: number, to: number): number { return from + Math.floor(Math.random() * (to - from + 1)); }

function generateRandomRows(count: number): BatchRow[] {
    const rows: BatchRow[] = [];
    for (let i = 0; i < count; i++) {
        const brand = pick(VEHICLE_POOL);
        const model = pick(brand.models);
        const engine = pick(model.engines);
        const year = randomYear(model.yearFrom, model.yearTo);
        const part = pick(PARTS_POOL);
        const isExoticBrand = ['PORSCHE', 'TESLA', 'HYUNDAI', 'TOYOTA', 'RENAULT', 'SKODA'].includes(brand.make);
        const difficulty = isExoticBrand ? 'exotic' as const : part.difficulty;
        rows.push({
            id: createId(),
            make: brand.make,
            model: model.name,
            year: String(year),
            motor: engine,
            vin: randomVin(model.vinPrefix),
            part: part.name,
            oem: null, confidence: null, resolvedBy: null, elapsed: null,
            status: 'pending',
            difficulty,
        });
    }
    return rows;
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
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const toggleSelect = (id: string) => {
        setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };
    const doneRows = rows.filter(r => r.status === 'found' || r.status === 'not_found' || r.status === 'error');
    const allDoneSelected = doneRows.length > 0 && doneRows.every(r => selected.has(r.id));
    const toggleAllDone = () => {
        if (allDoneSelected) setSelected(new Set());
        else setSelected(new Set(doneRows.map(r => r.id)));
    };

    // ── Push selected to error list ──
    const pushToErrors = () => {
        const items: ErrorItem[] = rows.filter(r => selected.has(r.id)).map(r => ({
            id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            make: r.make, model: r.model, year: r.year, motor: r.motor, vin: r.vin,
            part: r.part, oem: r.oem, confidence: r.confidence,
            source: 'batch', addedAt: new Date().toISOString(), status: 'pending',
        }));
        addErrors(items);
        setSelected(new Set());
        toast.success(`⚠️ ${items.length} Einträge zur Fehlerliste hinzugefügt`);
    };

    // ── Push selected correct results to DB ──
    const pushToDb = async () => {
        const toApprove = rows.filter(r => selected.has(r.id) && r.oem && r.confidence);
        if (!toApprove.length) { toast.info('Keine Zeilen mit OEM ausgewählt'); return; }
        let ok = 0;
        for (const r of toApprove) {
            try {
                await approveOemResult({
                    oem: r.oem!,
                    brand: r.make, model: r.model, part_category: r.part,
                    part_description: `${r.part} (${r.model} ${r.year})`,
                    confidence: r.confidence || 0.95,
                });
                ok++;
            } catch { /* skip failures */ }
        }
        setSelected(new Set());
        toast.success(`✅ ${ok}/${toApprove.length} OEMs in Datenbank übernommen`);
    };

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

        const MAX_RETRIES = 3;
        const BASE_DELAY = 3000; // 3s between requests to avoid rate limits

        for (let i = 0; i < rows.length; i++) {
            if (abortRef.current) break;
            if (rows[i].status === 'found' || rows[i].status === 'not_found') continue;
            while (pauseRef.current && !abortRef.current) await new Promise(r => setTimeout(r, 300));
            if (abortRef.current) break;

            setCurrentIdx(i);
            setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'processing' } : r));
            setTimeout(() => document.getElementById(`batch-row-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);

            const t0 = Date.now();
            let success = false;

            for (let attempt = 0; attempt < MAX_RETRIES && !success; attempt++) {
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
                    success = true;
                } catch (err: any) {
                    const is429 = err?.message?.includes('429') || err?.message?.includes('rate') || err?.message?.includes('Too Many');
                    if (is429 && attempt < MAX_RETRIES - 1) {
                        // Exponential backoff: 5s, 10s, 20s
                        const backoff = 5000 * Math.pow(2, attempt);
                        toast.info(`⏳ Rate-Limit erreicht — warte ${backoff / 1000}s (Retry ${attempt + 2}/${MAX_RETRIES})`);
                        await new Promise(r => setTimeout(r, backoff));
                    } else {
                        setRows(prev => prev.map((rr, idx) => idx === i ? {
                            ...rr, status: 'error', elapsed: `${Date.now() - t0}ms`,
                            resolvedBy: is429 ? '429 Rate Limit' : (err?.message?.slice(0, 50) || 'Error'),
                        } : rr));
                        success = true; // Don't retry further
                    }
                }
            }

            // Wait between requests to avoid rate limits
            if (i < rows.length - 1 && !abortRef.current) {
                await new Promise(r => setTimeout(r, BASE_DELAY));
            }
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
                    <div className="w-px h-8 bg-border/50 mx-1" />
                    {/* 🎲 Random Generator */}
                    <div className="relative group">
                        <button disabled={running} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/30 text-violet-700 dark:text-violet-300 hover:from-violet-500/20 hover:to-fuchsia-500/20 disabled:opacity-40 transition-all">
                            <Dice5 className="w-3.5 h-3.5" /> Würfeln ▾
                        </button>
                        <div className="absolute top-full left-0 mt-1 bg-card border border-border/60 rounded-xl shadow-xl p-1.5 hidden group-hover:flex flex-col gap-0.5 z-50 min-w-[160px]">
                            {[10, 20, 30, 50].map(n => (
                                <button key={n} onClick={() => { setRows(generateRandomRows(n)); setCurrentIdx(-1); toast.success(`🎲 ${n} zufällige Test-Zeilen generiert`); }} className="px-3 py-2 rounded-lg text-xs font-medium text-left hover:bg-muted/60 transition-colors">
                                    🎲 {n} zufällige Zeilen
                                </button>
                            ))}
                        </div>
                    </div>
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
                                    <th className="px-2 py-3 w-8">
                                        <input type="checkbox" checked={allDoneSelected} onChange={toggleAllDone} className="rounded border-border/50 accent-primary" title="Alle fertigen auswählen" />
                                    </th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-8">#</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Level</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Marke</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Modell</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bj.</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Motor</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">VIN</th>
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
                                        <td className="px-2 py-2.5">
                                            {(row.status === 'found' || row.status === 'not_found' || row.status === 'error') && (
                                                <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} className="rounded border-border/50 accent-primary" />
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{i + 1}</td>
                                        <td className="px-3 py-2.5"><DifficultyBadge d={row.difficulty} /></td>
                                        <td className="px-3 py-2.5 font-bold text-xs">{row.make}</td>
                                        <td className="px-3 py-2.5 text-xs">{row.model}</td>
                                        <td className="px-3 py-2.5 text-xs font-mono">{row.year}</td>
                                        <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{row.motor || '—'}</td>
                                        <td className="px-3 py-2.5 text-[10px] font-mono text-muted-foreground/70" title={row.vin || '—'}>{row.vin ? `…${row.vin.slice(-6)}` : '—'}</td>
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
