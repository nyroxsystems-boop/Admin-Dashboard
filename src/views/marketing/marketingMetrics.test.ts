import { describe, expect, it } from 'vitest';
import { datePreset, percentChange, totalsByCurrency } from './marketingMetrics';
import type { MarketingOverview } from '@/api/marketing';

describe('marketing metrics', () => {
    it('keeps accounts with different currencies separate', () => {
        const summary = { impressions: 1000, clicks: 100, spend: 250, conversions: 10, conversionValue: 1000, ctr: 10, cpc: 2.5, cpa: 25 };
        const data: MarketingOverview = {
            range: { from: '2026-09-01', to: '2026-09-06', previousFrom: '2026-08-26', previousTo: '2026-08-31' },
            generatedAt: '2026-09-06T12:00:00.000Z',
            connections: [],
            ads: {
            google: { accountName: 'DE', currency: 'EUR', summary, campaigns: [] },
            meta: { accountName: 'US', currency: 'USD', summary, campaigns: [] },
        } };
        expect(totalsByCurrency(data).map((row) => row.currency)).toEqual(['EUR', 'USD']);
    });

    it('does not invent a percentage when the comparison period is zero', () => {
        expect(percentChange(5, 0)).toBeNull();
        expect(percentChange(0, 0)).toBe(0);
        expect(percentChange(120, 100)).toBe(20);
    });

    it('creates inclusive UTC date presets', () => {
        expect(datePreset(30, new Date('2026-09-06T21:30:00Z'))).toEqual({ from: '2026-08-08', to: '2026-09-06' });
    });
});
