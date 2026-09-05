import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { WebsiteBookingStatus } from './WebsiteBookingStatus';
import type { Appointment } from '@/api/appointments';
vi.mock('@/api/appointments',()=>({getAppointmentById:vi.fn(()=>new Promise(()=>{})),retryWebsiteConfirmation:vi.fn()}));
function show(status: 'sent'|'failed'|'uncertain') {
    const appointment={id:'test',status:'confirmed',website_booking:{confirmationStatus:status,teamStatus:'sent',consentGivenAt:'2026-09-04'}} as Appointment;
    return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><WebsiteBookingStatus appointment={appointment} /></QueryClientProvider>);
}
describe('Website booking delivery state',()=>{
    it('shows customer confirmation and internal notification independently',()=>{show('failed');expect(screen.getByText('Versand fehlgeschlagen')).toBeInTheDocument();expect(screen.getByText('Versendet')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Ausstehende E-Mails senden'})).toBeEnabled();});
    it('does not offer automatic resend after an uncertain provider response',()=>{show('uncertain');expect(screen.getByText('Versandstatus unklar')).toBeInTheDocument();expect(screen.queryByRole('button')).not.toBeInTheDocument();});
    it('does not offer another initial confirmation after successful delivery',()=>{show('sent');expect(screen.getAllByText('Versendet')).toHaveLength(2);expect(screen.queryByRole('button')).not.toBeInTheDocument();});
});
