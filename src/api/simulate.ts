/**
 * Live-Simulation API (P4) — Händler-Tag-Orchestrator über die echte Pipeline.
 * Der Live-Verlauf kommt über SSE (useSimStream); diese Calls steuern den Lauf.
 */
import { apiFetch } from './client';

export interface StartSimInput {
    merchantId?: string;
    personaIds?: string[];
    /** Lasttest: N synthetische Kunden generieren (überschreibt personaIds). */
    count?: number;
    /** Anteil englischsprachiger Personas (0..1). */
    englishRatio?: number;
    /** Anteil Personas mit Teilewechsel mitten im Flow (0..1). */
    partChangeRatio?: number;
    maxConcurrent?: number;
    demoStubMode?: boolean;
    speed?: number;
    /** KI-Calls an die eigene lokale Qwen-Instanz routen statt an Gemini. */
    useLocalAi?: boolean;
}

export interface StartSimResult {
    runId: string;
    personas: number;
    demoStub: boolean;
    maxConcurrent: number;
    useLocalAi?: boolean;
    aiHealth?: { ok: boolean; latencyMs: number; detail?: string } | null;
}

export interface SimRunInfo {
    id: string;
    merchantId: string;
    status: 'running' | 'stopped' | 'done' | 'error';
    personaIds: string[];
    demoStub: boolean;
    maxConcurrent: number;
    startedAt: string;
    stoppedAt: string | null;
    metrics: Record<string, number>;
}

export async function startSimulation(input: StartSimInput): Promise<StartSimResult> {
    return apiFetch<StartSimResult>('/api/bot-testing/simulate-day', {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

export interface StartStressInput {
    /** Mandanten-IDs; pro Mandant werden `perTenant` synthetische Kunden erzeugt. */
    merchantIds: string[];
    perTenant: number;
    /** Gleichzeitig aktive Gespräche (Lastniveau). */
    maxConcurrent?: number;
    /** Pause zwischen den Turns einer Persona (ms). */
    thinkTimeMs?: number;
    /** KI-Calls an die lokale Qwen-Instanz routen statt an Gemini. */
    useLocalAi?: boolean;
}

export interface StartStressResult {
    runId: string;
    tenants: number;
    perTenant: number;
    total: number;
    maxConcurrent: number;
    useLocalAi?: boolean;
    aiHealth?: { ok: boolean; latencyMs: number; detail?: string } | null;
}

/** Queue-getriebener, multi-tenant Stresstest über die ECHTE Pipeline (BullMQ-Worker). */
export async function startStressTest(input: StartStressInput): Promise<StartStressResult> {
    return apiFetch<StartStressResult>('/api/bot-testing/stress-test', {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

export async function getSimulationRun(
    runId: string,
): Promise<{ run: SimRunInfo; turnCount: number; live: boolean }> {
    return apiFetch(`/api/bot-testing/simulate-day/${runId}`);
}

export async function stopSimulation(runId: string): Promise<{ success: boolean; stopping: boolean }> {
    return apiFetch(`/api/bot-testing/simulate-day/${runId}/stop`, { method: 'POST' });
}
