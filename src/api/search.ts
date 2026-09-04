/**
 * Globale Admin-Suche (P1.5) — tenant-übergreifend: Händler, Kunde/Telefon,
 * OEM, Teil, Order-ID. Liefert sprungfähige Treffer (tenantId/orderId).
 */
import { apiFetch } from './client';

export interface GlobalSearchResult {
    type: 'tenant' | 'order';
    id: string;
    label: string;
    sublabel?: string;
    tenantId: string;
    orderId?: string;
}

export async function getGlobalSearch(q: string): Promise<GlobalSearchResult[]> {
    const query = q.trim();
    if (query.length < 2) return [];
    const raw = await apiFetch<{ results?: GlobalSearchResult[] }>(
        `/api/admin/search?q=${encodeURIComponent(query)}`
    );
    return raw?.results ?? [];
}
