/**
 * OEM Database API — registry CRUD, lookup, batch, accuracy stats.
 */

import { apiFetch } from './client';
import {
    OemDatabaseStatsSchema,
    OemLookupResultSchema,
    OemRecordsResponseSchema,
    parseApiResponse,
    type OemDatabaseStats,
    type OemLookupResult,
    type OemRecord,
    type OemRecordsResponse,
} from './types';
import { z } from 'zod';

// ── Registry stats ─────────────────────────────────────────────────────────

export async function getOemDatabaseStats(): Promise<OemDatabaseStats> {
    const raw = await apiFetch<unknown>('/api/admin/oem-database/stats');
    return parseApiResponse(OemDatabaseStatsSchema, raw);
}

export async function triggerOemSeeder(
    script: 'massive' | 'remaining' | 'standalone' = 'massive'
): Promise<{ success: boolean; jobId: string; message: string }> {
    return apiFetch('/api/admin/oem-database/seed', {
        method: 'POST',
        body: JSON.stringify({ script }),
    });
}

export async function runOemValidator(
    fix = false
): Promise<{ success: boolean; jobId: string; message: string }> {
    return apiFetch('/api/admin/oem-database/validate', {
        method: 'POST',
        body: JSON.stringify({ fix }),
    });
}

// ── Registry CRUD ──────────────────────────────────────────────────────────

export interface OemSearchParams {
    page?: number;
    limit?: number;
    search?: string;
    brand?: string;
    category?: string;
    modelCode?: string;
    year?: number;
    yearFrom?: number;
    yearTo?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export async function getOemRecords(params: OemSearchParams = {}): Promise<OemRecordsResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.brand) query.set('brand', params.brand);
    if (params.category) query.set('category', params.category);
    if (params.modelCode) query.set('model_code', params.modelCode);
    if (params.year) query.set('year', String(params.year));
    if (params.yearFrom) query.set('year_from', String(params.yearFrom));
    if (params.yearTo) query.set('year_to', String(params.yearTo));
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    const raw = await apiFetch<unknown>(`/api/admin/oem-records?${query.toString()}`);
    return parseApiResponse(OemRecordsResponseSchema, raw);
}

export async function createOemRecord(
    data: Omit<OemRecord, 'id' | 'created_at' | 'sources'>
): Promise<{ success: boolean; id: number }> {
    return apiFetch('/api/admin/oem-records', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateOemRecord(
    id: number,
    data: Partial<OemRecord>
): Promise<{ success: boolean }> {
    return apiFetch(`/api/admin/oem-records/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteOemRecord(id: number): Promise<{ success: boolean }> {
    return apiFetch(`/api/admin/oem-records/${id}`, { method: 'DELETE' });
}

export async function bulkDeleteOemRecords(ids: number[]): Promise<{ success: boolean; deleted: number }> {
    return apiFetch('/api/admin/oem-records/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
    });
}

// ── Lookup ─────────────────────────────────────────────────────────────────

export async function lookupOem(oem: string): Promise<OemLookupResult> {
    const raw = await apiFetch<unknown>('/api/admin/oem-lookup', {
        method: 'POST',
        body: JSON.stringify({ oem }),
    });
    return parseApiResponse(OemLookupResultSchema, raw);
}

export async function approveOemResult(data: {
    oem: string;
    brand: string;
    part_category: string;
    part_description: string;
    model: string;
    confidence: number;
}): Promise<{ success: boolean; action: string; id: number }> {
    return apiFetch('/api/admin/oem-lookup/approve', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function resolveOemForward(params: {
    vehicle: { vin?: string; hsn?: string; tsn?: string; make?: string; model?: string; year?: string; engine?: string };
    part: string;
}): Promise<{
    success: boolean;
    oem: string | null;
    candidates: Array<{ oem: string; brand: string; confidence: number; source: string; note?: string }>;
    notes: string | null;
    confidence: number;
}> {
    return apiFetch('/api/demo/oem-resolve', {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

export async function reverseOemLookup(oem: string): Promise<{
    success: boolean;
    oem: string;
    partName?: string;
    partCategory?: string;
    vehicles?: string;
    manufacturer?: string;
    confidence?: number;
    notes?: string;
}> {
    return apiFetch('/api/bot-testing/oem-reverse-lookup', {
        method: 'POST',
        body: JSON.stringify({ oem }),
    });
}

// ── VIN Search ─────────────────────────────────────────────────────────────

export interface VinDecodedInfo {
    brand: string | null;
    year: number | null;
    group: string | null;
    wmi: string;
    isVAG: boolean;
    motorcode?: string;
    nhtsaModel?: string;
    nhtsaEngine?: string;
    nhtsaDisplacement?: number;
}

export interface VinSearchResponse {
    vin: string;
    decoded: VinDecodedInfo;
    total: number;
    records: OemRecord[];
}

export async function searchOemByVin(
    vin: string,
    opts?: { limit?: number; category?: string }
): Promise<VinSearchResponse> {
    return apiFetch('/api/admin/oem-records/by-vin', {
        method: 'POST',
        body: JSON.stringify({ vin, ...opts }),
    });
}

// ── Errors / Review ────────────────────────────────────────────────────────

export const OemErrorEntrySchema = z.object({
    id: z.union([z.number(), z.string()]).transform((v) => String(v)),
    oem: z.string(),
    error: z.string(),
    occurred_at: z.string(),
    resolved: z.boolean().default(false),
});
export type OemErrorEntry = z.infer<typeof OemErrorEntrySchema>;

export async function listOemErrors(): Promise<OemErrorEntry[]> {
    // The bot-service has no dedicated /oem-errors endpoint. We surface the
    // same data via the OEM resolutions log (rejected / unresolved entries).
    // If even that 404s, fall back to an empty list so the UI degrades to
    // an EmptyState rather than crashing.
    try {
        const raw = await apiFetch<unknown>('/api/admin/oem/resolutions');
        const arr = Array.isArray(raw)
            ? raw
            : (raw as { items?: unknown[]; data?: unknown[] })?.items
              ?? (raw as { data?: unknown[] })?.data
              ?? [];
        const parsed = z.array(OemErrorEntrySchema).safeParse(arr);
        return parsed.success ? parsed.data : [];
    } catch {
        return [];
    }
}

export async function resolveOemError(id: string | number): Promise<{ success: boolean }> {
    // Backend route is /api/admin/oem/feedback/:id (POST).
    await apiFetch(`/api/admin/oem/feedback/${id}`, {
        method: 'POST',
        body: JSON.stringify({ resolved: true }),
    });
    return { success: true };
}

// ── Accuracy ───────────────────────────────────────────────────────────────

export interface AccuracyStats {
    totalResolutions: number;
    withOem: number;
    withoutOem: number;
    confirmed: number;
    rejected: number;
    pending: number;
    resolutionRate: number;
    accuracyRate: number;
    avgConfidence: number;
    avgDurationMs: number;
    sourceStats: Record<string, { contributed: number; confirmed: number; rejected: number }>;
    brandStats: Record<string, { total: number; resolved: number; confirmed: number }>;
}

export async function fetchAccuracyStats(): Promise<AccuracyStats> {
    // Backend route: /api/admin/oem/accuracy (no /v1, no /stats subpath).
    const res = await apiFetch<{ data?: AccuracyStats } & Partial<AccuracyStats>>(
        '/api/admin/oem/accuracy'
    );
    // Some backend variants wrap in `{ data }`, others return flat.
    return (res.data ?? (res as AccuracyStats));
}
