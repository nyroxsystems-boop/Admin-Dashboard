import type { MarketingCampaign, MarketingOverview, MarketingSummary } from '@/api/marketing';

export function allCampaigns(data: MarketingOverview | undefined): MarketingCampaign[] {
    return [...(data?.ads.google?.campaigns || []), ...(data?.ads.meta?.campaigns || [])];
}

export function totalsByCurrency(data: MarketingOverview | undefined): Array<{ currency: string; summary: MarketingSummary }> {
    const result = new Map<string, MarketingSummary>();
    for (const account of [data?.ads.google, data?.ads.meta]) {
        if (!account) continue;
        const current = result.get(account.currency) || { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0, ctr: 0, cpc: 0, cpa: 0 };
        current.impressions += account.summary.impressions;
        current.clicks += account.summary.clicks;
        current.spend += account.summary.spend;
        current.conversions += account.summary.conversions;
        current.conversionValue += account.summary.conversionValue;
        result.set(account.currency, current);
    }
    return [...result.entries()].map(([currency, summary]) => ({
        currency,
        summary: {
            ...summary,
            ctr: summary.impressions ? (summary.clicks / summary.impressions) * 100 : 0,
            cpc: summary.clicks ? summary.spend / summary.clicks : 0,
            cpa: summary.conversions ? summary.spend / summary.conversions : 0,
        },
    }));
}

export function percentChange(current: number, previous: number): number | null {
    if (previous === 0) return current === 0 ? 0 : null;
    return ((current - previous) / previous) * 100;
}

export function datePreset(days: number, now = new Date()): { from: string; to: string } {
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function compactNumber(value: number): string {
    return new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function money(value: number, currency: string): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}
