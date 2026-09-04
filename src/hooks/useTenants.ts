/**
 * useTenants — real-API tenant CRUD + active-device management.
 *
 * Differences from previous stub shape:
 *   - Tenant.id is `number` (was string), Tenant.name/slug unchanged
 *   - tenant.user_count / max_users / device_count / max_devices replace
 *     usersCount / devicesCount / usersLimit / devicesLimit
 *   - tenant.is_active (boolean) replaces status: 'active'|'trial'|'disabled'|'pending'
 *     (use `payment_status` and `onboarding_status` for the legacy nuance)
 *   - No `orderTrend`, no `health`, no `lastSeenAt` — those are now
 *     derived from getAdminStats()/getSystemHealth() if the view needs them
 *   - createTenant input now requires { name, email } (and optionals)
 *     instead of just { name }
 *   - updateTenant accepts { name?, whatsapp_number?, logo_url? }
 *   - Use useUpdateTenantLimits for { max_users, max_devices } changes
 */

import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseQueryResult,
    type UseMutationResult,
} from '@tanstack/react-query';
import {
    listTenants,
    getTenant,
    createTenant,
    updateTenant,
    updateTenantLimits,
    deactivateTenant,
    activateTenant,
    suspendTenant,
    unsuspendTenant,
    deleteTenant,
    restoreTenant,
    purgeTenant,
    listActiveDevices,
    getTenantConversations,
    getTenantIssues,
    type CreateTenantResult,
    type TenantBillingInput,
    type TenantTaxInput,
    type TenantConversation,
    type TenantIssues,
    removeActiveDevice,
} from '@/api/tenants';
import type { ActiveTenantDevice, Tenant, TenantDetail } from '@/api/types';

const TENANTS_KEY = ['admin', 'tenants'] as const;
const tenantKey = (id: number | string): readonly unknown[] =>
    ['admin', 'tenants', String(id)] as const;
const tenantDevicesKey = (id: number | string): readonly unknown[] =>
    ['admin', 'tenants', String(id), 'devices'] as const;

const READ_OPTIONS = { staleTime: 30_000, gcTime: 5 * 60_000 } as const;

export function useTenants(opts: { includeDeleted?: boolean } = {}): {
    tenants: Tenant[];
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        // Eigener Key pro Variante; Mutations invalidieren über den
        // TENANTS_KEY-Präfix weiterhin beide.
        queryKey: [...TENANTS_KEY, opts.includeDeleted ? 'with-deleted' : 'visible'],
        queryFn: () => listTenants({ includeDeleted: opts.includeDeleted }),
        ...READ_OPTIONS,
    });
    return {
        tenants: q.data ?? [],
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}

export function useTenant(
    tenantId: number | string | null | undefined
): UseQueryResult<TenantDetail, Error> {
    return useQuery({
        queryKey: tenantId != null ? tenantKey(tenantId) : ['admin', 'tenants', '__none__'],
        queryFn: () => getTenant(tenantId as number | string),
        enabled: tenantId != null,
        ...READ_OPTIONS,
    });
}

// ── P1.3 Support-Konsole ─────────────────────────────────────────────────────
export function useTenantConversations(
    tenantId: number | string | null | undefined
): UseQueryResult<TenantConversation[], Error> {
    return useQuery({
        queryKey:
            tenantId != null
                ? ['admin', 'tenants', String(tenantId), 'conversations']
                : ['admin', 'tenants', '__none__', 'conversations'],
        queryFn: () => getTenantConversations(tenantId as number | string),
        enabled: tenantId != null,
        ...READ_OPTIONS,
    });
}

export function useTenantIssues(
    tenantId: number | string | null | undefined
): UseQueryResult<TenantIssues, Error> {
    return useQuery({
        queryKey:
            tenantId != null
                ? ['admin', 'tenants', String(tenantId), 'issues']
                : ['admin', 'tenants', '__none__', 'issues'],
        queryFn: () => getTenantIssues(tenantId as number | string),
        enabled: tenantId != null,
        ...READ_OPTIONS,
    });
}

export interface CreateTenantInput {
    name: string;
    email: string;
    website?: string;
    phone?: string;
    password?: string;
    whatsapp_number?: string;
    logo_url?: string;
    // Befund B2: Limits im Create-Payload statt nachgelagertem PATCH /limits.
    max_users?: number;
    max_devices?: number;
    // P1.1 — vollständiges Provisioning (Rechnung/Steuer), optional.
    billing?: TenantBillingInput;
    tax?: TenantTaxInput;
    dpa_accepted?: boolean;
}

export function useCreateTenant(): UseMutationResult<
    CreateTenantResult,
    Error,
    CreateTenantInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => createTenant(input),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: TENANTS_KEY });
        },
    });
}

export interface UpdateTenantInput {
    id: number | string;
    patch: Partial<{
        whatsapp_number: string;
        max_users: number;
        max_devices: number;
        name: string;
        billing: TenantBillingInput;
    }>;
}

export function useUpdateTenant(): UseMutationResult<
    { success: boolean },
    Error,
    UpdateTenantInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, patch }) => updateTenant(id, patch),
        onSuccess: (_data, vars) => {
            void qc.invalidateQueries({ queryKey: TENANTS_KEY });
            void qc.invalidateQueries({ queryKey: tenantKey(vars.id) });
        },
    });
}

