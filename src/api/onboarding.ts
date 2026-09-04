/**
 * Onboarding pipeline / health API.
 *
 * Backs the operator console: which tenant is stuck, configured-but-not-live,
 * or at risk. Data comes from the bot's GET /api/admin/onboarding-pipeline
 * (activation + license + WhatsApp-wiring signals with a derived risk lamp).
 */
import { apiFetch } from './client';

export type OnboardingRisk = 'live' | 'configured' | 'at-risk' | 'setup';

export interface OnboardingHealthRow {
    tenantId: string;
    name: string;
    createdAt: string | null;
    planId: string | null;
    planExpiresAt: string | null;
    paymentStatus: string | null;
    onboardingStatus: string | null;
    activatedAt: string | null;
    timeToActivationHours: number | null;
    whatsappConfigured: boolean;
    lastOrderAt: string | null;
    ageDays: number | null;
    dpaAcceptedAt: string | null;
    dpaVersion: string | null;
    risk: OnboardingRisk;
}

export interface OnboardingPipeline {
    summary: { total: number; live: number; configured: number; setup: number; atRisk: number };
    tenants: OnboardingHealthRow[];
}

export async function getOnboardingPipeline(): Promise<OnboardingPipeline> {
    return apiFetch<OnboardingPipeline>('/api/admin/onboarding-pipeline');
}

/** Onboarding health for a single tenant — for the per-tenant cockpit. */
export async function getTenantOnboardingHealth(tenantId: number | string): Promise<OnboardingHealthRow | null> {
    const raw = await apiFetch<{ health: OnboardingHealthRow | null }>(
        `/api/admin/tenants/${encodeURIComponent(String(tenantId))}/onboarding-health`,
    );
    return raw?.health ?? null;
}
