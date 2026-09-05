import type { Appointment } from '@/api/appointments';

export interface CalendarDraftFields {
    date?: string;
    time?: string;
    customerEmail?: string;
    meetingLink?: string;
    sendInvite?: boolean;
}
export function safeMeetingUrl(value?: string): string | undefined {
    const raw = value?.trim();
    if (!raw || [...raw].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return undefined;
    try {
        const parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return undefined;
        return parsed.href;
    } catch { return undefined; }
}

export function validateCalendarDraft(draft: CalendarDraftFields): Record<string, string> {
    const errors: Record<string, string> = {};
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(draft.date || '');
    const day = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
    if (!match || !day || day.getUTCFullYear() !== Number(match[1]) || day.getUTCMonth() !== Number(match[2]) - 1 || day.getUTCDate() !== Number(match[3])) errors.date = 'Bitte ein gültiges Datum wählen.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time || '')) errors.time = 'Bitte eine gültige Uhrzeit wählen.';
    const email = draft.customerEmail?.trim() || '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.customerEmail = 'Bitte eine gültige E-Mail-Adresse eintragen.';
    if (draft.sendInvite && !email) errors.customerEmail = 'Für eine Einladung wird eine Kunden-E-Mail benötigt.';
    if (draft.meetingLink?.trim() && !safeMeetingUrl(draft.meetingLink)) errors.meetingLink = 'Nur ein gültiger HTTP- oder HTTPS-Link ist erlaubt.';
    return errors;
}

export function appointmentConflicts(rows: Appointment[], start: string, durationMinutes: number, assigneeId?: string, excludeId?: string): Appointment[] {
    if (!assigneeId) return [];
    const from = Date.parse(start);
    const to = from + durationMinutes * 60_000;
    if (!Number.isFinite(from) || !Number.isFinite(to) || durationMinutes <= 0) return [];
    return rows.filter(item => item.id !== excludeId && item.assignee_id === assigneeId && !['cancelled', 'declined', 'completed', 'no_show'].includes(item.status) && Date.parse(item.start_at) < to && Date.parse(item.end_at) > from);
}
