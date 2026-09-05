import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAppointmentById, retryWebsiteConfirmation, type Appointment, type BookingEmailStatus } from '@/api/appointments';

function bookingEmailLabel(status: BookingEmailStatus): string {
    return {pending:'Versand ausstehend',sending:'Versand wird geprüft',sent:'Versendet',failed:'Versand fehlgeschlagen',uncertain:'Versandstatus unklar'}[status];
}

export function WebsiteBookingStatus({appointment}: {appointment: Appointment}) {
    const [busy,setBusy] = useState(false);
    const [error,setError] = useState('');
    const query = useQuery({queryKey:['website-booking',appointment.id],queryFn:()=>getAppointmentById(appointment.id),initialData:{appointment},refetchInterval:15_000});
    const current = query.data.appointment;
    const booking = current.website_booking;
    if (!booking) return null;
    const retryable = current.status === 'confirmed' && [booking.confirmationStatus,booking.teamStatus].some(s=>s==='failed'||s==='pending');
    const unclear = [booking.confirmationStatus,booking.teamStatus].some(s=>s==='uncertain'||s==='sending');
    async function retry() {
        setBusy(true);setError('');
        try {await retryWebsiteConfirmation(appointment.id);await query.refetch();}
        catch {setError('Der Versand konnte nicht abgeschlossen werden. Bitte erneut prüfen.');}
        finally {setBusy(false);}
    }
    return <section className="space-y-3 rounded-lg border bg-muted/20 p-3" aria-label="Website-Buchung">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Globe className="size-4 text-primary" aria-hidden="true" /> Direkt über die Website gebucht</h3>
        <dl className="space-y-2 text-xs"><div className="flex flex-wrap justify-between gap-2"><dt>Bestätigung an Kunden</dt><dd>{bookingEmailLabel(booking.confirmationStatus)}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt>Interne Benachrichtigung</dt><dd>{bookingEmailLabel(booking.teamStatus)}</dd></div></dl>
        {booking.confirmationError && <p className="text-xs text-amber-600 hell:text-amber-800">{booking.confirmationError}</p>}
        {booking.teamError && <p className="text-xs text-amber-600 hell:text-amber-800">{booking.teamError}</p>}
        {unclear && <p className="text-xs text-muted-foreground">Bei unklarem Versandstatus zuerst im Mailanbieter prüfen. Ein erneuter Versand wird nicht automatisch ausgelöst.</p>}
        {retryable && <Button variant="outline" size="sm" disabled={busy} onClick={()=>void retry()}><Mail className="size-4" />{busy?'Versand läuft …':'Ausstehende E-Mails senden'}</Button>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </section>;
}
