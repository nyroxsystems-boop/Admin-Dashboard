/**
 * useSystemHealth — antwortet die API? Alle 30 Sekunden.
 *
 * Frueher fragte dieser Haken alle 15 Sekunden eine Adresse ab, die es nicht
 * gab: jede Runde ein 404 in der Konsole, die Anzeige dauerhaft auf "Status
 * wird geprueft". Warum das passieren konnte, steht in api/health.ts.
 *
 * Jetzt laeuft er gegen `/health/live` — das einzige, was von aussen erreichbar
 * ist. Alle 30 statt 15 Sekunden: ein Lebenszeichen braucht keine hoehere
 * Taktung, und der Rueckweg aus dem Mailprogramm ist ohnehin knapp.
 */

import { useQuery } from '@tanstack/react-query';

import { getSystemHealth, type SystemZustand } from '@/api/health';

export function useSystemHealth(): {
    zustand: SystemZustand | null;
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey: ['admin', 'system', 'health'] as const,
        queryFn: () => getSystemHealth(),
        refetchInterval: 30_000,
        staleTime: 20_000,
        // Ein Lebenszeichen, das nicht ankommt, IST die Antwort — kein Grund,
        // dreimal nachzufassen und die Anzeige so lange leer zu lassen.
        retry: false,
    });
    return {
        zustand: q.data ?? null,
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}
