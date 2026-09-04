/**
 * OEM-Finder API — Schein-OCR → VIN → YQ WS.OEM v2 → native OE-Position.
 * Provider-Zugangsdaten bleiben serverseitig im oem-service.
 */
import { apiFetch } from './client';

export interface OemVehicleInput {
    vin?: string;
    hsn?: string;
    tsn?: string;
    make?: string;
    model?: string;
    year?: string;
    engine?: string;
    engineKw?: string;
    fuelType?: string;
    part?: string;
}

export interface OemCandidate { oem: string; brand: string }
export interface OemCrossRef { brand: string; articleNumber: string; ean: string | null; image: string | null }

/** Ausstattungsabhängige Ausführung (z. B. Bremsscheibe Ø 280 belüftet, PR-Nr. 1LB). */
export interface OemFitmentVariant {
    oem: string;
    label: string;
    criteria: Record<string, string>;
    articleCount: number;
    image?: string | null;
    matched?: boolean;
    axle?: 'front' | 'rear' | 'both';
    side?: 'left' | 'right' | 'both';
    positionEvidence?: string[];
}

export interface OemFindResult {
    resolved: boolean;
    stage?: 'vehicle' | 'oem' | 'part';
    source?: string;
    provider?: string;
    catalog?: string;
    elapsedMs?: number;
    trace?: Array<{
        stage: 'catalog' | 'vehicle' | 'groups' | 'position' | 'oem';
        status: 'ok' | 'not-found';
        label: string;
    }>;
    unresolved?: string;
    reason?: string;
    vehicle?: string;
    vehicleCandidates?: Array<{ id: string; label: string }>;
    partType?: string;
    partTypeOptions?: string[];
    matchedGroups?: string[];
    partInterpretation?: {
        original: string;
        recognizedAs: string[];
        method: 'canonical' | 'alias' | 'fuzzy';
        confidence: 'high' | 'medium';
        corrections: string[];
    };
    oem?: string | null;
    image?: string | null;
    oemCandidates?: OemCandidate[];
    crossRefs?: OemCrossRef[];
    /** true ⇒ mehrere ausstattungsabhängige Ausführungen; oem ist dann null. */
    ambiguous?: boolean;
    /** true ⇒ YQ nennt mehrere Nummern ausdrücklich als austauschbare Alternativen. */
    alternatives?: boolean;
    position?: {
        requestedAxle?: 'front' | 'rear';
        requestedSide?: 'left' | 'right';
        verified: boolean;
        excludedCandidates: number;
        evidence: string[];
    };
    fitmentVariants?: OemFitmentVariant[];
    /** Kriterien, die die Ausführungen unterscheiden (z. B. "Außendurchmesser [mm]"). */
    discriminators?: string[];
    parts?: Array<{
        oem: string;
        name: string;
        group: string;
        category?: string;
        unit?: string;
        section?: string;
        matched: boolean;
        criteria: Record<string, string>;
        contexts?: string[];
        axle?: 'front' | 'rear' | 'both';
        side?: 'left' | 'right' | 'both';
        positionEvidence?: string[];
    }>;
    error?: string;
}

export interface OemReversePartType {
    type: string;
    brands: string[];
    oemNumbers: string[];
    images: string[];
    eans: string[];
    examples: Array<{ brand: string; articleNumber: string; image: string | null; ean: string | null; criteria: Array<{ description: string; value: string }> }>;
}
export interface OemReverseResult {
    number: string;
    found: number;
    image: string | null;
    partTypes: OemReversePartType[];
    source?: string;
    provider?: string;
    error?: string;
}

export interface ScheinScanResult {
    success: boolean;
    elapsed?: string;
    vehicle: {
        make: string | null; model: string | null; year: number | null;
        vin: string | null; hsn: string | null; tsn: string | null;
        kw: number | null; displacement: number | null; motorcode: string | null;
    };
    error?: string;
}

export function oemFind(body: OemVehicleInput): Promise<OemFindResult> {
    return apiFetch<OemFindResult>('/api/admin/oem/find', { method: 'POST', body: JSON.stringify(body) });
}

export function oemReverse(number: string): Promise<OemReverseResult> {
    return apiFetch<OemReverseResult>(`/api/admin/oem/reverse?number=${encodeURIComponent(number)}`);
}

export function scanFahrzeugschein(imageBase64: string): Promise<ScheinScanResult> {
    return apiFetch<ScheinScanResult>('/api/admin/oem/scan-fahrzeugschein', { method: 'POST', body: JSON.stringify({ image: imageBase64 }) });
}
