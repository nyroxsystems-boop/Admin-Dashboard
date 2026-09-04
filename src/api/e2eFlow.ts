/**
 * E2E-Flow-Runner API (P3) — scriptbarer Bot-Durchlauf über die ECHTE Pipeline
 * (POST /api/bot-testing/run-flow). Liefert die Stufen ocr→oem→price→quote→order
 * →invoice mit ehrlichem Status + Artefakten.
 */
import { apiFetch } from './client';

export type FlowStepKey = 'ocr' | 'oem' | 'price' | 'quote' | 'order' | 'invoice';
export type FlowStepStatus = 'ok' | 'fail' | 'skipped';

export interface FlowStep {
    key: FlowStepKey | string;
    status: FlowStepStatus;
    durationMs: number;
    artifact?: Record<string, unknown>;
    reason?: string;
    error?: string;
}

export interface E2EFlowResult {
    runId: string;
    merchantId: string;
    steps: FlowStep[];
    orderId?: string | null;
    transcript?: Array<{ reply: string; status: string | null; error: string | null }>;
}

export interface RunnerScenarioInfo {
    id: string;
    name: string;
    turns: number;
}

export async function getRunnerScenarios(): Promise<RunnerScenarioInfo[]> {
    const raw = await apiFetch<{ scenarios?: RunnerScenarioInfo[] }>('/api/bot-testing/scenarios');
    return raw?.scenarios ?? [];
}

export interface RunE2EFlowInput {
    merchantId?: string;
    scenarioId?: string;
    text?: string;
    imageBase64?: string;
}

export async function runE2EFlow(input: RunE2EFlowInput): Promise<E2EFlowResult> {
    return apiFetch<E2EFlowResult>('/api/bot-testing/run-flow', {
        method: 'POST',
        body: JSON.stringify(input),
    });
}
