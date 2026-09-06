import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketingOverview } from '@/api/marketing';

const { getMarketingOverview, getMarketingConnections, updateCampaignStatus } = vi.hoisted(() => ({
    getMarketingOverview: vi.fn(),
    getMarketingConnections: vi.fn(),
    updateCampaignStatus: vi.fn(),
}));

vi.mock('@/api/marketing', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@/api/marketing');
    return { ...actual, getMarketingOverview, getMarketingConnections, updateCampaignStatus, updateCampaignBudget: vi.fn() };
});
vi.mock('@/auth/usePermissions', () => ({ usePermissions: () => ({ can: () => true }) }));

import MarketingView from './MarketingView';

const summary = { impressions: 1000, clicks: 100, spend: 250, conversions: 10, conversionValue: 1000, ctr: 10, cpc: 2.5, cpa: 25 };
const overview: MarketingOverview = {
    range: { from: '2026-08-08', to: '2026-09-06', previousFrom: '2026-07-09', previousTo: '2026-08-07' },
    generatedAt: '2026-09-06T12:00:00.000Z',
    connections: [
        { provider: 'plausible', label: 'Website-Statistik', state: 'connected' },
        { provider: 'google', label: 'Google Ads', state: 'connected', accountName: 'Partsunion DE' },
        { provider: 'meta', label: 'Meta Ads', state: 'not_configured', missing: ['META_ADS_ACCESS_TOKEN'] },
    ],
    website: {
        summary: { visitors: 120, visits: 145, pageviews: 310, bounceRate: 34, visitDuration: 92, events: 380 },
        previous: { visitors: 100, visits: 120, pageviews: 260, bounceRate: 39, visitDuration: 80, events: 320 },
        trend: [{ date: '2026-09-01', visitors: 20, pageviews: 51 }],
        pages: [{ label: '/plattform/neuteile', visitors: 62, pageviews: 140 }],
        sources: [{ label: 'Google', visitors: 54 }],
        regions: [{ label: 'Nordrhein-Westfalen, Deutschland', country: 'Deutschland', region: 'Nordrhein-Westfalen', visitors: 48 }],
        clicks: [{ page: '/', target: 'Beratung', placement: 'header', destination: '/beratung', kind: 'internal', clicks: 19 }],
    },
    ads: { google: { accountName: 'Partsunion DE', currency: 'EUR', summary, campaigns: [{ provider: 'google', id: '123', name: 'Neuteile Suche', status: 'ENABLED', currency: 'EUR', dailyBudget: 50, budgetEditable: true, ...summary }] } },
};

describe('MarketingView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getMarketingOverview.mockResolvedValue(overview);
        getMarketingConnections.mockResolvedValue([
            { provider: 'google', connected: true, managedBy: 'oauth', authAvailable: true, missingConfiguration: [], selectedAccountId: '1234567890', selectedAccountName: 'Partsunion DE', accounts: [{ id: '1234567890', name: 'Partsunion DE', currency: 'EUR' }] },
            { provider: 'meta', connected: false, managedBy: 'none', authAvailable: true, missingConfiguration: [], accounts: [] },
        ]);
        updateCampaignStatus.mockResolvedValue({ ok: true });
    });

    it('shows website geography, click targets and live campaign controls', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
        render(<QueryClientProvider client={client}><MarketingView /></QueryClientProvider>);

        expect(await screen.findByText('Neuteile Suche')).toBeInTheDocument();
        expect(screen.getByText('Nordrhein-Westfalen, Deutschland')).toBeInTheDocument();
        expect(screen.getByText('Beratung')).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: /Anmelden & verbinden/i })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }));
        expect(screen.getByRole('heading', { name: 'Kampagne pausieren?' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));
        await waitFor(() => expect(updateCampaignStatus).toHaveBeenCalledWith('google', '123', 'PAUSED'));
    });
});
