/**
 * Audit Log API — cursor pagination, filters, CSV export.
 */

import { apiFetch } from './client';
import { AuditLogPageSchema, AuditLogSchema, type AuditLog, type AuditLogPage } from './types';
import { z } from 'zod';

export interface AuditLogQuery {
    limit?: number;
    cursor?: string;
    actionType?: string;
    adminUsername?: string;
    entityType?: string;
    from?: string;
    to?: string;
}

export async function getActivityLog(limit = 50): Promise<AuditLog[]> {
    // Backend has /audit-log, not /activity-log.
    const raw = await apiFetch<unknown>(`/api/admin/audit-log?limit=${limit}`);
    const arr = Array.isArray(raw)
        ? raw
        : (raw as { logs?: unknown[] })?.logs ?? [];
    const parsed = z.array(AuditLogSchema).safeParse(arr);
    return parsed.success ? parsed.data : [];
}

export async function getAuditLog(query: AuditLogQuery = {}): Promise<AuditLogPage> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.actionType) params.set('action_type', query.actionType);
    if (query.adminUsername) params.set('admin', query.adminUsername);
    if (query.entityType) params.set('entity_type', query.entityType);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);

    const qs = params.toString();
    const raw = await apiFetch<unknown>(`/api/admin/audit-log${qs ? `?${qs}` : ''}`);
    // Backend may return either { logs } or { logs, cursor, hasMore } or
    // a bare array. Normalize to the schema's expected shape.
    const normalized = Array.isArray(raw) ? { logs: raw } : raw;
    const parsed = AuditLogPageSchema.safeParse(normalized);
    if (parsed.success) return parsed.data;
    return { logs: [], cursor: null, hasMore: false };
}

export async function exportAuditLogCsv(query: AuditLogQuery = {}): Promise<Blob> {
    // Backend has no dedicated export route — synthesize CSV client-side
    // by paging through the regular audit-log endpoint.
    const limit = query.limit ?? 1000;
    const page = await getAuditLog({ ...query, limit });
    const rows = page.logs;

    const headers = ['id', 'created_at', 'admin_user', 'action_type', 'entity_type', 'entity_id', 'ip_address'];
    const escape = (v: unknown): string => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv =
        headers.join(',') +
        '\n' +
        rows
            .map((r: Record<string, unknown>) =>
                headers.map((h) => escape(r[h])).join(',')
            )
            .join('\n');
    return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}
