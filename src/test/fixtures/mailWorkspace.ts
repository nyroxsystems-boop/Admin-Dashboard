import { InboxMessageSchema } from '@/api/types';

/** Fictional messages for visual and interaction checks; never sent. */
export const mailWorkspaceMessages = [
    { id: 'preview-1', from: 'einkauf@beispiel.invalid', from_name: 'Autoteile Nord', subject: 'Einrichtung unseres Händlerkontos', body: 'Guten Morgen, wir haben die Stammdaten ergänzt. Können wir die Anbindung am Dienstag gemeinsam abschließen?', assignment_status: 'open', is_read: false },
    { id: 'preview-2', from: 'werkstatt@beispiel.invalid', from_name: 'Werkstatt Süd', subject: 'Rückfrage zum aktuellen Angebot', body: 'Vielen Dank für das Gespräch. Anbei die besprochene Teileliste für unsere nächste Bestellung.', assignment_status: 'in_progress', assigned_to: 'Elias', is_read: true, attachments: [{ id: 'attachment-1', filename: 'Teileliste.pdf', content_type: 'application/pdf' }] },
    { id: 'preview-3', from: 'service@beispiel.invalid', from_name: 'Müller Fahrzeugteile', subject: 'Anbindung erfolgreich abgeschlossen', body: 'Die erste Bestellung ist angekommen. Vielen Dank für die Unterstützung bei der Einrichtung!', assignment_status: 'done', assigned_to: 'Fecat', is_read: true },
].map((item, index) => InboxMessageSchema.parse({ ...item, to: ['team@partsunion.de'], received_at: new Date(Date.now() - [0, 4 * 864e5, 2 * 36e5][index]).toISOString() }));
