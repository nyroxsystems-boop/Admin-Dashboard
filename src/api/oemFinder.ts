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

export interface YqCatalogIntelligence {
    schemaVersion: 'yq-catalog-intelligence-v1';
    brand: string;
    family: string | null;
    canonicalQuery: string;
    grouping: 'single' | 'set' | 'insert' | 'housing' | 'assembly' | 'unspecified';
    position: {
        axle: 'front' | 'rear' | null;
        side: 'left' | 'right' | null;
        position: 'front-left' | 'front-right' | 'rear-left' | 'rear-right' | 'front' | 'rear' | 'left' | 'right' | null;
        axleConflict: boolean;
        sideConflict: boolean;
    };
    confidence: 'high' | 'medium' | 'low';
    searchTerms: string[];
    excludedConcepts: string[];
    sources: string[];
}

export interface YqUniversalCorpusStatus {
    attempted: boolean;
    loaded: boolean;
    path: string | null;
    error: string | null;
    brands: string[];
    metrics: {
        records: number;
        groupPaths: number;
        categories: number;
        units: number;
        sections: number;
        partNames: number;
        providerMatchedPartNames: number;
        unknownMatchedPartNames: number;
    } | null;
}

export interface YqCatalogAiStatus {
    enabled: boolean;
    localAiActive: boolean;
    operational: boolean;
    timeoutMs: number;
    mode: 'grounded-terminology-only';
    canGenerateOeNumbers: false;
    requiresDealerConfirmationForUnknownSlang: true;
}

export interface OemCatalogPreview {
    action: 'ready' | 'clarify-position' | 'clarify-part' | 'unresolved';
    originalPart: string;
    brand: string;
    recognized: boolean;
    canonicalPart: string | null;
    canonicalQuery: string | null;
    family: string | null;
    grouping: YqCatalogIntelligence['grouping'];
    position: YqCatalogIntelligence['position'];
    missingPosition: Array<'axle' | 'side'>;
    confirmationOptions: Array<{
        canonicalPart: string;
        canonicalQuery: string;
        family: string;
        grouping: YqCatalogIntelligence['grouping'];
        confidence: number;
        missingPosition: Array<'axle' | 'side'>;
    }>;
    groundedLabels: string[];
    catalogPlan: Pick<YqCatalogIntelligence, 'confidence' | 'searchTerms' | 'excludedConcepts' | 'sources'>;
    runtime: {
        universalCorpus: YqUniversalCorpusStatus;
        catalogAi: YqCatalogAiStatus;
    };
    safeguards: {
        universalYqPrimary: true;
        oeTreeSecondary: true;
        canModelGenerateOeNumbers: false;
        unknownSlangRequiresConfirmation: true;
        oeLookupAllowed: boolean;
    };
}

export interface OemSystemInfo {
    universalYqCorpus: YqUniversalCorpusStatus;
    catalogAi: YqCatalogAiStatus;
    features: {
        universalYqPrimary?: boolean;
        oeTreeSecondary?: boolean;
        unknownSlangConfirmation?: boolean;
        [key: string]: boolean | undefined;
    };
    pipelineSteps: string[];
}

/** Ausstattungsabhängige Ausführung (z. B. Bremsscheibe Ø 280 belüftet, PR-Nr. 1LB). */
export interface OemFitmentVariant {
    oem: string;
    label: string;
    criteria: Record<string, string>;
    articleCount: number;
    image?: string | null;
    matched?: boolean | null;
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
    catalogIntelligence?: YqCatalogIntelligence;
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
    evidence?: {
        level: 'native-exact' | 'native-candidate' | 'heuristic-candidate' | 'incomplete';
        providerMatched: boolean;
        filterStateCarried: boolean;
        applicabilityVerified: boolean;
        traversalComplete: boolean;
        releaseSafe: boolean;
        occurrenceIds: string[];
    };
    parts?: Array<{
        oem: string;
        name: string;
        group: string;
        category?: string;
        unit?: string;
        section?: string;
        matched?: boolean | null;
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

export function previewOemCatalogIntent(body: {
    part: string;
    brand?: string;
}): Promise<OemCatalogPreview> {
    return apiFetch<OemCatalogPreview>('/api/admin/oem/catalog-intelligence/preview', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function getOemSystemInfo(): Promise<OemSystemInfo> {
    return apiFetch<OemSystemInfo>('/api/admin/oem/system-info');
}

export function oemReverse(number: string): Promise<OemReverseResult> {
    return apiFetch<OemReverseResult>(`/api/admin/oem/reverse?number=${encodeURIComponent(number)}`);
}

export function scanFahrzeugschein(imageBase64: string): Promise<ScheinScanResult> {
    return apiFetch<ScheinScanResult>('/api/admin/oem/scan-fahrzeugschein', { method: 'POST', body: JSON.stringify({ image: imageBase64 }) });
}
