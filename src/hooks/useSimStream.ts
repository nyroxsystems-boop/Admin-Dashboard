/**
 * useSimStream (P4) — Live-Verlauf einer Simulation über die BESTEHENDE SSE-Infra.
 *
 * Nutzt den Ticket-Flow wie useNotifications, öffnet den Stream aber mit
 * ?scope=global (nur für Admins serverseitig erlaubt), weil sim.*-Events an den
 * SIMULIERTEN Tenant emittiert werden, nicht an den Admin-Tenant. Gefiltert wird
 * FE-seitig strikt auf die runId. KEIN neuer Stream-Endpoint.
 */
import { useEffect, useRef, useState } from 'react';
import { apiFetch, API_BASE_URL } from '@/api/client';

export interface SimTurnEvent {
    personaId: string;
    turnIndex: number;
    request?: string;
    reply?: string;
    orderId?: string | null;
    durationMs?: number;
    error?: string;
}

export interface SimMetrics {
    messages: number;
    orders: number;
    personasDone: number;
    personasTotal: number;
    errors: number;
    avgResponseMs: number;
    successRate: number;
    // ── Lasttest-Kennzahlen (optional; nur bei den neuen Läufen befüllt) ──
    p50ResponseMs?: number;
    p95ResponseMs?: number;
    p99ResponseMs?: number;
    throughputMsgPerSec?: number;
    wallclockMs?: number;
    aiCalls?: number;
    aiErrors?: number;
    aiErrorRate?: number;
    aiAvgMs?: number;
    aiP95Ms?: number;
    aiMaxConcurrent?: number;
    useLocalAi?: number;
    // ── Stresstest: Queue-Tiefe (nur im Queue-Modus befüllt) ──
    queueWaiting?: number;
    queueActive?: number;
    queueDelayed?: number;
    queueFailed?: number;
    queueCompleted?: number;
}

interface RawSimEvent {
    type: string;
    payload?: Record<string, unknown>;
    timestamp?: string;
}

export function useSimStream(runId: string | null): {
    turns: SimTurnEvent[];
    metrics: SimMetrics | null;
    done: { status: string } | null;
    connected: boolean;
} {
    const [turns, setTurns] = useState<SimTurnEvent[]>([]);
    const [metrics, setMetrics] = useState<SimMetrics | null>(null);
    const [done, setDone] = useState<{ status: string } | null>(null);
    const [connected, setConnected] = useState(false);
    const esRef = useRef<EventSource | null>(null);

    useEffect(() => {
        if (!runId) return;
        // Reset bei runId-Wechsel.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTurns([]);
        setMetrics(null);
        setDone(null);

        let cancelled = false;
        let es: EventSource | null = null;

        void (async () => {
            try {
                const { ticket } = await apiFetch<{ ticket: string }>('/api/events/ticket', {
                    method: 'POST',
                    silentAuth: true,
                });
                if (!ticket || cancelled) return;
                es = new EventSource(
                    `${API_BASE_URL}/api/events/stream?ticket=${encodeURIComponent(ticket)}&scope=global`,
                );
                esRef.current = es;
                es.onopen = () => setConnected(true);
                es.onerror = () => setConnected(false);
                es.onmessage = (e) => {
                    let ev: RawSimEvent;
                    try {
                        ev = JSON.parse(e.data) as RawSimEvent;
                    } catch {
                        return;
                    }
                    const p = ev.payload ?? {};
                    if (p.runId !== runId) return; // strikt auf diesen Lauf filtern
                    if (ev.type === 'sim.turn') {
                        setTurns((prev) => [
                            ...prev,
                            {
                                personaId: String(p.personaId ?? ''),
                                turnIndex: Number(p.turnIndex ?? 0),
                                request: p.request as string | undefined,
                                reply: p.reply as string | undefined,
                                orderId: (p.orderId as string) ?? null,
                                durationMs: p.durationMs as number | undefined,
                                error: p.error as string | undefined,
                            },
                        ]);
                    } else if (ev.type === 'sim.metric') {
                        setMetrics(p as unknown as SimMetrics);
                    } else if (ev.type === 'sim.done') {
                        setDone({ status: String(p.status ?? 'done') });
                        setMetrics(p as unknown as SimMetrics);
                    }
                };
            } catch {
                /* ignore — die View kann per GET /simulate-day/:runId nachladen */
            }
        })();

        return () => {
            cancelled = true;
            if (es) es.close();
            esRef.current = null;
            setConnected(false);
        };
    }, [runId]);

    return { turns, metrics, done, connected };
}
