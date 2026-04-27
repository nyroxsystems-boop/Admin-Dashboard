/**
 * PartsLink24 Catalog Scraper & Bulk OEM Scraper API.
 *
 * The scraper service runs as a separate microservice. The base URL
 * MUST be supplied via VITE_SCRAPER_BASE_URL — no hardcoded fallback.
 */

/// <reference types="vite/client" />

/**
 * Resolved at first call (NOT at module load) so the rest of the app
 * still boots even if the scraper microservice isn't configured. Pages
 * that don't touch scraper functionality (Dashboard, Tenants, Audit, …)
 * will never trigger this check.
 */
function getScraperUrl(): string {
    const raw = import.meta.env.VITE_SCRAPER_BASE_URL;
    if (!raw || typeof raw !== 'string') {
        throw new Error(
            'VITE_SCRAPER_BASE_URL ist nicht gesetzt. Setze die Variable in den Railway-Service-Variables (oder .env), um Scraper-Funktionen zu nutzen.'
        );
    }
    return raw.replace(/\/+$/, '');
}

export function isScraperConfigured(): boolean {
    const raw = import.meta.env.VITE_SCRAPER_BASE_URL;
    return Boolean(raw && typeof raw === 'string');
}

async function scraperFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = getScraperUrl();
    const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers as Record<string, string> | undefined),
        },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || res.statusText || `Scraper error: ${res.status}`);
    }
    return res.json();
}

// ── PartsLink24 Lookup ─────────────────────────────────────────────────────

export interface PartslinkResult {
    success: boolean;
    vin: string;
    part: string;
    brand?: string | null;
    results: Array<{
        oem: string;
        description: string;
        bildtafel?: string;
        hg?: string;
        fg?: string;
    }>;
    fromCache: boolean;
    elapsedMs?: number;
    cachedAt?: string;
    error?: string;
}

