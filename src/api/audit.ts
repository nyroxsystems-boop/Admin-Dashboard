/**
 * Audit Log API — cursor pagination, filters, CSV export.
 */

import { apiFetch, apiFetchBlob } from './client';
import { AuditLogPageSchema, AuditLogSchema, parseApiResponse, type AuditLog, type AuditLogPage } from './types';
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
    const raw = await apiFetch<unknown>(`/api/admin/activity-log?limit=${limit}`);
    const parsed = z.array(AuditLogSchema).safeParse(raw);
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
    // Backend may return either { logs } or { logs, cursor, hasMore }.
    return parseApiResponse(AuditLogPageSchema, raw);
}

export async function exportAuditLogCsv(query: AuditLogQuery = {}): Promise<Blob> {
    const params = new URLSearchParams();
    if (query.actionType) params.set('action_type', query.actionType);
    if (query.adminUsername) params.set('admin', query.adminUsername);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    params.set('format', 'csv');
    return apiFetchBlob(`/api/admin/audit-log/export?${params.toString()}`);
}
