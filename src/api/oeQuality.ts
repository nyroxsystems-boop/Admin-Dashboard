/**
 * OE-Qualität API — Metriken der OE-Lernschleife + Review-Queue der Verdachtsfälle.
 *
 * Backend contract (Bot-Admin-API):
 *   GET  /api/admin/oe-metrics
 *   GET  /api/admin/oe-review-queue?status=open&limit=50
 *   POST /api/admin/oe-review-queue/:id/close   body { action: 'dismiss' | 'refute' }
 *
 * Fachlicher Kontext: Die Lernschleife sammelt bestätigte OE-Nummern aus vier
 * Quellen (photo = Altteil-Foto, customer-pick = Kundenwahl, dealer = Händler,
 * qa-session = Partslink-Verifikation). Die Review-Queue enthält Verdachtsfälle
 * (z. B. „Keine Angebote auf gewählte OE"). `refute` entfernt die OE DAUERHAFT
 * aus dem gelernten Wissen — die View erzwingt dafür einen Bestätigungs-Dialog.
 *
 * Blöcke, deren Migration (170) noch nicht aktiv ist, liefern ein `error`-Feld
 * statt Daten — die View zeigt dann einen dezenten Hinweis statt Kaputt-Optik.
 */

import { apiFetch } from './client';

// ──────────────────────────────────────────────────────────────────────────
//  Typen (exakt der Backend-Vertrag)
// ──────────────────────────────────────────────────────────────────────────

export interface OeKnowledgeMetrics {
    total: number;
    bySource: Record<string, number>;
    last7d: number;
    error?: string;
}

export interface OeReviewQueueMetrics {
    open: number;
    last7d: number;
    error?: string;
}

export interface OeLookupMetrics {
    total: number;
    unresolvedRate: number;
    byMode: Record<string, number>;
    error?: string;
}

export interface PartslinkComparisonMetrics {
    targetRate: number;
    minimumComparable: number;
    attempted: number;
    completed: number;
    pending: number;
    processing: number;
    matches: number;
    partial: number;
    mismatches: number;
    notComparable: number;
    providerErrors: number;
    blocked: number;
    comparable: number;
    accuracyRate: number | null;
    completionRate: number;
    position: { checked: number; matches: number; rate: number | null };
    grouping: { checked: number; matches: number; rate: number | null };
    releaseGatePassed: boolean;
    enabled: boolean;
    integrationMode: string;
    error?: string;
}

export interface OeMetrics {
    knowledge: OeKnowledgeMetrics;
    reviewQueue: OeReviewQueueMetrics;
    lookups: OeLookupMetrics;
    partslinkComparison: PartslinkComparisonMetrics;
}

export interface OeReviewItem {
    id: string;
    oe_number: string;
    oe_number_norm: string;
    linkage_target_id: number | null;
    part_type_norm: string | null;
    reason: string;
    tenant_id: string | null;
    status: string;
    created_at: string;
}

export interface OeReviewQueueResponse {
    items: OeReviewItem[];
    error?: string;
}

export type PartslinkComparisonStatus =
    | 'pending'
    | 'processing'
    | 'match'
    | 'partial'
    | 'mismatch'
    | 'not_comparable'
    | 'provider_error'
    | 'blocked';

export interface PartslinkComparisonItem {
    id: string;
    source_context: string;
    part_query: string;
    vehicle_label: string | null;
    yq_status: string;
    yq_exact_oem: string | null;
    yq_oem_numbers: string[];
    yq_groups: string[];
    requested_axle: string | null;
    requested_side: string | null;
    requested_grouping: string | null;
    status: PartslinkComparisonStatus;
    oe_match: boolean | null;
    position_match: boolean | null;
    grouping_match: boolean | null;
    partslink_results: Array<{ oem: string; description?: string }>;
    comparison_reason: string | null;
    attempts: number;
    last_error_code: string | null;
    compared_at: string | null;
    created_at: string;
}

export interface PartslinkComparisonResponse {
    status: PartslinkComparisonStatus;
    items: PartslinkComparisonItem[];
    error?: string;
}

export type OeReviewCloseAction = 'dismiss' | 'refute';

export interface OeReviewCloseResponse {
    closed: boolean;
    refutedRows: number;
}

// ──────────────────────────────────────────────────────────────────────────
//  Calls (dünn über apiFetch — Auth/Retry/Timeout macht der Wrapper)
// ──────────────────────────────────────────────────────────────────────────

export async function getOeMetrics(): Promise<OeMetrics> {
    return apiFetch<OeMetrics>('/api/admin/oe-metrics');
}

export async function getOeReviewQueue(
    status = 'open',
    limit = 50,
): Promise<OeReviewQueueResponse> {
    const qs = new URLSearchParams({ status, limit: String(limit) });
    return apiFetch<OeReviewQueueResponse>(`/api/admin/oe-review-queue?${qs.toString()}`);
}

export async function getPartslinkComparisons(
    status: PartslinkComparisonStatus = 'mismatch',
    limit = 50,
): Promise<PartslinkComparisonResponse> {
    const qs = new URLSearchParams({ status, limit: String(limit) });
    return apiFetch<PartslinkComparisonResponse>(
        `/api/admin/oe-partslink-comparisons?${qs.toString()}`,
    );
}

export async function closeOeReviewItem(
    id: string,
    action: OeReviewCloseAction,
): Promise<OeReviewCloseResponse> {
    return apiFetch<OeReviewCloseResponse>(
        `/api/admin/oe-review-queue/${encodeURIComponent(id)}/close`,
        {
            method: 'POST',
            body: JSON.stringify({ action }),
        },
    );
}