export async function lookupPartslink24(params: {
    vin: string;
    part: string;
    brand?: string;
}): Promise<PartslinkResult> {
    return scraperFetch<PartslinkResult>('/api/lookup', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

export async function getPartslinkHealth(): Promise<{ status: string; service: string }> {
    return scraperFetch('/api/health');
}

// ── Bulk Scraper ───────────────────────────────────────────────────────────

export interface BulkVehicle {
    id: number;
    vin: string;
    brand: string;
    model: string;
    model_code: string | null;
    year_from: number | null;
    year_to: number | null;
    notes: string | null;
    is_active: number;
    created_at: string;
}

export interface BulkJob {
    id: number;
    vehicle_id: number;
    vin: string;
    brand: string;
    model: string;
    status: 'pending' | 'queued' | 'running' | 'paused' | 'completed' | 'failed';
    total_hg: number;
    completed_hg: number;
    total_parts_found: number;
    error_count: number;
    last_error: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
}

export interface BulkStatus {
    running: boolean;
    paused: boolean;
    currentJob: BulkJob | null;
    totalVehicles: number;
    activeVehicles: number;
    totalJobs: number;
    totalResults: number;
    resultsByBrand: Array<{ brand: string; count: number }>;
}

export interface BulkResultRow {
    oem: string;
    description: string | null;
    brand: string;
    model: string;
    bildtafel: string | null;
    hg_code: string | null;
    hg_name: string | null;
    fg_code: string | null;
    fg_name: string | null;
}

export interface BulkJobProgress {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    byHg: Array<{
        hg_code: string;
        hg_name: string | null;
        total: number;
        completed: number;
        failed: number;
        parts_found: number;
    }>;
}

export const getBulkStatus = (): Promise<BulkStatus> => scraperFetch('/api/bulk/status');

export const getBulkVehicles = (brand?: string): Promise<{ vehicles: BulkVehicle[] }> =>
    scraperFetch(`/api/bulk/vehicles${brand ? `?brand=${encodeURIComponent(brand)}` : ''}`);

export const createBulkVehicle = (data: {
    vin: string;
    brand: string;
    model: string;
    model_code?: string;
    year_from?: number;
    year_to?: number;
    notes?: string;
}): Promise<{ success: boolean; id: number }> =>
    scraperFetch('/api/bulk/vehicles', { method: 'POST', body: JSON.stringify(data) });

export const updateBulkVehicle = (
    id: number,
    data: Record<string, unknown>
): Promise<{ success: boolean }> =>
    scraperFetch(`/api/bulk/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const discoverFromPL24 = (): Promise<{
    success: boolean;
    brands: string[];
    models: Array<{ brand: string; model: string }>;
    errors: string[];
}> => scraperFetch('/api/bulk/discover', { method: 'POST' });

export const seedBulkVins = (): Promise<{
    success: boolean;
    added: number;
    skipped: number;
    total: number;
    availableVins: number;
}> => scraperFetch('/api/bulk/vehicles/seed', { method: 'POST' });

export const deleteBulkVehicle = (id: number): Promise<{ success: boolean }> =>
    scraperFetch(`/api/bulk/vehicles/${id}`, { method: 'DELETE' });

export const startBulkJob = (vehicleId: number): Promise<{ success: boolean; jobId: number }> =>
    scraperFetch('/api/bulk/jobs/start', {
        method: 'POST',
        body: JSON.stringify({ vehicleId }),
    });

export const startAllBulkJobs = (): Promise<{ success: boolean; queued: number }> =>
    scraperFetch('/api/bulk/jobs/start-all', { method: 'POST' });

export const pauseBulkJob = (jobId: number): Promise<{ success: boolean }> =>
    scraperFetch(`/api/bulk/jobs/${jobId}/pause`, { method: 'POST' });

export const resumeBulkJob = (jobId: number): Promise<{ success: boolean }> =>
    scraperFetch(`/api/bulk/jobs/${jobId}/resume`, { method: 'POST' });

export const cancelBulkJob = (jobId: number): Promise<{ success: boolean }> =>
    scraperFetch(`/api/bulk/jobs/${jobId}/cancel`, { method: 'POST' });

export const cancelAllBulkJobs = (): Promise<{ success: boolean; cancelled: number }> =>
    scraperFetch('/api/bulk/cancel-all', { method: 'POST' });

export const getBulkJobs = (opts?: { status?: string }): Promise<{ jobs: BulkJob[]; total: number }> => {
    const params = new URLSearchParams();
    if (opts?.status) params.set('status', opts.status);
    return scraperFetch(`/api/bulk/jobs?${params}`);
};

export const getBulkJobDetail = (jobId: number): Promise<{ job: BulkJob; progress: BulkJobProgress }> =>
    scraperFetch(`/api/bulk/jobs/${jobId}`);

export const getBulkJobResults = (
    jobId: number,
    opts?: { limit?: number; offset?: number; search?: string }
): Promise<{ results: BulkResultRow[]; total: number }> => {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    if (opts?.search) params.set('search', opts.search);
    return scraperFetch(`/api/bulk/jobs/${jobId}/results?${params}`);
};

export const exportBulkToOemDb = (
    jobIds?: number[]
): Promise<{ success: boolean; total: number; exported: number; errors: number }> =>
    scraperFetch('/api/bulk/export', { method: 'POST', body: JSON.stringify({ jobIds }) });

export const getBrands = (): Promise<{ brands: string[] }> => scraperFetch('/api/bulk/brands');

export const crawlBrand = (
    brand: string,
    mode: 'api' | 'browser' = 'api'
): Promise<{ success: boolean; message: string }> =>
    scraperFetch('/api/bulk/crawl-brand', {
        method: 'POST',
        body: JSON.stringify({ brand, mode }),
    });

// ── Brand Chain ────────────────────────────────────────────────────────────

export interface BrandChainError {
    brand: string;
    message: string;
    at: string;
}

export interface BrandChainState {
    active: boolean;
    paused: boolean;
    cancelled: boolean;
    mode: 'api' | 'browser';
    brands: string[];
    currentIndex: number;
    currentBrand: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    lastCompletedBrand: string | null;
    completedBrands: string[];
    errors: BrandChainError[];
    totalOemsAllBrands: number;
    totalModelsAllBrands: number;
}

export const startBrandChain = (
    startBrand: string,
    mode: 'api' | 'browser' = 'api'
): Promise<{ success: boolean; state: BrandChainState }> =>
    scraperFetch('/api/bulk/chain/start', {
        method: 'POST',
        body: JSON.stringify({ startBrand, mode }),
    });

export const pauseBrandChain = (): Promise<{ success: boolean; state: BrandChainState }> =>
    scraperFetch('/api/bulk/chain/pause', { method: 'POST' });

export const resumeBrandChain = (): Promise<{ success: boolean; state: BrandChainState }> =>
    scraperFetch('/api/bulk/chain/resume', { method: 'POST' });

export const cancelBrandChain = (): Promise<{ success: boolean; state: BrandChainState }> =>
    scraperFetch('/api/bulk/chain/cancel', { method: 'POST' });

export const getBrandChainState = (): Promise<BrandChainState> => scraperFetch('/api/bulk/chain/state');
