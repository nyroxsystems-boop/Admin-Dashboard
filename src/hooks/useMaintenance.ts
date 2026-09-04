/**
 * useMaintenance — read/write the global maintenance flag.
 *
 * The bot-service backend persists a single global boolean
 * (merchant_settings 'admin' → maintenanceMode). There is NO free-text
 * message and NO scheduled end time, so the only writable field is
 * `enabled`. When on, tenant users see a banner in the User-Dashboard.
 */

import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query';
import { getMaintenanceState, setMaintenanceState } from '@/api/maintenance';
import type { MaintenanceState } from '@/api/types';

const MAINTENANCE_KEY = ['admin', 'maintenance'] as const;

export function useMaintenance(): {
    state: MaintenanceState | null;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey: MAINTENANCE_KEY,
        queryFn: () => getMaintenanceState(),
        staleTime: 30_000,
        gcTime: 5 * 60_000,
    });
    return {
        state: q.data ?? null,
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}

export interface SetMaintenanceInput {
    enabled: boolean;
}

export function useSetMaintenance(): UseMutationResult<
    MaintenanceState,
    Error,
    SetMaintenanceInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => setMaintenanceState(input),
        onSuccess: (data) => {
            qc.setQueryData(MAINTENANCE_KEY, data);
            void qc.invalidateQueries({ queryKey: MAINTENANCE_KEY });
        },
    });
}
