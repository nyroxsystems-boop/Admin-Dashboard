import { useState, useEffect } from 'react';

/**
 * useDebounce — Returns a debounced version of the input value.
 *
 * Usage:
 *   const [query, setQuery] = useState('');
 *   const debouncedQuery = useDebounce(query, 300);
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);

    return debounced;
}
