import { useState, useEffect, useCallback } from 'react';

/**
 * useLocalStorage — typed localStorage hook with cross-tab sync.
 *
 * Usage:
 *   const [value, setValue, remove] = useLocalStorage('my-key', { foo: 'bar' });
 */
export function useLocalStorage<T>(
    key: string,
    initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
    const readValue = useCallback((): T => {
        if (typeof window === 'undefined') return initialValue;
        try {
            const raw = window.localStorage.getItem(key);
            return raw ? (JSON.parse(raw) as T) : initialValue;
        } catch {
            return initialValue;
        }
    }, [key, initialValue]);

    const [stored, setStored] = useState<T>(readValue);

    const setValue = useCallback(
        (value: T | ((prev: T) => T)) => {
            setStored((prev) => {
                const next = value instanceof Function ? value(prev) : value;
                try {
                    window.localStorage.setItem(key, JSON.stringify(next));
                    window.dispatchEvent(new StorageEvent('storage', { key }));
                } catch {
                    // ignore quota / serialization errors
                }
                return next;
            });
        },
        [key],
    );

    const remove = useCallback(() => {
        try {
            window.localStorage.removeItem(key);
            setStored(initialValue);
        } catch {
            // ignore
        }
    }, [key, initialValue]);

    // Cross-tab sync
    useEffect(() => {
        const handler = (e: StorageEvent) => {
            if (e.key === key) setStored(readValue());
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, [key, readValue]);

    return [stored, setValue, remove];
}
