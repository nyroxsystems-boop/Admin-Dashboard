import { describe, expect, it } from 'vitest';
import type { Appointment } from '@/api/appointments';
import { appointmentConflicts, safeMeetingUrl, validateCalendarDraft } from './calendarForm';

const appointment = (id: string, start: string, end: string, status = 'confirmed'): Appointment => ({ id, type: 'sales', title: id, notes: null, assignee_id: 'admin-1', assignee_name: 'Anna', created_by_id: null, created_by_name: null, company_id: null, customer_name: null, customer_email: null, customer_phone: null, start_at: start, end_at: end, duration_minutes: 30, location: null, meeting_link: null, status, public_token: null, invite_sent_at: null, responded_at: null, created_at: start, updated_at: start });

describe('admin calendar safety', () => {
    it('validates invitations and blocks executable meeting links', () => {
        expect(validateCalendarDraft({ date: '2026-02-31', time: '25:00', sendInvite: true, meetingLink: 'javascript:alert(1)' })).toMatchObject({ date: expect.any(String), time: expect.any(String), customerEmail: expect.any(String), meetingLink: expect.any(String) });
        expect(validateCalendarDraft({ date: '2026-09-05', time: '10:00', customerEmail: 'kunde@example.de', sendInvite: true, meetingLink: 'teams.microsoft.com/example' })).toEqual({});
        expect(safeMeetingUrl('teams.microsoft.com/example')).toBe('https://teams.microsoft.com/example');
    });
    it('finds only overlapping active appointments for the same assignee', () => {
        const rows = [appointment('overlap', '2026-09-05T10:15', '2026-09-05T10:45'), appointment('other-user', '2026-09-05T10:15', '2026-09-05T10:45'), appointment('done', '2026-09-05T10:15', '2026-09-05T10:45', 'completed')];
        rows[1].assignee_id = 'admin-2';
        expect(appointmentConflicts(rows, '2026-09-05T10:00', 30, 'admin-1').map(item => item.id)).toEqual(['overlap']);
        expect(appointmentConflicts(rows, '2026-09-05T10:00', 30, 'admin-1', 'overlap')).toEqual([]);
    });
});
