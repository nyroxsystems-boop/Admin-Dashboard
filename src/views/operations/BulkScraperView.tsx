/**
 * BulkScraperView — PartsLink24 health monitor + on-demand single lookup.
 *
 * NOTE: The previous bulk-job listing did not exist on the backend. This view
 * is now a Live-health monitor (15s auto-refresh via useScraperHealth) plus a
 * single-VIN lookup form using useScraperLookup.
 */
import { useState } from 'react';
import { toast } from 'sonner';

import { useScraperHealth, useScraperLookup } from '@/hooks/useScraper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';

export default function BulkScraperView(): JSX.Element {
    const healthQuery = useScraperHealth(true);
    const lookupMut = useScraperLookup();
    const [vin, setVin] = useState('');
    const [part, setPart] = useState('');
    const [brand, setBrand] = useState('');

    const canSubmit = vin.trim().length > 0 && part.trim().length > 0;

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto">
            <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-display font-semibold tracking-tight">
                        Scraper Monitor
                    </h1>
                    <p className="text-sm text-text-secondary">Auto-Refresh alle 15 Sekunden.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-success font-mono uppercase tracking-widest">
                        <span
                            className="size-1.5 rounded-full bg-success animate-pulse"
                            style={{ boxShadow: '0 0 6px #4ADE80' }}
                        />
                        Live
                    </span>
                    <Button size="sm" variant="outline" onClick={() => void healthQuery.refetch()}>
                        Aktualisieren
                    </Button>
                </div>
            </header>

            <section className="mb-6 rounded-md border border-border bg-surface/40 p-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-3">
                    Service-Health
                </h3>
                {healthQuery.isLoading && !healthQuery.data ? (
                    <LoadingState label="Lade Health…" />
                ) : healthQuery.error ? (
                    <ErrorState
                        message="Health konnte nicht geladen werden."
                        onRetry={() => void healthQuery.refetch()}
                    />
                ) : healthQuery.data ? (
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                        <dt className="text-text-secondary">Service</dt>
                        <dd className="font-mono">{healthQuery.data.service}</dd>
                        <dt className="text-text-secondary">Status</dt>
                        <dd className="font-mono uppercase">{healthQuery.data.status}</dd>
                    </dl>
                ) : null}
            </section>

            <section className="rounded-md border border-border bg-surface/40 p-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-3">
                    On-Demand Lookup
                </h3>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!canSubmit) return;
                        lookupMut.mutate(
                            {
                                vin: vin.trim(),
                                part: part.trim(),
                                brand: brand.trim() || undefined,
                            },
                            {
                                onSuccess: () => toast.success('Lookup abgeschlossen.'),
                                onError: (err) =>
                                    toast.error(
                                        err instanceof Error ? err.message : 'Lookup fehlgeschlagen.',
                                    ),
                            },
                        );
                    }}
                    className="grid sm:grid-cols-3 gap-3"
                >
                    <div className="space-y-1">
                        <Label htmlFor="sc-vin">VIN</Label>
                        <Input
                            id="sc-vin"
                            value={vin}
                            onChange={(e) => setVin(e.target.value)}
                            placeholder="WBA..."
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sc-part">Teil</Label>
                        <Input
                            id="sc-part"
                            value={part}
                            onChange={(e) => setPart(e.target.value)}
                            placeholder="Bremsbelag"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="sc-brand">Brand (optional)</Label>
                        <Input
                            id="sc-brand"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            placeholder="BMW"
                        />
                    </div>
                    <div className="sm:col-span-3 flex justify-end">
                        <Button type="submit" disabled={!canSubmit || lookupMut.isPending}>
                            {lookupMut.isPending ? 'Suche…' : 'Lookup starten'}
                        </Button>
                    </div>
                </form>

                {lookupMut.data && (
                    <pre className="mt-4 text-xs font-mono bg-elevated/40 rounded p-3 overflow-x-auto max-h-64">
                        {JSON.stringify(lookupMut.data, null, 2)}
                    </pre>
                )}
            </section>
        </div>
    );
}
