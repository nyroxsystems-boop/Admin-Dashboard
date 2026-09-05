import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/api/client';
import { TenantOperations } from './TenantOperations';
import { TenantProvisioningHistory } from './TenantProvisioningHistory';

vi.mock('@/api/client', () => ({ apiFetch: vi.fn() }));
const summary = { generatedAt: '2026-09-04T12:00:00Z', orders: null, finance: { issuedCount: 4, openCount: 2, overdueCount: 1, outstandingCents: 20000, overdueCents: 10000, currency: 'EUR' }, inventory: null, procurement: null, unavailable: ['orders', 'inventory', 'procurement'] };
const record = { id: 'invoice-a', label: 'RE-2026-001', detail: 'Workshop Nord', status: 'issued', occurredAt: null, dueAt: null, amountCents: null, currency: null, stock: null, minimumStock: null };
const detail = { section: 'invoices', filter: 'open', generatedAt: summary.generatedAt, items: [record], nextCursor: null };
function mount(component: React.ReactNode = <TenantOperations tenantId="dealer-a" />) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><MemoryRouter>{component}</MemoryRouter></QueryClientProvider>);
}
describe('Tenant operations drilldown', () => {
    beforeEach(() => vi.resetAllMocks());
    it('loads scoped details on demand, preserves unknown values and resets filtered pages', async () => {
        vi.mocked(apiFetch).mockImplementation(async (path) => String(path).includes('/operations?') || String(path).endsWith('/operations') ? summary : String(path).includes('filter=overdue') ? { ...detail, items: [] } : detail);
        mount();
        fireEvent.click(await screen.findByRole('button', { name: 'Vorgänge ansehen: Rechnungen & Forderungen' }));
        expect(await screen.findByText('RE-2026-001')).toBeInTheDocument();
        expect(apiFetch).toHaveBeenCalledWith('/api/admin/tenants/dealer-a/operations/invoices?filter=open&limit=50');
        expect(screen.getAllByText('—')).toHaveLength(3);
        fireEvent.change(screen.getByLabelText('Vorgänge filtern'), { target: { value: 'overdue' } });
        expect(await screen.findByText('Keine Vorgänge für diesen Filter vorhanden.')).toBeInTheDocument();
        expect(screen.queryByText('RE-2026-001')).not.toBeInTheDocument();
    });
    it('does not report an unavailable data source as an empty or zero balance', async () => {
        vi.mocked(apiFetch).mockImplementation(async (path) => {
            if (String(path).endsWith('/operations')) return summary;
            throw new Error('Unavailable');
        });
        mount();
        fireEvent.click(await screen.findByRole('button', { name: 'Vorgänge ansehen: Rechnungen & Forderungen' }));
        expect(await screen.findByText('Vorgänge nicht verfügbar')).toBeInTheDocument();
        expect(screen.queryByText('Keine Vorgänge für diesen Filter vorhanden.')).not.toBeInTheDocument();
        expect(screen.getAllByText('Datenquelle nicht verfügbar.')).toHaveLength(3);
    });
    it('opens an overdue finance task directly in the matching work queue', async () => {
        vi.mocked(apiFetch).mockImplementation(async (path) => String(path).endsWith('/operations') ? summary : { ...detail, filter: 'overdue', items: [] });
        mount();
        fireEvent.click(await screen.findByRole('button', { name: /1 überfällige Rechnung/ }));
        await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/admin/tenants/dealer-a/operations/invoices?filter=overdue&limit=50'));
        expect(screen.getByLabelText('Vorgänge filtern')).toHaveValue('overdue');
    });
    it('loads the history only when expanded and follows its version cursor', async () => {
        vi.mocked(apiFetch).mockImplementation(async (path) => ({ events: [{ id: String(path).includes('cursor=1') ? 'event-b' : 'event-a', version: String(path).includes('cursor=1') ? 2 : 1, occurredAt: summary.generatedAt, actorId: 'operator-id', actorName: 'Alex Beispiel', fromStage: 'draft', toStage: 'provisioning' }], nextCursor: String(path).includes('cursor=1') ? null : '1' }));
        mount(<TenantProvisioningHistory tenantId="dealer-a" />);
        expect(apiFetch).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('Änderungshistorie'));
        expect(await screen.findByText('Version 1')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Weitere Änderungen laden' }));
        expect(await screen.findByText('Version 2')).toBeInTheDocument();
        await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/admin/tenants/dealer-a/provisioning/history?limit=50&cursor=1'));
        expect(screen.queryByText('operator-id')).not.toBeInTheDocument();
    });
});
