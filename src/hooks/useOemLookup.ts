/**
 * useOemLookup — interactive single-OEM / VIN lookups.
 *
 * Differences from previous stub shape:
 *   - Returns one OemLookupResult (registry record + AI suggestion), NOT
 *     a list of OemEntry. The shape is { oem, existsInRegistry,
 *     registryRecord | null, aiResult }.
 *   - useReverseLookup → name lookup by OEM number (ai)
 *   - useSearchByVin → returns { vin, decoded, total, records }
 *   - useApproveOemResult → persist an AI suggestion to the registry
 *
 * The previous (stub) `lookup(vin)` setState API is preserved as a
 * thin wrapper for view back-compat.
 */

import { useCallback, useState } from 'react';
import {
    useMutation,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query';
import {
    lookupOem,
    reverseOemLookup,
    searchOemByVin,
    approveOemResult,
    type VinSearchResponse,
} from '@/api/oem';
import type { OemLookupResult } from '@/api/types';

export function useOemLookup(): {
    result: OemLookupResult | null;
    isLoading: boolean;
    error: string | null;
    lookup: (oem: string) => Promise<void>;
    lookupAsync: (oem: string) => Promise<OemLookupResult>;
    clear: () => void;
} {
    const [result, setResult] = useState<OemLookupResult | null>(null);
    const [isLoading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const lookup = useCallback(async (oem: string): Promise<void> => {
        if (!oem.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const res = await lookupOem(oem.trim());
            setResult(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lookup failed');
            setResult(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const lookupAsync = useCallback(async (oem: string): Promise<OemLookupResult> => {
        return lookupOem(oem.trim());
    }, []);

    const clear = useCallback(() => {
        setResult(null);
        setError(null);
    }, []);

    return { result, isLoading, error, lookup, lookupAsync, clear };
}

export function useReverseLookup(): UseMutationResult<
    Awaited<ReturnType<typeof reverseOemLookup>>,
    Error,
    string
> {
    return useMutation({
        mutationFn: (oem) => reverseOemLookup(oem),
    });
}

export interface SearchByVinInput {
    vin: string;
    limit?: number;
    category?: string;
}

export function useSearchByVin(): UseMutationResult<VinSearchResponse, Error, SearchByVinInput> {
    return useMutation({
        mutationFn: ({ vin, ...opts }) => searchOemByVin(vin, opts),
    });
}

export interface ApproveOemInput {
    oem: string;
    brand: string;
    part_category: string;
    part_description: string;
    model: string;
    confidence: number;
}

export function useApproveOemResult(): UseMutationResult<
    { success: boolean; action: string; id: number },
    Error,
    ApproveOemInput
> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => approveOemResult(input),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['admin', 'oem', 'registry'] });
        },
    });
}
