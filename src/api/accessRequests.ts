/**
 * Access-Requests API — Großhändler-Zugänge für einen Kunden beantragen.
 *
 * Backend: /api/admin/access-requests (providers / preview / send / history).
 */

import { apiFetch } from './client';

export type AccessProviderKind = 'wholesaler';

export interface AccessProvider {
    key: string;
    name: string;
    kind: AccessProviderKind;
    country: string;
    website: string;
    hasApi: boolean;
    requestEmail: string | null;
    requestContactName: string | null;
    accessLabel: string;
    grants: string[];
    credentialFields: { key: string; label: string; type: string; required?: boolean }[];
}

export interface AccessRequestPreview {
    provider: { key: string; name: string; kind: AccessProviderKind; website: string };
    customer: {
        tenantId: string;
        companyName: string;
        addressLine: string | null;
        vatId: string | null;
        contactName: string | null;
        contactEmail: string | null;
    };
    recipient: string | null;
    recipientName: string | null;
    subject: string;
    body: string;
    missingFields: string[];
    replyTo: string;
}

export interface AccessRequestHistoryItem {
    id: string;
    tenant_id: string;
    supplier_key: string;
    provider_name: string | null;
    kind: AccessProviderKind | string;
    recipient_email: string;
    recipient_name: string | null;
    subject: string;
    status: 'sent' | 'failed' | string;
    error: string | null;
    requested_by_name: string | null;
    created_at: string;
}

export async function listAccessProviders(): Promise<AccessProvider[]> {
    const raw = await apiFetch<{ providers: AccessProvider[] }>('/api/admin/access-requests/providers');
    return raw.providers ?? [];
}

export async function previewAccessRequest(
    tenantId: string,
    supplierKey: string,
): Promise<AccessRequestPreview> {
    return apiFetch<AccessRequestPreview>('/api/admin/access-requests/preview', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId, supplier_key: supplierKey }),
    });
}

export async function sendAccessRequest(input: {
    tenantId: string;
    supplierKey: string;
    recipient: string;
    subject: string;
    body: string;
    cc?: string | null;
}): Promise<{ success: boolean; id: string; status: string; messageId?: string }> {
    return apiFetch('/api/admin/access-requests/send', {
        method: 'POST',
        body: JSON.stringify({
            tenant_id: input.tenantId,
            supplier_key: input.supplierKey,
            recipient: input.recipient,
            subject: input.subject,
            body: input.body,
            cc: input.cc ?? undefined,
        }),
    });
}

export async function getAccessRequestHistory(
    tenantId?: string,
): Promise<AccessRequestHistoryItem[]> {
    const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
    const raw = await apiFetch<{ requests: AccessRequestHistoryItem[] }>(
        `/api/admin/access-requests${qs}`,
    );
    return raw.requests ?? [];
}
