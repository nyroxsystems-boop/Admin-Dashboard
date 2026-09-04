/**
 * useGlobalSearch — reaktive globale Admin-Suche (P1.5). Feuert erst ab 2 Zeichen.
 * Debounce passiert beim Aufrufer (Command-Palette gibt einen entprellten Query).
 */
import { useQuery } from '@tanstack/react-query';
import { getGlobalSearch, type GlobalSearchResult } from '@/api/search';

export function useGlobalSearch(query: string): {
    results: GlobalSearchResult[];
    isFetching: boolean;
} {
    const q = query.trim();
    const enabled = q.length >= 2;
    const result = useQuery({
        queryKey: ['admin', 'search', q],
        queryFn: () => getGlobalSearch(q),
        enabled,
        staleTime: 10_000,
        gcTime: 60_000,
    });
    return {
        results: enabled ? result.data ?? [] : [],
        isFetching: result.isFetching,
    };
}
