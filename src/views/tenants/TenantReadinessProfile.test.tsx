import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantReadinessProfile } from './TenantReadinessProfile';
import { apiFetch } from '@/api/client';

vi.mock('@/api/client', () => ({ apiFetch: vi.fn() }));
const emptyProfile = { billing: null, tax: null, dpaAcceptedAt: null, dpaVersion: null };
const endpoint = '/api/admin/tenants/dealer-1/readiness-profile';
function mount(): QueryClient {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><TenantReadinessProfile tenantId="dealer-1" /></QueryClientProvider>);
    return client;
}

describe('Merchant readiness profile', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(apiFetch).mockResolvedValue(emptyProfile);
    });

    it('retains input when a save returns an unconfirmed or malformed response', async () => {
        mount();
        fireEvent.change(await screen.findByLabelText('Vollständiger Firmenname'), { target: { value: 'Geänderte Firma' } });
        vi.mocked(apiFetch).mockResolvedValue({ success: true });
        fireEvent.click(screen.getByRole('button', { name: 'Angaben speichern' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Serverantwort zu den Firmendaten ist unvollständig');
        expect(screen.getByLabelText('Vollständiger Firmenname')).toHaveValue('Geänderte Firma');
        expect(screen.getByRole('button', { name: 'Angaben speichern' })).not.toBeDisabled();
    });

    it('records existing AVV acceptance without creating empty billing or tax profiles', async () => {
        mount();
        fireEvent.click(await screen.findByLabelText(/Die Annahme der Auftragsverarbeitung/));
        vi.mocked(apiFetch).mockResolvedValue({ ...emptyProfile, dpaAcceptedAt: '2026-09-04T12:00:00.000Z', dpaVersion: 'avv-2026-06' });
        fireEvent.click(screen.getByRole('button', { name: 'Angaben speichern' }));
        await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(endpoint, { method: 'PATCH', body: JSON.stringify({ dpaAccepted: true }) }));
        expect(await screen.findByText(/AVV-Annahme dokumentiert am/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Angaben speichern' })).toBeDisabled();
    });

    it('sends only changed billing fields and preserves drafts during background refetches', async () => {
        const client = mount();
        fireEvent.change(await screen.findByLabelText('Vollständiger Firmenname'), { target: { value: 'New dealer GmbH' } });
        await act(async () => { client.setQueryData(['admin', 'readiness-profile', 'dealer-1'], { ...emptyProfile, billing: { company_name: 'Other operator edit' } }); });
        expect(screen.getByLabelText('Vollständiger Firmenname')).toHaveValue('New dealer GmbH');
        fireEvent.click(screen.getByRole('button', { name: 'Angaben speichern' }));
        await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(endpoint, { method: 'PATCH', body: JSON.stringify({ billing: { company_name: 'New dealer GmbH' } }) }));
    });
});
