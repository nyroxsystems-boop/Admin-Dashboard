/**
 * System Health API — Redis, DB, Bot-API connectivity status.
 */

import { apiFetch } from './client';
import { SystemHealthSchema, parseApiResponse, type SystemHealth } from './types';

export async function getSystemHealth(): Promise<SystemHealth> {
    const raw = await apiFetch<unknown>('/api/admin/health');
    return parseApiResponse(SystemHealthSchema, raw);
}

export async function pingService(
    service: 'redis' | 'db' | 'botApi'
): Promise<{ status: 'ok' | 'degraded' | 'down'; latencyMs?: number }> {
    return apiFetch(`/api/admin/health/${service}`);
}
