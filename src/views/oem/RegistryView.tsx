/**
 * RegistryView — OEM-Registry overview with active filter pills + Clear-All.
 */
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

import { useOemRegistry } from '@/hooks/useOemRegistry';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatDateTime } from '@/utils/format/date';

const BRANDS = ['BMW', 'VAG', 'Mercedes', 'Opel'];
const CATEGORIES = ['Brakes', 'Filters', 'Suspension'];

export default function RegistryView(): JSX.Element {
    const [brand, setBrand] = useState<string | undefined>(undefined);
    const [category, setCategory] = useState<string | undefined>(undefined);
    const [vinSearch, setVinSearch] = useState('');
    const debouncedVin = useDebounce(vinSearch, 200);

    const { entries, isLoading, error, refetch } = useOemRegistry({
        brand,
        category,
    });

    // VIN search filters in addition to filters — does NOT overwrite them.
    const filtered = useMemo(() => {
        if (!debouncedVin) return entries;
        const q = debouncedVin.toLowerCase();
        return entries.filter((e) => e.oem.toLowerCase().includes(q));
    }, [entries, debouncedVin]);

    const activeFilters: { label: string; clear: () => void }[] = [];
    if (brand) activeFilters.push({ label: `Brand: ${brand}`, clear: () => setBrand(undefined) });
    if (category) activeFilters.push({ label: `Cat: ${category}`, clear: () => setCategory(undefined) });
    if (debouncedVin) activeFilters.push({ label: `Search: ${debouncedVin}`, clear: () => setVinSearch('') });

    function clearAll(): void {
        setBrand(undefined);
        setCategory(undefined);
        setVinSearch('');
    }

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">OEM Registry</h1>
                <p className="text-sm text-text-secondary">{filtered.length} Einträge</p>
            </header>

            <div className="flex items-center gap-3 mb-3 flex-wrap">
                <div className="relative">
                    <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
                    <Input
                        type="search"
                        placeholder="VIN / OEM suchen…"
                        value={vinSearch}
                        onChange={(e) => setVinSearch(e.target.value)}
                        className="pl-8 w-64"
                    />
                </div>
                <select
                    value={brand ?? ''}
                    onChange={(e) => setBrand(e.target.value || undefined)}
                    className="h-9 px-2 rounded-md bg-surface border border-border text-sm"
                >
                    <option value="">Alle Brands</option>
                    {BRANDS.map((b) => (
                        <option key={b} value={b}>
                            {b}
                        </option>
                    ))}
                </select>
                <select
                    value={category ?? ''}
                    onChange={(e) => setCategory(e.target.value || undefined)}
                    className="h-9 px-2 rounded-md bg-surface border border-border text-sm"
                >
                    <option value="">Alle Kategorien</option>
                    {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
                {activeFilters.length > 0 && (
                    <Button variant="outline" size="sm" onClick={clearAll}>
                        Alle Filter löschen
                    </Button>
                )}
            </div>

            {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {activeFilters.map((f, idx) => (
                        <button
                            key={idx}
                            onClick={f.clear}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-accent-500/40 bg-accent-500/10 text-xs text-accent-500"
                        >
                            {f.label} <X className="size-3" />
                        </button>
                    ))}
                </div>
            )}

            {isLoading ? (
                <LoadingState label="Lade OEM-Daten…" />
            ) : error ? (
                <ErrorState message="OEM-Daten konnten nicht geladen werden." onRetry={refetch} />
            ) : filtered.length === 0 ? (
                <EmptyState
                    title="Keine OEM-Einträge"
                    description="Setze die Filter zurück oder erfasse neue OEM-Daten."
                />
            ) : (
                <div className="rounded-md border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-surface/60 text-left">
                            <tr>
                                <th className="px-3 py-2">OEM</th>
                                <th className="px-3 py-2">Brand</th>
                                <th className="px-3 py-2">Kategorie</th>
                                <th className="px-3 py-2">Confidence</th>
                                <th className="px-3 py-2">Quelle</th>
                                <th className="px-3 py-2">Aktualisiert</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((e) => (
                                <tr key={e.id} className="border-t border-border hover:bg-elevated/40">
                                    <td className="px-3 py-2 font-mono">{e.oem}</td>
                                    <td className="px-3 py-2">{e.brand}</td>
                                    <td className="px-3 py-2">{e.part_category}</td>
                                    <td className="px-3 py-2 font-mono">
                                        {(e.confidence * 100).toFixed(0)}%
                                    </td>
                                    <td className="px-3 py-2 text-xs uppercase">
                                        {/* sources may be null/missing/non-string in legacy rows */}
                                        {(typeof e.sources === 'string' ? e.sources.split(',')[0]?.trim() : '') || '—'}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-text-secondary">
                                        {formatDateTime(e.created_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
