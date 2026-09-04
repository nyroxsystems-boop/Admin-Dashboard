/**
 * useImpersonate — Tenant-impersonation flow.
 *
 * Calls POST /api/admin/tenants/:tenantId/impersonate to obtain a
 * short-lived JWT scoped to the target tenant. On success, opens the
 * user dashboard in a new tab with the impersonation token.
 *
 * The backend endpoint must:
 *  1. Verify the caller is a super-admin
 *  2. Issue a JWT with { sub: adminId, tenantId, impersonating: true, exp: 1h }
 *  3. Log the impersonation event to the audit trail
 */

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import { setActiveImpersonation } from '@/lib/impersonationSession';

export interface ImpersonateInput {
    tenantId: number | string;
    userId?: number | string;
    reason?: string;
    /** Anzeigename für den Topbar-Banner (P1.4). */
    tenantName?: string;
}

export interface ImpersonateResult {
    success: boolean;
    /** Audit H-1: single-use ticket exchanged for the token by the user
     *  dashboard (the JWT is NEVER placed in a URL anymore). */
    ticket?: string;
    /** Server-side revoke handle for "exit impersonation". */
    sessionId?: string;
    expiresAt?: string;
    dashboardUrl?: string;
}

const USER_DASHBOARD_BASE = import.meta.env.VITE_USER_DASHBOARD_URL || 'https://app.partsunion.de';

export function useImpersonate(): UseMutationResult<
    ImpersonateResult,
    Error,
    ImpersonateInput
> {
    return useMutation({
        mutationFn: async (input: ImpersonateInput): Promise<ImpersonateResult> => {
            const tenantPathId = encodeURIComponent(String(input.tenantId));
            const result = await apiFetch<ImpersonateResult>(
                `/api/admin/tenants/${tenantPathId}/impersonate`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        userId: input.userId,
                        reason: input.reason || 'Admin impersonation via dashboard',
                    }),
                }
            );

            // Audit H-1: open the user dashboard with a single-use TICKET, not
            // the JWT. The ticket is short-lived + single-use, so a URL/Referer/
            // log leak is worthless after the user dashboard redeems it.
            if (result.ticket) {
                const url = `${USER_DASHBOARD_BASE}/impersonate?ticket=${encodeURIComponent(result.ticket)}`;
                window.open(url, '_blank', 'noopener,noreferrer');
                // P1.4: Marker setzen, damit der AdminTopbar einen „Impersonation
                // läuft"-Banner zeigt (der eigentliche Tab ist das User-Dashboard).
                // sessionId erlaubt das serverseitige Beenden ("Zurück zum Admin").
                setActiveImpersonation({
                    tenantId: String(input.tenantId),
                    tenantName: input.tenantName ?? String(input.tenantId),
                    sessionId: result.sessionId ?? null,
                    expiresAt: result.expiresAt ?? null,
                    startedAt: new Date().toISOString(),
                });
            }

            return result;
        },
    });
}
