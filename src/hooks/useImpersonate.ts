/**
 * useImpersonate — placeholder for tenant-impersonation flow.
 *
 * The backend does not yet expose an impersonation endpoint. This hook
 * returns a no-op mutation that throws so views can wire the UI without
 * compilation errors. Once the API is available, replace the
 * `mutationFn` with a real call.
 */

// TODO: Wire to real impersonation API when available.

import { useMutation, type UseMutationResult } from '@tanstack/react-query';

export interface ImpersonateInput {
    tenantId: number | string;
    userId?: number | string;
    reason?: string;
}

export interface ImpersonateResult {
    success: boolean;
    token?: string;
    expiresAt?: string;
}

export function useImpersonate(): UseMutationResult<
    ImpersonateResult,
    Error,
    ImpersonateInput
> {
    return useMutation({
        mutationFn: async (_input: ImpersonateInput): Promise<ImpersonateResult> => {
            throw new Error('Impersonation API is not yet implemented.');
        },
    });
}
