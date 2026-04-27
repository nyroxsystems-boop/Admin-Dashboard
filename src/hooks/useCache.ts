/**
 * Generic SWR-style Cache (Stale-While-Revalidate).
 *
 * Module-level Map keeps data alive across mounts so navigation feels instant.
 * Returns cached data immediately and refreshes in the background.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

type CacheEntry<T> = {
    data: T;
    timestamp: number;
    error: string | null;
};

type Subscriber = () => void;

const cache = new Map<string, CacheEntry<unknown>>();
const subscribers = new Map<string, Set<Subscriber>>();
const inflight = new Map<string, Promise<unknown>>();

function subscribe(key: string, fn: Subscriber): () => void {
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    subscribers.get(key)!.add(fn);
    return () => {
        subscribers.get(key)?.delete(fn);
    };
}

function notify(key: string): void {
    subscribers.get(key)?.forEach((fn) => fn());
}

const DEFAULT_MAX_AGE = 2 * 60 * 1000;

export function clearCache(key?: string): void {
    if (key) {
        cache.delete(key);
    } else {
        cache.clear();
    }
}

export function invalidateCache(key?: string): void {
    if (key) {
        cache.delete(key);
        notify(key);
    } else {
        const keys = Array.from(cache.keys());
        cache.clear();
        keys.forEach((k) => notify(k));
    }
}

export function invalidateCacheByPrefix(prefix: string): void {
    const keys = Array.from(cache.keys()).filter((k) => k.startsWith(prefix));
    keys.forEach((k) => {
        cache.delete(k);
        notify(k);
    });
}

export function useSWR<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { maxAge?: number; autoRefreshInterval?: number },
): {
    data: T | null;
    loading: boolean;
    error: string | null;
    refresh: (silent?: boolean) => Promise<void>;
    lastUpdated: Date | null;
} {
    const maxAge = options?.maxAge ?? DEFAULT_MAX_AGE;
    const autoRefreshInterval = options?.autoRefreshInterval ?? 0;

    const cached = cache.get(key) as CacheEntry<T> | undefined;
    const [data, setData] = useState<T | null>(cached?.data ?? null);
    const [loading, setLoading] = useState(!cached);
    const [error, setError] = useState<string | null>(cached?.error ?? null);
    const mountedRef = useRef(true);

    const revalidate = useCallback(
        async (silent = false): Promise<void> => {
            if (inflight.has(key)) {
                try {
                    const result = (await inflight.get(key)) as T;
                    if (mountedRef.current) {
                        setData(result);
                        setError(null);
                        setLoading(false);
                    }
                    return;
                } catch {
                    // fall through
                }
            }

            if (!silent) setLoading((prev) => (!cache.has(key) ? true : prev));

            const promise = fetcher();
            inflight.set(key, promise);

            try {
                const result = await promise;
                cache.set(key, { data: result, timestamp: Date.now(), error: null });
                if (mountedRef.current) {
                    setData(result);
                    setError(null);
                }
                notify(key);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Fetch failed';
                if (cache.has(key)) {
                    cache.set(key, { ...cache.get(key)!, error: msg });
                } else {
                    cache.set(key, { data: null as T, timestamp: 0, error: msg });
                }
                if (mountedRef.current) setError(msg);
                notify(key);
            } finally {
                inflight.delete(key);
                if (mountedRef.current) setLoading(false);
            }
        },
        [key, fetcher],
    );

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        mountedRef.current = true;
        const unsub = subscribe(key, () => {
            const entry = cache.get(key) as CacheEntry<T> | undefined;
            if (entry) {
                setData(entry.data);
                setError(entry.error);
            }
        });

        const entry = cache.get(key) as CacheEntry<T> | undefined;
        if (!entry) {
            void revalidate();
        } else if (Date.now() - entry.timestamp > maxAge) {
            void revalidate(true);
        }

        return () => {
            mountedRef.current = false;
            unsub();
        };
    }, [key, maxAge, revalidate]);
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        if (!autoRefreshInterval) return;
        const interval = setInterval(() => void revalidate(true), autoRefreshInterval);
        return () => clearInterval(interval);
    }, [autoRefreshInterval, revalidate]);

    return {
        data,
        loading,
        error,
        refresh: revalidate,
        lastUpdated: cached?.timestamp ? new Date(cached.timestamp) : null,
    };
}
