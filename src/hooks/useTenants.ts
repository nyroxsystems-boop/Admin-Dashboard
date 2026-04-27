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
    deleteTenant,
    listActiveDevices,
    removeActiveDevice,
} from '@/api/tenants';
import type { Tenant, TenantDetail } from '@/api/types';

const TENANTS_KEY = ['admin', 'tenants'] as const;
const tenantKey = (id: number | string): readonly unknown[] =>
    ['admin', 'tenants', String(id)] as const;
const tenantDevicesKey = (id: number | string): readonly unknown[] =>
    ['admin', 'tenants', String(id), 'devices'] as const;

const READ_OPTIONS = { staleTime: 30_000, gcTime: 5 * 60_000 } as const;

export function useTenants(): {
    tenants: Tenant[];
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey: TENANTS_KEY,
        queryFn: () => listTenants(),
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

export interface CreateTenantInput {
    name: string;
    email: string;
    website?: string;
    phone?: string;
    password?: string;
    whatsapp_number?: string;
    logo_url?: string;
}

export function useCreateTenant(): UseMutationResult<
    { success: boolean; tenant?: Tenant },
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
    patch: Partial<{ name: string; whatsapp_number: string; logo_url: string }>;
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

export function useDeleteTenant(): UseMutationResult<
    { success: boolean },
    Error,
    number | string
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => deleteTenant(id),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: TENANTS_KEY });
        },
    });
}

export interface TenantDeviceRow {
    id: string;
    device_id: string;
    user: string;
    last_seen: string;
    ip: string;
}

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
}

export function useRemoveDevice(): UseMutationResult<void, Error, RemoveDeviceInput> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ tenantId, deviceId }) => removeActiveDevice(tenantId, deviceId),
        onSuccess: (_data, vars) => {
            void qc.invalidateQueries({ queryKey: tenantDevicesKey(vars.tenantId) });
            void qc.invalidateQueries({ queryKey: tenantKey(vars.tenantId) });
        },
    });
}