export interface UpdateTenantLimitsInput {
    id: number | string;
    limits: { max_users: number; max_devices: number };
}

export function useUpdateTenantLimits(): UseMutationResult<
    void,
    Error,
    UpdateTenantLimitsInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, limits }) => updateTenantLimits(id, limits),
        onSuccess: (_data, vars) => {
            void qc.invalidateQueries({ queryKey: TENANTS_KEY });
            void qc.invalidateQueries({ queryKey: tenantKey(vars.id) });
        },
    });
}

export function useDeactivateTenant(): UseMutationResult<
    { success: boolean },
    Error,
    number | string
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => deactivateTenant(id),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: TENANTS_KEY });
        },
    });
}

export function useActivateTenant(): UseMutationResult<
    { success: boolean },
    Error,
    number | string
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => activateTenant(id),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: TENANTS_KEY });
        },
    });
}

/**
 * Soft-Delete (Befund B7): Tombstone + Billing-Lockout im Backend, Daten
 * bleiben erhalten. Wiederherstellung über useRestoreTenant.
 */
export function useDeleteTenant(): UseMutationResult<
    { success: boolean; tenantId: string; deleted: boolean },
    Error,
    number | string
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => deleteTenant(id),
        onSuccess: (_data, id) => {
            void qc.invalidateQueries({ queryKey: TENANTS_KEY });
            void qc.invalidateQueries({ queryKey: tenantKey(id) });
        },
    });
}

/** Hebt einen Soft-Delete wieder auf. */
export function useRestoreTenant(): UseMutationResult<
    { success: boolean; tenantId: string; deleted: boolean },
    Error,
    number | string
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => restoreTenant(id),
        onSuccess: (_data, id) => {
            void qc.invalidateQueries({ queryKey: TENANTS_KEY });
            void qc.invalidateQueries({ queryKey: tenantKey(id) });
        },
    });
}

/**
 * Endgültiges Purge eines bereits soft-gelöschten Tenants (irreversibel) — gibt
 * Owner-E-Mail/Username, Firma und Meta-Nummer fürs Re-Onboarding frei.
 */
export function usePurgeTenant(): UseMutationResult<
    { success: boolean; tenantId: string; purged: boolean },
    Error,
    number | string
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => purgeTenant(id),
        onSuccess: (_data, id) => {
            void qc.invalidateQueries({ queryKey: TENANTS_KEY });
            void qc.invalidateQueries({ queryKey: tenantKey(id) });
        },
    });
}

/**
 * Sperrt einen Mandanten wegen offener Zahlung. Nach Erfolg wird die
 * Tenant-Liste invalidiert, damit der payment_status='suspended' im UI
 * erscheint.
 */
export function useSuspendTenant(): UseMutationResult<
    { success: boolean; id: number | string; payment_status: string },
    Error,
    number | string
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => suspendTenant(id),
        onSuccess: (_data, id) => {
            void qc.invalidateQueries({ queryKey: TENANTS_KEY });
            void qc.invalidateQueries({ queryKey: tenantKey(id) });
        },
    });
}

/** Hebt eine Zahlungs-Sperre wieder auf (payment_status='active'). */
export function useUnsuspendTenant(): UseMutationResult<
    { success: boolean; id: number | string; payment_status: string },
    Error,
    number | string
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => unsuspendTenant(id),
        onSuccess: (_data, id) => {
            void qc.invalidateQueries({ queryKey: TENANTS_KEY });
            void qc.invalidateQueries({ queryKey: tenantKey(id) });
        },
    });
}

// useDeleteTenant wurde entfernt: das Backend hat keinen Tenant-DELETE-
// Endpoint — Deaktivieren/Suspend sind die realen Lifecycle-Operationen.

export type TenantDeviceRow = ActiveTenantDevice;

export function useTenantDevices(tenantId: number | string | null | undefined): {
    devices: TenantDeviceRow[];
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey:
            tenantId != null ? tenantDevicesKey(tenantId) : ['admin', 'tenants', '__none__', 'devices'],
        queryFn: () => listActiveDevices(tenantId as number | string),
        enabled: tenantId != null,
        ...READ_OPTIONS,
    });
    return {
        devices: q.data ?? [],
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}

export interface RemoveDeviceInput {
    tenantId: number | string;
    deviceId: string;
    sessionId: string;
    userId: string;
}

export function useRemoveDevice(): UseMutationResult<void, Error, RemoveDeviceInput> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ tenantId, deviceId, sessionId, userId }) =>
            removeActiveDevice(tenantId, deviceId, sessionId, userId),
        onSuccess: async (_data, vars) => {
            // Keep the mutation pending until every visible device count/list
            // has been refreshed. Otherwise the drawer and tenant table can
            // contradict each other immediately after a successful revoke.
            await Promise.all([
                qc.invalidateQueries({ queryKey: tenantDevicesKey(vars.tenantId) }),
                qc.invalidateQueries({ queryKey: tenantKey(vars.tenantId) }),
                qc.invalidateQueries({ queryKey: TENANTS_KEY }),
            ]);
        },
    });
}
