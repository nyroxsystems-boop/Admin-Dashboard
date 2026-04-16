/**
 * Batch OEM Test — Import CSV, run pipeline row-by-row, export results
 * 
 * Used as the 'batch' mode tab inside OemLookupView.
 * Uses Admin-Dashboard API (resolveOemForward) and glass-card styling.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
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
    // ═══ GERMAN MAINSTREAM ═══
    { make: 'VW', models: [
        { name: 'Golf VII', yearFrom: 2012, yearTo: 2020, engines: ['DFGA', 'CRLB', 'CHHB', 'CZCA', 'DFHA', 'CHZJ'], vinPrefix: 'WVWZZZ1KZ' },
        { name: 'Golf VII GTI', yearFrom: 2013, yearTo: 2020, engines: ['CHHB', 'DLBA'], vinPrefix: 'WVWZZZ1KZ' },
        { name: 'Golf VII R', yearFrom: 2014, yearTo: 2020, engines: ['CZPB', 'DNUA'], vinPrefix: 'WVWZZZ1KZ' },
        { name: 'Golf VIII', yearFrom: 2020, yearTo: 2025, engines: ['DTGA', 'DFKA', 'DLBA'], vinPrefix: 'WVWZZZ1UZ' },
        { name: 'Golf VIII GTI', yearFrom: 2020, yearTo: 2025, engines: ['DLBA'], vinPrefix: 'WVWZZZ1UZ' },
        { name: 'Passat B8', yearFrom: 2014, yearTo: 2023, engines: ['DFGA', 'DFHA', 'CZCA'], vinPrefix: 'WVWZZZ3CZ' },
        { name: 'Tiguan II', yearFrom: 2016, yearTo: 2024, engines: ['DFGA', 'DFHA', 'CZPA'], vinPrefix: 'WVGZZZ5NZ' },
        { name: 'T-Roc', yearFrom: 2017, yearTo: 2024, engines: ['DFGA', 'DKRA', 'CZCA'], vinPrefix: 'WVGZZZ2GZ' },
        { name: 'T-Roc R', yearFrom: 2019, yearTo: 2024, engines: ['DNUA'], vinPrefix: 'WVGZZZ2GZ' },
        { name: 'Polo VI', yearFrom: 2017, yearTo: 2024, engines: ['CZCA', 'DKLA'], vinPrefix: 'WVWZZZ6RZ' },
        { name: 'Polo VI GTI', yearFrom: 2018, yearTo: 2024, engines: ['DKZA'], vinPrefix: 'WVWZZZ6RZ' },
        { name: 'Touareg III', yearFrom: 2018, yearTo: 2024, engines: ['DCBC', 'DJHC'], vinPrefix: 'WVGZZZCR' },
        { name: 'Arteon', yearFrom: 2017, yearTo: 2024, engines: ['DFGA', 'CZPA', 'DNUA'], vinPrefix: 'WVWZZZ3HZ' },
        { name: 'Caddy V', yearFrom: 2020, yearTo: 2024, engines: ['DTRD', 'DLGA'], vinPrefix: 'WV2ZZZSKZ' },
        { name: 'Transporter T6.1', yearFrom: 2019, yearTo: 2024, engines: ['DTRD', 'DTRR'], vinPrefix: 'WV1ZZZSYZ' },
    ]},
    { make: 'BMW', models: [
        { name: '1er F20', yearFrom: 2011, yearTo: 2019, engines: ['N47', 'N20', 'B47', 'B48'], vinPrefix: 'WBA1S110' },
        { name: '1er F40', yearFrom: 2019, yearTo: 2025, engines: ['B47', 'B48'], vinPrefix: 'WBA7C110' },
        { name: '3er F30', yearFrom: 2012, yearTo: 2019, engines: ['B47', 'N47', 'N20', 'N57', 'B48'], vinPrefix: 'WBA8E110' },
        { name: '3er G20', yearFrom: 2019, yearTo: 2025, engines: ['B47', 'B48', 'B58'], vinPrefix: 'WBA5U110' },
        { name: 'M3 F80', yearFrom: 2014, yearTo: 2018, engines: ['S55'], vinPrefix: 'WBS8M910' },
        { name: 'M3 G80', yearFrom: 2021, yearTo: 2025, engines: ['S58'], vinPrefix: 'WBS43AT0' },
        { name: 'M4 G82', yearFrom: 2021, yearTo: 2025, engines: ['S58'], vinPrefix: 'WBS73AZ0' },
        { name: '5er G30', yearFrom: 2017, yearTo: 2023, engines: ['B57', 'B58', 'B47', 'B48'], vinPrefix: 'WBAJC510' },
        { name: 'M5 F90', yearFrom: 2017, yearTo: 2023, engines: ['S63'], vinPrefix: 'WBSJF010' },
        { name: 'X1 F48', yearFrom: 2015, yearTo: 2022, engines: ['B47', 'B38', 'B48'], vinPrefix: 'WBAHT110' },
        { name: 'X3 G01', yearFrom: 2017, yearTo: 2023, engines: ['B47', 'B48', 'B58'], vinPrefix: 'WBATX710' },
        { name: 'X5 G05', yearFrom: 2018, yearTo: 2025, engines: ['B57', 'B58', 'N63'], vinPrefix: 'WBAJT110' },
        { name: 'Z4 G29', yearFrom: 2019, yearTo: 2025, engines: ['B48', 'B58'], vinPrefix: 'WBAHK110' },
    ]},
    { make: 'MERCEDES', models: [
        { name: 'A-Klasse W177', yearFrom: 2018, yearTo: 2025, engines: ['OM608', 'M282', 'M260'], vinPrefix: 'WDD17700' },
        { name: 'A35 AMG W177', yearFrom: 2019, yearTo: 2025, engines: ['M260'], vinPrefix: 'WDD17735' },
        { name: 'A45 AMG W177', yearFrom: 2019, yearTo: 2025, engines: ['M139'], vinPrefix: 'WDD17745' },
        { name: 'C-Klasse W205', yearFrom: 2014, yearTo: 2021, engines: ['OM654', 'M274', 'M276', 'OM651'], vinPrefix: 'WDD20500' },
        { name: 'C63 AMG W205', yearFrom: 2015, yearTo: 2021, engines: ['M177'], vinPrefix: 'WDD20563' },
        { name: 'C-Klasse W206', yearFrom: 2021, yearTo: 2025, engines: ['OM654', 'M254'], vinPrefix: 'WDD20600' },
        { name: 'E-Klasse W213', yearFrom: 2016, yearTo: 2023, engines: ['OM654', 'M256', 'M274'], vinPrefix: 'WDD21300' },
        { name: 'E63 AMG W213', yearFrom: 2017, yearTo: 2023, engines: ['M177'], vinPrefix: 'WDD21363' },
        { name: 'GLC X253', yearFrom: 2015, yearTo: 2022, engines: ['OM654', 'M274', 'M276'], vinPrefix: 'WDC25390' },
        { name: 'GLC63 AMG X253', yearFrom: 2018, yearTo: 2022, engines: ['M177'], vinPrefix: 'WDC25363' },
        { name: 'GLA H247', yearFrom: 2020, yearTo: 2025, engines: ['OM608', 'M260', 'M282'], vinPrefix: 'WDC24700' },
        { name: 'CLA C118', yearFrom: 2019, yearTo: 2025, engines: ['OM608', 'M260', 'M282'], vinPrefix: 'WDD11800' },
        { name: 'GLE V167', yearFrom: 2019, yearTo: 2025, engines: ['OM656', 'M256', 'M176'], vinPrefix: 'WDC16700' },
    ]},
    { make: 'AUDI', models: [
        { name: 'A1 GB', yearFrom: 2018, yearTo: 2024, engines: ['DKRF', 'CZCA'], vinPrefix: 'WAUZZZ8X' },
        { name: 'A3 8V', yearFrom: 2012, yearTo: 2020, engines: ['DFGA', 'CRLB', 'CHHB', 'CZCA'], vinPrefix: 'WAUZZZGF' },
        { name: 'A3 8Y', yearFrom: 2020, yearTo: 2025, engines: ['DFGA', 'DTSA', 'DLBA'], vinPrefix: 'WAUZZZGY' },
        { name: 'RS3 8V', yearFrom: 2015, yearTo: 2020, engines: ['DAZA'], vinPrefix: 'WAUZZZGF' },
        { name: 'RS3 8Y', yearFrom: 2021, yearTo: 2025, engines: ['DNWA'], vinPrefix: 'WAUZZZGY' },
        { name: 'A4 B9', yearFrom: 2015, yearTo: 2023, engines: ['DETA', 'CVKB', 'DFGA', 'CZHA'], vinPrefix: 'WAUZZZF4' },
        { name: 'RS4 B9', yearFrom: 2017, yearTo: 2023, engines: ['DTUA'], vinPrefix: 'WAUZZZF4' },
        { name: 'A5 F5', yearFrom: 2016, yearTo: 2023, engines: ['DETA', 'DFGA', 'CZHA'], vinPrefix: 'WAUZZZF5' },
        { name: 'A6 C8', yearFrom: 2018, yearTo: 2024, engines: ['DFGA', 'DLTA', 'DHRA'], vinPrefix: 'WAUZZZF2' },
        { name: 'RS6 C8', yearFrom: 2019, yearTo: 2024, engines: ['DKWA'], vinPrefix: 'WAUZZZF2' },
        { name: 'Q3 F3', yearFrom: 2019, yearTo: 2024, engines: ['DFGA', 'DKTA', 'CZPA'], vinPrefix: 'WAUZZZF5' },
        { name: 'Q5 FY', yearFrom: 2017, yearTo: 2024, engines: ['DTUA', 'DFGA', 'DAXB'], vinPrefix: 'WAUZZZFY' },
        { name: 'Q7 4M', yearFrom: 2015, yearTo: 2024, engines: ['CVMD', 'CREC', 'DCPC'], vinPrefix: 'WAUZZZ4L' },
        { name: 'TT FV', yearFrom: 2014, yearTo: 2023, engines: ['CHHB', 'CJSA', 'CZGA'], vinPrefix: 'TRUZZZFV' },
    ]},
    { make: 'OPEL', models: [
        { name: 'Astra K', yearFrom: 2015, yearTo: 2022, engines: ['B14XFT', 'B16DTH', 'B16SHT'], vinPrefix: 'W0LBD8EA' },
        { name: 'Astra L', yearFrom: 2022, yearTo: 2025, engines: ['F12XHL', 'F16XHR'], vinPrefix: 'W0VF6900' },
        { name: 'Insignia B', yearFrom: 2017, yearTo: 2022, engines: ['B20DTH', 'B16SHT'], vinPrefix: 'W0LGA8EM' },
        { name: 'Corsa F', yearFrom: 2019, yearTo: 2024, engines: ['F12XHL', 'F12XHT'], vinPrefix: 'W0VF6800' },
        { name: 'Mokka B', yearFrom: 2020, yearTo: 2024, engines: ['F12XHL', 'F12XHT', ''], vinPrefix: 'W0VF5800' },
        { name: 'Grandland', yearFrom: 2017, yearTo: 2024, engines: ['F16XHR', 'D16DTH'], vinPrefix: 'W0LJB8EM' },
    ]},
    { make: 'FORD', models: [
        { name: 'Focus IV', yearFrom: 2018, yearTo: 2024, engines: ['M1DA', 'M2DA', 'XWDB'], vinPrefix: 'WF0XXXGCH' },
        { name: 'Focus ST IV', yearFrom: 2019, yearTo: 2024, engines: ['YZDA'], vinPrefix: 'WF0XXXGCH' },
        { name: 'Fiesta VIII', yearFrom: 2017, yearTo: 2023, engines: ['M1DA', 'XWJB'], vinPrefix: 'WF0XXXGCE' },
        { name: 'Fiesta ST VIII', yearFrom: 2018, yearTo: 2023, engines: ['YZJA'], vinPrefix: 'WF0XXXGCE' },
        { name: 'Kuga II', yearFrom: 2012, yearTo: 2020, engines: ['T7CL', 'JTMA', 'XWDB'], vinPrefix: 'WF0XXXGCD' },
        { name: 'Kuga III', yearFrom: 2020, yearTo: 2024, engines: ['XWDB', 'YZDA', ''], vinPrefix: 'WF0GXXGCD' },
        { name: 'Puma', yearFrom: 2019, yearTo: 2024, engines: ['M1DA', 'XWJB', ''], vinPrefix: 'WF0RXXGCH' },
        { name: 'Mustang Mach-E', yearFrom: 2021, yearTo: 2024, engines: [''], vinPrefix: '3FTTK8DZ' },
        { name: 'Ranger', yearFrom: 2019, yearTo: 2024, engines: ['YNFS', 'GBVAJQJ'], vinPrefix: 'WF0KXXGCD' },
    ]},

    // ═══ SPORT / PERFORMANCE ═══
    { make: 'CUPRA', models: [
        { name: 'Formentor', yearFrom: 2020, yearTo: 2024, engines: ['DFGA', 'DNUA', 'DAZA'], vinPrefix: 'VSSZZZKMZ' },
        { name: 'Leon', yearFrom: 2020, yearTo: 2024, engines: ['DFGA', 'DLBA', 'DNUA'], vinPrefix: 'VSSZZZKMZ' },
        { name: 'Born', yearFrom: 2021, yearTo: 2024, engines: [''], vinPrefix: 'VSSZZZKMZ' },
        { name: 'Ateca', yearFrom: 2018, yearTo: 2024, engines: ['DFGA', 'DNUA'], vinPrefix: 'VSSZZZKMZ' },
    ]},
    { make: 'SEAT', models: [
        { name: 'Leon III', yearFrom: 2012, yearTo: 2020, engines: ['DFGA', 'CRLB', 'CHHB', 'CZCA'], vinPrefix: 'VSSZZZKL' },
        { name: 'Leon IV', yearFrom: 2020, yearTo: 2024, engines: ['DFGA', 'DLBA', 'DTSA'], vinPrefix: 'VSSZZZKM' },
        { name: 'Ibiza V', yearFrom: 2017, yearTo: 2024, engines: ['CZCA', 'DKLA'], vinPrefix: 'VSSZZZ6P' },
        { name: 'Ateca', yearFrom: 2016, yearTo: 2024, engines: ['DFGA', 'CZPA'], vinPrefix: 'VSSZZZ5F' },
        { name: 'Tarraco', yearFrom: 2018, yearTo: 2024, engines: ['DFGA', 'DFHA', 'CZPA'], vinPrefix: 'VSSZZZ5F' },
    ]},

    // ═══ PREMIUM / EXOTIC ═══
    { make: 'PORSCHE', models: [
        { name: 'Macan 95B', yearFrom: 2014, yearTo: 2024, engines: ['CYP', 'DCB', 'CTB'], vinPrefix: 'WP1ZZZ95Z' },
        { name: 'Cayenne E3', yearFrom: 2018, yearTo: 2024, engines: ['DJH', 'DCB'], vinPrefix: 'WP1ZZZ9YZ' },
        { name: '911 992', yearFrom: 2019, yearTo: 2024, engines: ['DKK', 'DLA'], vinPrefix: 'WP0ZZZ99Z' },
        { name: '718 Cayman/Boxster', yearFrom: 2016, yearTo: 2024, engines: ['CYP', 'DCB', 'DKK'], vinPrefix: 'WP0ZZZ98Z' },
        { name: 'Panamera 971', yearFrom: 2017, yearTo: 2024, engines: ['DJH', 'DCB', 'CYP'], vinPrefix: 'WP0ZZZ97Z' },
        { name: 'Taycan', yearFrom: 2020, yearTo: 2024, engines: [''], vinPrefix: 'WP0ZZZY1Z' },
    ]},
    { make: 'JAGUAR', models: [
        { name: 'XE X760', yearFrom: 2015, yearTo: 2023, engines: ['204DT', '204PT', 'AJ200'], vinPrefix: 'SAJAD4BN' },
        { name: 'XF X260', yearFrom: 2015, yearTo: 2023, engines: ['204DT', '306DT', 'AJ200'], vinPrefix: 'SAJBA4BN' },
        { name: 'F-Pace X761', yearFrom: 2016, yearTo: 2024, engines: ['204DT', 'PT204', '306DT'], vinPrefix: 'SADCA2BN' },
        { name: 'E-Pace X540', yearFrom: 2017, yearTo: 2024, engines: ['204DT', 'PT204'], vinPrefix: 'SADFP2BN' },
        { name: 'I-Pace', yearFrom: 2018, yearTo: 2024, engines: [''], vinPrefix: 'SADHD2S1' },
        { name: 'F-Type', yearFrom: 2013, yearTo: 2024, engines: ['306PS', '508PS', 'AJ133'], vinPrefix: 'SAJDA1AE' },
    ]},
    { make: 'LAND ROVER', models: [
        { name: 'Range Rover Evoque L551', yearFrom: 2019, yearTo: 2024, engines: ['204DT', 'PT204', ''], vinPrefix: 'SALZA2BN' },
        { name: 'Range Rover Sport L461', yearFrom: 2022, yearTo: 2025, engines: ['D300', 'P400', ''], vinPrefix: 'SALWA2BN' },
        { name: 'Discovery Sport L550', yearFrom: 2014, yearTo: 2024, engines: ['204DT', 'PT204', 'D150'], vinPrefix: 'SALCA2BN' },
        { name: 'Defender L663', yearFrom: 2020, yearTo: 2025, engines: ['D200', 'D300', 'P400'], vinPrefix: 'SALE2EEU' },
    ]},
    { make: 'VOLVO', models: [
        { name: 'XC40', yearFrom: 2017, yearTo: 2024, engines: ['D4204T14', 'B4204T47', ''], vinPrefix: 'YV1XZ22V' },
        { name: 'XC60 II', yearFrom: 2017, yearTo: 2024, engines: ['D4204T14', 'B4204T23', 'D4204T23'], vinPrefix: 'YV1UZ22V' },
        { name: 'XC90 II', yearFrom: 2015, yearTo: 2024, engines: ['D4204T11', 'D4204T23', 'B4204T23'], vinPrefix: 'YV1LC22V' },
        { name: 'V60 II', yearFrom: 2018, yearTo: 2024, engines: ['D4204T14', 'B4204T47'], vinPrefix: 'YV1ZW22V' },
        { name: 'S60 III', yearFrom: 2019, yearTo: 2024, engines: ['B4204T47', 'D4204T14'], vinPrefix: 'YV1PH22V' },
        { name: 'V40 II', yearFrom: 2012, yearTo: 2019, engines: ['D4204T8', 'B4204T11'], vinPrefix: 'YV1MH22V' },
    ]},

    // ═══ KOREAN ═══
    { make: 'HYUNDAI', models: [
        { name: 'Tucson TL', yearFrom: 2015, yearTo: 2020, engines: ['D4HA', 'G4FJ', 'G4FD'], vinPrefix: 'TMAJ3812A' },
        { name: 'Tucson NX4', yearFrom: 2021, yearTo: 2025, engines: ['D4HA', 'G4FS', ''], vinPrefix: 'TMAJ5812A' },
        { name: 'i30 PD', yearFrom: 2017, yearTo: 2023, engines: ['D4FC', 'G4FJ', 'G4LD'], vinPrefix: 'TMAJ381AA' },
        { name: 'i30 N PD', yearFrom: 2017, yearTo: 2023, engines: ['G4FJ'], vinPrefix: 'TMAJ381NA' },
        { name: 'Kona OS', yearFrom: 2017, yearTo: 2023, engines: ['G4LD', 'D4FC', ''], vinPrefix: 'TMAJ581AA' },
        { name: 'i20 BC3', yearFrom: 2020, yearTo: 2024, engines: ['G4LC', 'G3LC', 'G4GJ'], vinPrefix: 'TMAJ281AA' },
        { name: 'i20 N BC3', yearFrom: 2021, yearTo: 2024, engines: ['G4GJ'], vinPrefix: 'TMAJ281NA' },
        { name: 'Ioniq 5', yearFrom: 2021, yearTo: 2025, engines: [''], vinPrefix: 'KMHLJ81BA' },
        { name: 'Santa Fe TM', yearFrom: 2018, yearTo: 2023, engines: ['D4HB', 'G4KH', ''], vinPrefix: 'TMAH781AA' },
    ]},
    { make: 'KIA', models: [
        { name: 'Ceed CD', yearFrom: 2018, yearTo: 2024, engines: ['D4FC', 'G4FJ', 'G4LD'], vinPrefix: 'U5YH581AA' },
        { name: 'Ceed GT CD', yearFrom: 2019, yearTo: 2024, engines: ['G4FJ'], vinPrefix: 'U5YH581GA' },
        { name: 'Sportage QL', yearFrom: 2016, yearTo: 2021, engines: ['D4HA', 'G4FJ', 'G4NA'], vinPrefix: 'U5YPC81AA' },
        { name: 'Sportage NQ5', yearFrom: 2022, yearTo: 2025, engines: ['D4HA', 'G4FS', ''], vinPrefix: 'U5YPC81DA' },
        { name: 'Stinger CK', yearFrom: 2017, yearTo: 2023, engines: ['G4KH', 'G6DG', 'D4HB'], vinPrefix: 'KNAE451CA' },
        { name: 'Niro DE2', yearFrom: 2022, yearTo: 2025, engines: ['G4LE', '', 'G4FV'], vinPrefix: 'KNACC81PA' },
        { name: 'EV6', yearFrom: 2021, yearTo: 2025, engines: [''], vinPrefix: 'KNACC81AA' },
        { name: 'Picanto JA', yearFrom: 2017, yearTo: 2024, engines: ['G3LA', 'G4LA'], vinPrefix: 'KNAJ581AA' },
    ]},

    // ═══ JAPANESE ═══
    { make: 'TOYOTA', models: [
        { name: 'Corolla E210', yearFrom: 2019, yearTo: 2024, engines: ['2ZR-FXE', 'M20A-FKS'], vinPrefix: 'SB1K83BE6' },
        { name: 'RAV4 XA50', yearFrom: 2019, yearTo: 2024, engines: ['A25A-FXS', 'M20A-FKS', ''], vinPrefix: 'JTMDA3FV0' },
        { name: 'Yaris XP210', yearFrom: 2020, yearTo: 2024, engines: ['M15A-FKS', 'M15A-FXE'], vinPrefix: 'SB1K43BE6' },
        { name: 'GR Yaris GXPA16', yearFrom: 2020, yearTo: 2024, engines: ['G16E-GTS'], vinPrefix: 'SB1K43BE6' },
        { name: 'C-HR', yearFrom: 2016, yearTo: 2024, engines: ['2ZR-FXE', '8NR-FTS'], vinPrefix: 'NMTK33BE6' },
        { name: 'Supra A90', yearFrom: 2019, yearTo: 2024, engines: ['B58', 'B48'], vinPrefix: 'WZ1DB420' },
        { name: 'Land Cruiser J300', yearFrom: 2021, yearTo: 2024, engines: ['F33A-FTV', 'V35A-FTS'], vinPrefix: 'JTEBH3FJ0' },
    ]},
    { make: 'HONDA', models: [
        { name: 'Civic FK', yearFrom: 2017, yearTo: 2022, engines: ['L15B7', 'K20C1'], vinPrefix: 'SHHFK2860' },
        { name: 'Civic Type R FK8', yearFrom: 2017, yearTo: 2022, engines: ['K20C1'], vinPrefix: 'SHHFK8S80' },
        { name: 'Civic FL', yearFrom: 2022, yearTo: 2025, engines: ['L15BG', 'K20C1'], vinPrefix: 'SHHFL1860' },
        { name: 'CR-V RW', yearFrom: 2017, yearTo: 2024, engines: ['L15BF', 'K20C2', ''], vinPrefix: 'SHHR3RW80' },
        { name: 'HR-V RV', yearFrom: 2021, yearTo: 2024, engines: ['LEB', ''], vinPrefix: 'SHHR4RV80' },
        { name: 'Jazz GR', yearFrom: 2020, yearTo: 2024, engines: ['LEB', ''], vinPrefix: 'SHHGR3GF0' },
    ]},
    { make: 'NISSAN', models: [
        { name: 'Qashqai J11', yearFrom: 2014, yearTo: 2021, engines: ['R9M', 'MR20DD', 'HR13DDT'], vinPrefix: 'SJNFAAJ11' },
        { name: 'Qashqai J12', yearFrom: 2021, yearTo: 2025, engines: ['HR13DDT', 'KR15DDT', ''], vinPrefix: 'SJNFBAJ12' },
        { name: 'Juke F16', yearFrom: 2019, yearTo: 2024, engines: ['HR13DDT'], vinPrefix: 'SJNFBAF16' },
        { name: 'Leaf ZE1', yearFrom: 2017, yearTo: 2024, engines: ['EM57', ''], vinPrefix: 'SJNFAAZE1' },
        { name: 'X-Trail T32', yearFrom: 2014, yearTo: 2022, engines: ['R9M', 'MR20DD'], vinPrefix: 'SJNFAAT32' },
        { name: 'GT-R R35', yearFrom: 2007, yearTo: 2024, engines: ['VR38DETT'], vinPrefix: 'JN1BANR3' },
    ]},
    { make: 'MAZDA', models: [
        { name: 'CX-5 KF', yearFrom: 2017, yearTo: 2024, engines: ['SH-VPTS', 'PE-VPS', 'PY-VPS'], vinPrefix: 'JM3KFBCL' },
        { name: 'Mazda3 BP', yearFrom: 2019, yearTo: 2024, engines: ['PE-VPS', 'PY-RPS', 'SH-VPTS'], vinPrefix: 'JM3BPBDM' },
        { name: 'CX-30 DM', yearFrom: 2019, yearTo: 2024, engines: ['PE-VPS', 'PY-RPS', 'SH-VPTS'], vinPrefix: 'JM3DMBCL' },
        { name: 'MX-5 ND', yearFrom: 2015, yearTo: 2024, engines: ['PE-VPS'], vinPrefix: 'JM3NDWC1' },
        { name: 'CX-60', yearFrom: 2022, yearTo: 2025, engines: ['RZ01', 'PY-RPS', ''], vinPrefix: 'JM3KRWCL' },
    ]},
    { make: 'SUZUKI', models: [
        { name: 'Swift ZC/ZD', yearFrom: 2017, yearTo: 2024, engines: ['K12C', 'K10C', 'K14C'], vinPrefix: 'TSMMZC83S' },
        { name: 'Swift Sport ZC33S', yearFrom: 2018, yearTo: 2024, engines: ['K14C'], vinPrefix: 'TSMMZC33S' },
        { name: 'Vitara LY', yearFrom: 2015, yearTo: 2024, engines: ['K14C', 'D16AA'], vinPrefix: 'TSMALY21S' },
        { name: 'Jimny JB74', yearFrom: 2018, yearTo: 2024, engines: ['K15B'], vinPrefix: 'JS3JB74V' },
        { name: 'S-Cross JY', yearFrom: 2022, yearTo: 2024, engines: ['K14D', 'K15C'], vinPrefix: 'TSMAJY21S' },
    ]},
    { make: 'MITSUBISHI', models: [
        { name: 'Outlander GF', yearFrom: 2012, yearTo: 2021, engines: ['4B11', '4B12', '4J12', ''], vinPrefix: 'JMBXDGF2' },
        { name: 'ASX GA', yearFrom: 2010, yearTo: 2023, engines: ['4B11', '4J10'], vinPrefix: 'JMBXDGA8' },
        { name: 'Eclipse Cross GK', yearFrom: 2018, yearTo: 2024, engines: ['4B40', '4B11', ''], vinPrefix: 'JMBXDGK0' },
        { name: 'L200 KK/KL', yearFrom: 2015, yearTo: 2024, engines: ['4N15'], vinPrefix: 'MMCJNKK5' },
    ]},

    // ═══ FRENCH ═══
    { make: 'RENAULT', models: [
        { name: 'Mégane IV', yearFrom: 2016, yearTo: 2023, engines: ['K9K', 'H5F', 'M5M'], vinPrefix: 'VF1RFB00X' },
        { name: 'Mégane RS IV', yearFrom: 2018, yearTo: 2023, engines: ['M5M'], vinPrefix: 'VF1RFB00X' },
        { name: 'Clio V', yearFrom: 2019, yearTo: 2024, engines: ['H5F', 'K9K', ''], vinPrefix: 'VF1RJA00X' },
        { name: 'Captur II', yearFrom: 2019, yearTo: 2024, engines: ['H5F', 'K9K', ''], vinPrefix: 'VF1RJE00X' },
        { name: 'Kadjar', yearFrom: 2015, yearTo: 2022, engines: ['K9K', 'H5F', 'M5M'], vinPrefix: 'VF1RFE00X' },
        { name: 'Austral', yearFrom: 2022, yearTo: 2025, engines: ['H5H', 'D16DTH', ''], vinPrefix: 'VF1RKA00X' },
        { name: 'Arkana', yearFrom: 2021, yearTo: 2024, engines: ['H5H', 'M5M', ''], vinPrefix: 'VF1RJL00X' },
    ]},
    { make: 'PEUGEOT', models: [
        { name: '208 II', yearFrom: 2019, yearTo: 2024, engines: ['EB2ADTS', 'DV5RD', ''], vinPrefix: 'VR3UHZKC' },
        { name: '308 III', yearFrom: 2021, yearTo: 2025, engines: ['EB2ADTS', 'DV5RD', ''], vinPrefix: 'VR3FCYHZ' },
        { name: '3008 II', yearFrom: 2016, yearTo: 2024, engines: ['EB2ADTS', 'DV6FD', 'DW10FC'], vinPrefix: 'VR3MRYHZ' },
        { name: '5008 II', yearFrom: 2017, yearTo: 2024, engines: ['EB2ADTS', 'DV6FD', 'DW10FC'], vinPrefix: 'VR3MKYHZ' },
        { name: '2008 II', yearFrom: 2019, yearTo: 2024, engines: ['EB2ADTS', 'DV5RD', ''], vinPrefix: 'VR3UHZKE' },
        { name: '508 II', yearFrom: 2018, yearTo: 2024, engines: ['EB2ADTS', 'DV5RD', 'DW10FC'], vinPrefix: 'VR3FCYHZ' },
    ]},
    { make: 'CITROËN', models: [
        { name: 'C3 III', yearFrom: 2016, yearTo: 2024, engines: ['EB2ADTS', 'EB2F', 'DV5RD'], vinPrefix: 'VR7SCAHZJ' },
        { name: 'C4 III', yearFrom: 2020, yearTo: 2024, engines: ['EB2ADTS', 'DV5RD', ''], vinPrefix: 'VR7BCAHZJ' },
        { name: 'C5 Aircross', yearFrom: 2018, yearTo: 2024, engines: ['EB2ADTS', 'DV6FD', 'DW10FC'], vinPrefix: 'VR7MCAHZJ' },
        { name: 'Berlingo III', yearFrom: 2018, yearTo: 2024, engines: ['EB2ADTS', 'DV5RD', ''], vinPrefix: 'VR7ECAHZJ' },
    ]},
    { make: 'DACIA', models: [
        { name: 'Duster II', yearFrom: 2018, yearTo: 2024, engines: ['K9K', 'H5H', 'H4M'], vinPrefix: 'UU1HSDEP' },
        { name: 'Sandero III', yearFrom: 2020, yearTo: 2024, engines: ['H5H', 'K9K', 'H4M'], vinPrefix: 'UU1BSDEP' },
        { name: 'Jogger', yearFrom: 2022, yearTo: 2024, engines: ['H5H', 'K9K', ''], vinPrefix: 'UU1RSDEP' },
        { name: 'Spring', yearFrom: 2021, yearTo: 2024, engines: [''], vinPrefix: 'UU1ESDEP' },
    ]},

    // ═══ ITALIAN ═══
    { make: 'FIAT', models: [
        { name: '500 312', yearFrom: 2007, yearTo: 2024, engines: ['312A2000', '330A1000', ''], vinPrefix: 'ZFA31200' },
        { name: '500X 334', yearFrom: 2014, yearTo: 2024, engines: ['55282328', '55263087', '55280444'], vinPrefix: 'ZFA33400' },
        { name: 'Tipo 356', yearFrom: 2015, yearTo: 2024, engines: ['55280444', '55263087'], vinPrefix: 'ZFA35600' },
        { name: 'Panda III 312', yearFrom: 2012, yearTo: 2024, engines: ['312A2000', '169A4000'], vinPrefix: 'ZFA31200' },
        { name: 'Ducato 250', yearFrom: 2014, yearTo: 2024, engines: ['F1AGL411D', 'F1CGL411A'], vinPrefix: 'ZFA25000' },
    ]},
    { make: 'ALFA ROMEO', models: [
        { name: 'Giulia 952', yearFrom: 2016, yearTo: 2024, engines: ['55280445', '55282327', '55274340'], vinPrefix: 'ZAR95200' },
        { name: 'Giulia QV 952', yearFrom: 2016, yearTo: 2024, engines: ['55274340'], vinPrefix: 'ZAR95290' },
        { name: 'Stelvio 949', yearFrom: 2017, yearTo: 2024, engines: ['55280445', '55282327', '55274340'], vinPrefix: 'ZAR94900' },
        { name: 'Tonale', yearFrom: 2022, yearTo: 2024, engines: ['55280444', '55282328', ''], vinPrefix: 'ZAR94700' },
    ]},

    // ═══ BRITISH + SPECIAL ═══
    { make: 'MINI', models: [
        { name: 'Cooper F56', yearFrom: 2014, yearTo: 2021, engines: ['B38A15A', 'B48A20A', 'B47C20A'], vinPrefix: 'WMWXS310' },
        { name: 'Cooper S F56', yearFrom: 2014, yearTo: 2021, engines: ['B48A20A'], vinPrefix: 'WMWXS510' },
        { name: 'JCW F56', yearFrom: 2015, yearTo: 2021, engines: ['B48A20T1'], vinPrefix: 'WMWXS710' },
        { name: 'Countryman F60', yearFrom: 2017, yearTo: 2024, engines: ['B47C20A', 'B48A20A', ''], vinPrefix: 'WMZYS310' },
        { name: 'Cooper F66', yearFrom: 2024, yearTo: 2025, engines: ['B38K15A', ''], vinPrefix: 'WMWYU310' },
    ]},
    { make: 'SMART', models: [
        { name: 'Fortwo 453', yearFrom: 2014, yearTo: 2022, engines: ['M281', 'H4B'], vinPrefix: 'WME4530' },
        { name: 'Forfour 453', yearFrom: 2014, yearTo: 2022, engines: ['M281', 'H4B'], vinPrefix: 'WME4530' },
        { name: '#1', yearFrom: 2022, yearTo: 2025, engines: [''], vinPrefix: 'WME4440' },
    ]},
    { make: 'TESLA', models: [
        { name: 'Model 3', yearFrom: 2019, yearTo: 2024, engines: [''], vinPrefix: '5YJ3E1EA' },
        { name: 'Model 3 Highland', yearFrom: 2024, yearTo: 2025, engines: [''], vinPrefix: 'LRW3E7EA' },
        { name: 'Model Y', yearFrom: 2020, yearTo: 2024, engines: [''], vinPrefix: '7SAYGDEE' },
        { name: 'Model S', yearFrom: 2012, yearTo: 2024, engines: [''], vinPrefix: '5YJSA1E2' },
        { name: 'Model X', yearFrom: 2015, yearTo: 2024, engines: [''], vinPrefix: '5YJXCCE4' },
    ]},
    { make: 'SKODA', models: [
        { name: 'Octavia III', yearFrom: 2012, yearTo: 2020, engines: ['DFGA', 'CRLB', 'CZCA', 'CHHB'], vinPrefix: 'TMBAG7NE' },
        { name: 'Octavia III RS', yearFrom: 2013, yearTo: 2020, engines: ['CHHB', 'CZGA'], vinPrefix: 'TMBAG7NE' },
        { name: 'Octavia IV', yearFrom: 2020, yearTo: 2025, engines: ['DFGA', 'DLBA', 'DTSA'], vinPrefix: 'TMBAR7NE' },
        { name: 'Octavia IV RS', yearFrom: 2020, yearTo: 2025, engines: ['DLBA', 'DNUA'], vinPrefix: 'TMBAR7NE' },
        { name: 'Superb III', yearFrom: 2015, yearTo: 2023, engines: ['DFGA', 'DFHA', 'CZPA'], vinPrefix: 'TMBAJ7NS' },
        { name: 'Kodiaq NS', yearFrom: 2017, yearTo: 2024, engines: ['DFGA', 'DFHA', 'CZPA'], vinPrefix: 'TMBAR7NS' },
        { name: 'Karoq NU', yearFrom: 2017, yearTo: 2024, engines: ['DFGA', 'CZCA', 'DKRA'], vinPrefix: 'TMBAR5NU' },
        { name: 'Fabia IV PJ', yearFrom: 2021, yearTo: 2024, engines: ['CZCA', 'DKLA'], vinPrefix: 'TMBAR6PJ' },
        { name: 'Enyaq iV', yearFrom: 2021, yearTo: 2024, engines: [''], vinPrefix: 'TMBAR7NE' },
    ]},
];

const EXOTIC_BRANDS = new Set(['PORSCHE', 'TESLA', 'HYUNDAI', 'TOYOTA', 'RENAULT', 'SKODA', 'KIA', 'HONDA', 'NISSAN',
    'MAZDA', 'SUZUKI', 'MITSUBISHI', 'PEUGEOT', 'CITROËN', 'DACIA', 'FIAT', 'ALFA ROMEO', 'JAGUAR',
    'LAND ROVER', 'VOLVO', 'MINI', 'SMART']);

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
    const yearChar = YEAR_CHARS[Math.floor(Math.random() * YEAR_CHARS.length)];
    // VIN = 17 chars total. prefix + yearChar + serial must = 17
    const serialLen = 17 - prefix.length - 1;
    const serial = String(Math.floor(Math.random() * Math.pow(10, serialLen))).padStart(serialLen, '0');
    return prefix + yearChar + serial;
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
        const isExoticBrand = EXOTIC_BRANDS.has(brand.make);
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
    const [showDice, setShowDice] = useState(false);
    const diceRef = useRef<HTMLDivElement>(null);

    // Close dice dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (diceRef.current && !diceRef.current.contains(e.target as Node)) setShowDice(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

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
                } catch (err: unknown) {
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
                    <div className="relative" ref={diceRef}>
                        <button
                            disabled={running}
                            onClick={() => setShowDice(v => !v)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-40 ${
                                showDice
                                    ? 'bg-violet-500/20 border-violet-500/50 text-violet-700 dark:text-violet-300 shadow-sm'
                                    : 'bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300 hover:from-violet-500/20 hover:to-fuchsia-500/20'
                            }`}
                        >
                            <Dice5 className="w-3.5 h-3.5" /> Würfeln <span className="text-[9px] opacity-60">▾</span>
                        </button>
                        {showDice && (
                            <div className="absolute top-full left-0 mt-1.5 bg-card border border-border/60 rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 z-50 min-w-[180px] animate-in fade-in slide-in-from-top-1 duration-150">
                                {[10, 20, 30, 50].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => {
                                            setRows(generateRandomRows(n));
                                            setCurrentIdx(-1);
                                            setShowDice(false);
                                            toast.success(`🎲 ${n} zufällige Test-Zeilen generiert`);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-left hover:bg-muted/60 transition-colors"
                                    >
                                        <Dice5 className="w-3.5 h-3.5 text-violet-500" /> {n} zufällige Zeilen
                                    </button>
                                ))}
                            </div>
                        )}
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
                                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[160px]">VIN</th>
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
                                        <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">{row.vin || '—'}</td>
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

            {/* ═══ FLOATING SELECTION ACTION BAR ═══ */}
            {selected.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <div className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-card/95 backdrop-blur-xl border-2 border-primary/30 shadow-2xl shadow-primary/10">
                        <div className="flex items-center gap-2 pr-3 border-r border-border/50">
                            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                                <CheckCircle className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                                <div className="text-sm font-bold">{selected.size} ausgewählt</div>
                                <div className="text-[10px] text-muted-foreground">{rows.filter(r => selected.has(r.id) && r.oem).length} mit OEM</div>
                            </div>
                        </div>
                        <button
                            onClick={pushToErrors}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all"
                        >
                            <Flag className="w-3.5 h-3.5" /> Als Fehler markieren
                        </button>
                        <button
                            onClick={pushToDb}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all"
                        >
                            <Database className="w-3.5 h-3.5" /> In DB übernehmen
                        </button>
                        <button
                            onClick={() => setSelected(new Set())}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted/60 transition-colors"
                        >
                            <XCircle className="w-3.5 h-3.5" /> Aufheben
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default OemBatchTest;
