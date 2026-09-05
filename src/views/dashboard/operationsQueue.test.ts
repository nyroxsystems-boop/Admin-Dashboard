import { describe, expect, it } from 'vitest';
import { merchantQueue, merchantNextStep, nextAppointments } from './operationsQueue';
import type { OnboardingHealthRow } from '@/api/onboarding';
import type { Appointment } from '@/api/appointments';

describe('operating facts, not scores', () => {
    it('keeps unknown age behind known age without treating it as an overdue fact', () => {
        const rows = [{ tenantId: 'unknown', risk: 'setup', name: 'Unknown', ageDays: null }, { tenantId: 'known', risk: 'setup', name: 'Known', ageDays: 0 }] as OnboardingHealthRow[];
        expect(merchantQueue(rows).map(row => row.tenantId)).toEqual(['known', 'unknown']);
        expect(rows[0].tenantId).toBe('unknown');
    });
    it('derives the next missing prerequisite explicitly', () => {
        const row = { dpaAcceptedAt: '2026-09-04', planId: 'pro', whatsappConfigured: false } as OnboardingHealthRow;
        expect(merchantNextStep(row)).toBe('WhatsApp verbinden');
        expect(merchantNextStep({ ...row, whatsappConfigured: true })).toBe('Übergabe und Freigabe prüfen');
    });
    it('shows only upcoming or ongoing proposed/confirmed appointments in chronological order', () => {
        const now = Date.parse('2026-09-04T12:00:00Z');
        const rows = [
            { id: 'cancelled', status: 'cancelled', start_at: '2026-09-04T13:00:00Z' },
            { id: 'future', status: 'proposed', start_at: '2026-09-04T14:00:00Z' },
            { id: 'ongoing', status: 'confirmed', start_at: '2026-09-04T11:30:00Z', end_at: '2026-09-04T12:30:00Z' },
            { id: 'past', status: 'confirmed', start_at: '2026-09-04T10:00:00Z' },
        ] as Appointment[];
        expect(nextAppointments(rows, now).map(row => row.id)).toEqual(['ongoing', 'future']);
    });
});
