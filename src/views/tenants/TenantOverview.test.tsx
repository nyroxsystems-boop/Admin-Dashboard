import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantSchema, TenantDetailSchema } from '@/api/types';
import { getReadinessProfile } from '@/api/tenantProfile';
import { getProvisioningCase } from '@/api/onboarding';
import { TenantOverview } from './TenantOverview';
vi.mock('@/api/tenantProfile', () => ({ getReadinessProfile: vi.fn() }));
vi.mock('@/api/onboarding', () => ({ getProvisioningCase: vi.fn() }));
const tenant = TenantSchema.parse({ id: 'dealer-a', name: 'Nord GmbH', slug: 'nord' });
const detail = TenantDetailSchema.parse({ id: 'dealer-a', users: [{ id: 'owner', role: 'merchant', name: 'Anna Nord', email: 'anna@example.test', created_at: '2026-09-01' }], devices: [], settings: {}, stats: {} });
function mount(overrides = {}) {
    const onSection = vi.fn();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TenantOverview tenant={tenant} detail={detail} detailLoading={false} detailError={false} retryDetail={vi.fn()} onSection={onSection} {...overrides} /></QueryClientProvider>);
    return onSection;
}
describe('Kundenakte', () => {
    beforeEach(() => {
        vi.mocked(getReadinessProfile).mockResolvedValue({ billing: { company_name: 'Nord Handel GmbH', company_address: 'Hafenweg 12', company_city: 'Hamburg' }, tax: null, dpaAcceptedAt: null, dpaVersion: null });
        vi.mocked(getProvisioningCase).mockResolvedValue({ ownerName: 'Betreuung Nord', dueAt: null, stage: 'draft', checks: {}, notes: '', updatedAt: null, version: 0, readiness: { ready: false, blockers: ['Einweisung offen'] } });
    });
    it('shows verified API fields, an explicitly identified account owner and actionable setup gaps', async () => {
        const onSection = mount();
        expect(await screen.findByText('Nord Handel GmbH')).toBeInTheDocument();
        expect(screen.getByText('Anna Nord')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'E-Mail-Adresse kopieren' })).toHaveTextContent('anna@example.test');
        expect(await screen.findByText('Betreuung Nord')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Einrichtung öffnen' }));
        expect(onSection).toHaveBeenCalledWith('onboarding');
    });
    it('never substitutes an arbitrary employee as account owner', async () => {
        mount({ detail: { ...detail, users: [{ ...detail.users[0], role: 'staff' }] } });
        expect(await screen.findByText('Kein Kontoinhaber zugeordnet')).toBeInTheDocument();
        expect(screen.queryByText('anna@example.test')).not.toBeInTheDocument();
    });
    it('shows independent source errors and does not label failed agreement queries as absent', async () => {
        vi.mocked(getReadinessProfile).mockRejectedValue(new Error('Offline'));
        mount({ detail: undefined, detailError: true });
        expect(await screen.findByText('Firmendaten konnten nicht geladen werden.')).toBeInTheDocument();
        expect(screen.getByText('Kontaktdaten nicht verfügbar.')).toBeInTheDocument();
        expect(screen.queryByText('Nicht dokumentiert')).not.toBeInTheDocument();
        expect(await screen.findByText('Betreuung Nord')).toBeInTheDocument();
    });
});
