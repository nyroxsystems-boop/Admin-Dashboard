import type { OnboardingHealthRow } from '@/api/onboarding';
import type { Appointment } from '@/api/appointments';

/** Deterministic priorities from explicit operating facts, never an invented score. */
export function merchantQueue(rows: OnboardingHealthRow[]): OnboardingHealthRow[] {
    return rows.filter(row => row.risk !== 'live').sort((a, b) =>
        Number(b.risk === 'at-risk') - Number(a.risk === 'at-risk')
        || (b.ageDays ?? -1) - (a.ageDays ?? -1)
        || a.name.localeCompare(b.name, 'de'));
}

export function merchantNextStep(row: OnboardingHealthRow): string {
    if (!row.dpaAcceptedAt) return 'AVV-Nachweis ergänzen';
    if (!row.planId) return 'Tarif zuordnen';
    if (!row.whatsappConfigured) return 'WhatsApp verbinden';
    return 'Übergabe und Freigabe prüfen';
}

export function nextAppointments(rows: Appointment[], now: number): Appointment[] {
    return rows.filter(row => ['confirmed', 'proposed'].includes(row.status)
        && Number.isFinite(Date.parse(row.start_at))
        && Date.parse(row.end_at || row.start_at) >= now)
        .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
}
