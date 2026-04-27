/**
 * LookupView — VIN/OEM lookup with live result detail.
 *
 * VIN-search and OEM-search are explicitly separated; the active-filter
 * surface from RegistryView is intentionally NOT shared.
 */
import { useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

import { useOemLookup, useSearchByVin } from '@/hooks/useOemLookup';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { copyToClipboard } from '@/utils/clipboard';

type Mode = 'oem' | 'vin';

export default function LookupView(): JSX.Element {
    const { result, isLoading, error, lookup, clear } = useOemLookup();
    const vinSearchMut = useSearchByVin();
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState<Mode>('oem');

    async function handleSubmit(e: React.FormEvent): Promise<void> {
        e.preventDefault();
        if (!query.trim()) return;
        if (mode === 'oem') {
            await lookup(query);
        } else {
            try {
                await vinSearchMut.mutateAsync({ vin: query.trim() });
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'VIN-Suche fehlgeschlagen.');
            }
        }
    }

    const vinResults = vinSearchMut.data?.records ?? [];
    const isVinLoading = vinSearchMut.isPending;
    const isAnyLoading = isLoading || isVinLoading;

    return (
        <div className="p-6 md:p-8 max-w-3xl mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">OEM Lookup</h1>
                <p className="text-sm text-text-secondary">VIN- oder OEM-Nummer eingeben.</p>
            </header>

            <div className="mb-4 flex gap-2">
                <Button
                    size="sm"
                    variant={mode === 'oem' ? 'default' : 'outline'}
                    onClick={() => setMode('oem')}
                >
                    OEM
                </Button>
                <Button
                    size="sm"
                    variant={mode === 'vin' ? 'default' : 'outline'}
                    onClick={() => setMode('vin')}
                >
                    VIN
                </Button>
            </div>

            <form
                onSubmit={(e) => void handleSubmit(e)}
                className="flex items-center gap-2 mb-6"
            >
                <div className="relative flex-1">
                    <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
                    <Input
                        type="search"
                        placeholder={mode === 'oem' ? 'OEM-Nummer…' : 'VIN…'}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-8"
                        autoFocus
                    />
                </div>
                <Button type="submit" disabled={!query.trim() || isAnyLoading}>
                    Suchen
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        clear();
                        vinSearchMut.reset();
                        setQuery('');
                    }}
                >
                    Zurücksetzen
                </Button>
            </form>

            {isAnyLoading ? (
                <LoadingState label="Suche…" />
            ) : error ? (
                <ErrorState message={error} />
            ) : mode === 'oem' && result ? (
                <div className="rounded-md border border-border bg-surface/40 p-4 space-y-3">
                    <div className="flex justify-between items-baseline">
                        <div>
                            <div className="font-mono text-lg">{result.oem}</div>
                            <div className="text-xs text-text-muted">
                                {result.existsInRegistry ? 'In Registry' : 'AI-Vorschlag'}
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                                if (await copyToClipboard(result.oem)) toast.success('Kopiert.');
                            }}
                        >
                            Kopieren
                        </Button>
                    </div>
                    {result.registryRecord && (
                        <dl className="grid grid-cols-2 gap-1 text-sm">
                            <dt className="text-text-secondary">Brand</dt>
                            <dd>{result.registryRecord.brand}</dd>
                            <dt className="text-text-secondary">Kategorie</dt>
                            <dd>{result.registryRecord.part_category}</dd>
                            <dt className="text-text-secondary">Modell</dt>
                            <dd>{result.registryRecord.model}</dd>
                            <dt className="text-text-secondary">Confidence</dt>
                            <dd className="font-mono">
                                {(result.registryRecord.confidence * 100).toFixed(0)}%
                            </dd>
                        </dl>
                    )}
                    <div className="text-xs text-text-secondary border-t border-border pt-2">
                        AI: <span className="font-medium">{result.aiResult.partName}</span> ·{' '}
                        {result.aiResult.brand} · {(result.aiResult.confidence * 100).toFixed(0)}%
                    </div>
                </div>
            ) : mode === 'vin' && vinResults.length > 0 ? (
                <ul className="space-y-2">
                    {vinResults.map((r) => (
                        <li
                            key={r.id}
                            className="rounded-md border border-border bg-surface/40 p-3 flex items-center justify-between"
                        >
                            <div>
                                <div className="font-mono">{r.oem}</div>
                                <div className="text-xs text-text-muted">
                                    {r.brand} · {r.part_category} ·{' '}
                                    {(r.confidence * 100).toFixed(0)}%
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                    if (await copyToClipboard(r.oem)) toast.success('Kopiert.');
                                }}
                            >
                                Kopieren
                            </Button>
                        </li>
                    ))}
                </ul>
            ) : (
                <EmptyState
                    title="Noch keine Suche"
                    description="Gib eine VIN oder OEM-Nummer ein, um zu starten."
                />
            )}
        </div>
    );
}
