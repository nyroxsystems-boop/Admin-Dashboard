/**
 * useOemBatch — sequential batch lookup with cancel + progress callbacks.
 *
 * Differences from previous stub shape:
 *   - Items are OemLookupResult[] (was OemEntry[])
 *   - runBatch now accepts { items, onProgress?, onItem? } so the caller
 *     can stream items into a virtualized list without re-rendering on
 *     every state push. The legacy positional `runBatch(oems)` form still
 *     works (defaulted to no callbacks).
 *   - Cancellation is via AbortController; the in-flight request is
 *     interrupted at the next iteration boundary.
 */

import { useCallback, useRef, useState } from 'react';
import { lookupOem } from '@/api/oem';
import type { OemLookupResult } from '@/api/types';

export interface BatchProgress {
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    isRunning: boolean;
}

export interface BatchItem {
    oem: string;
    status: 'ok' | 'error';
    result: OemLookupResult | null;
    error: string | null;
}

export interface RunBatchOptions {
    items: string[];
    onProgress?: (p: BatchProgress) => void;
    onItem?: (item: BatchItem) => void;
}

const EMPTY_PROGRESS: BatchProgress = {
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    isRunning: false,
};

export function useOemBatch(): {
    progress: BatchProgress;
    items: BatchItem[];
    runBatch: (input: RunBatchOptions | string[]) => Promise<void>;
    cancel: () => void;
    reset: () => void;
} {
    const [progress, setProgress] = useState<BatchProgress>(EMPTY_PROGRESS);
    const [items, setItems] = useState<BatchItem[]>([]);
    const cancelRef = useRef<AbortController | null>(null);

    const runBatch = useCallback(
        async (input: RunBatchOptions | string[]): Promise<void> => {
            const opts: RunBatchOptions = Array.isArray(input) ? { items: input } : input;
            const list = opts.items;

            cancelRef.current?.abort();
            const controller = new AbortController();
            cancelRef.current = controller;

            setItems([]);
            const initial: BatchProgress = {
                total: list.length,
                processed: 0,
                succeeded: 0,
                failed: 0,
                isRunning: true,
            };
            setProgress(initial);
            opts.onProgress?.(initial);

            let processed = 0;
            let succeeded = 0;
            let failed = 0;

            for (const oem of list) {
                if (controller.signal.aborted) break;
                let entry: BatchItem;
                try {
                    const result = await lookupOem(oem);
                    succeeded += 1;
                    entry = { oem, status: 'ok', result, error: null };
                } catch (err) {
                    failed += 1;
                    entry = {
                        oem,
                        status: 'error',
                        result: null,
                        error: err instanceof Error ? err.message : 'Lookup failed',
                    };
                }
                processed += 1;
                setItems((prev) => [...prev, entry]);
                opts.onItem?.(entry);

                const next: BatchProgress = {
                    total: list.length,
                    processed,
                    succeeded,
                    failed,
                    isRunning: !controller.signal.aborted && processed < list.length,
                };
                setProgress(next);
                opts.onProgress?.(next);
            }

            const final: BatchProgress = {
                total: list.length,
                processed,
                succeeded,
                failed,
                isRunning: false,
            };
            setProgress(final);
            opts.onProgress?.(final);
            cancelRef.current = null;
        },
        []
    );

    const cancel = useCallback(() => {
        cancelRef.current?.abort();
        setProgress((p) => ({ ...p, isRunning: false }));
    }, []);

    const reset = useCallback(() => {
        cancelRef.current?.abort();
        cancelRef.current = null;
        setItems([]);
        setProgress(EMPTY_PROGRESS);
    }, []);

    return { progress, items, runBatch, cancel, reset };
}
