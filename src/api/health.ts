/**
 * System Health API — adapts the bot-service public /health response into
 * the SystemHealth shape used by the dashboard. /health is unauthenticated
 * (mounted on `app.use("/health", healthRouter)`), so we don't need an
 * Authorization header.
 */

import { apiFetch } from './client';
import { type SystemHealth } from './types';

interface BackendHealthCheck {
    status?: string;
    latencyMs?: number;
    detail?: string;
}
interface BackendHealth {
    status?: string; // 'ok' | 'degraded' | …
    timestamp?: string;
    checks?: {
        database?: BackendHealthCheck;
        redis?: BackendHealthCheck;
        queue?: BackendHealthCheck;
    };
}

function mapStatus(s?: string): 'ok' | 'degraded' | 'down' {
    if (!s) return 'down';
    if (s === 'ok') return 'ok';
    if (s === 'degraded') return 'degraded';
    return 'down';
}

export async function getSystemHealth(): Promise<SystemHealth> {
    const raw = await apiFetch<BackendHealth>('/health');
    return {
        db: mapStatus(raw.checks?.database?.status),
        redis: mapStatus(raw.checks?.redis?.status),
        // The bot-service exposes a queue worker status — surface it under
        // the dashboard's `botApi` slot since that's the closest semantic.
        botApi: mapStatus(raw.checks?.queue?.status ?? raw.status),
        timestamp: raw.timestamp,
    };
}

export async function pingService(
    service: 'redis' | 'db' | 'botApi'
): Promise<{ status: 'ok' | 'degraded' | 'down'; latencyMs?: number }> {
    const h = await getSystemHealth();
    return { status: h[service] };
}
