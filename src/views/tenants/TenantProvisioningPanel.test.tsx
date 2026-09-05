import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantProvisioning } from './TenantProvisioningPanel';
import { getProvisioningCase, saveProvisioningCase, type ProvisioningCase } from '@/api/onboarding';

vi.mock('@/api/onboarding', () => ({ getProvisioningCase: vi.fn(), saveProvisioningCase: vi.fn() }));
vi.mock('./TenantReadinessProfile', () => ({ TenantReadinessProfile: () => <div>Bestätigte Händlerangaben</div> }));

const initial: ProvisioningCase = {
    ownerName: null, dueAt: null, stage: 'draft', checks: {}, notes: '',
    updatedAt: null, version: 0, readiness: { ready: false, blockers: ['WhatsApp-Verbindung fehlt.'] },
};
function mount(): QueryClient {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><TenantProvisioning tenantId="dealer-1" /></QueryClientProvider>);
    return client;
}

describe('Merchant provisioning workflow', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getProvisioningCase).mockResolvedValue(initial);
    });

    it('saves operator ownership, phase and evidence with the loaded concurrency version', async () => {
        vi.mocked(saveProvisioningCase).mockImplementation(async (_id, draft) => ({ ...draft, version: 1, updatedAt: '2026-09-04T12:00:00.000Z', readiness: initial.readiness }));
        mount();
        fireEvent.change(await screen.findByLabelText('Verantwortlich'), { target: { value: 'Fecat Vogt' } });
        fireEvent.change(screen.getByLabelText('Geplante Übergabe'), { target: { value: '2026-09-10' } });
        fireEvent.change(screen.getByLabelText('Bearbeitungsphase'), { target: { value: 'provisioning' } });
        fireEvent.click(screen.getByLabelText(/Vertrag und Tarif geprüft/));
        fireEvent.click(screen.getByRole('button', { name: 'Stand speichern' }));
        await waitFor(() => expect(saveProvisioningCase).toHaveBeenCalledWith('dealer-1', expect.objectContaining({ ownerName: 'Fecat Vogt', stage: 'provisioning', dueAt: '2026-09-10T12:00:00.000Z', version: 0, checks: { contract: true } })));
        expect(await screen.findByText('Bearbeitungsstand gespeichert.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Stand speichern' })).toBeDisabled();
        expect(screen.getByText('WhatsApp-Verbindung fehlt.')).toBeInTheDocument();
    });

    it('keeps unsaved inputs when a background fetch receives a newer server version', async () => {
        const client = mount();
        fireEvent.change(await screen.findByLabelText('Verantwortlich'), { target: { value: 'Unsaved operator' } });
        await act(async () => { client.setQueryData(['admin', 'provisioning', 'dealer-1'], { ...initial, ownerName: 'Other operator', version: 1 }); });
        expect(await screen.findByText(/Ein neuerer Serverstand ist verfügbar/)).toBeInTheDocument();
        expect(screen.getByLabelText('Verantwortlich')).toHaveValue('Unsaved operator');
    });

    it('preserves the draft on conflict until an explicit reload discards it', async () => {
        vi.mocked(saveProvisioningCase).mockRejectedValue(Object.assign(new Error('Ein anderer Operator hat den Vorgang geändert.'), { status: 409 }));
        mount();
        fireEvent.change(await screen.findByLabelText('Verantwortlich'), { target: { value: 'Local draft' } });
        fireEvent.click(screen.getByRole('button', { name: 'Stand speichern' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Ein anderer Operator');
        expect(screen.getByLabelText('Verantwortlich')).toHaveValue('Local draft');
        vi.mocked(getProvisioningCase).mockResolvedValue({ ...initial, ownerName: 'Current operator', version: 2 });
        fireEvent.click(screen.getByRole('button', { name: 'Eingaben verwerfen und aktuellen Stand laden' }));
        await waitFor(() => expect(screen.getByLabelText('Verantwortlich')).toHaveValue('Current operator'));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
