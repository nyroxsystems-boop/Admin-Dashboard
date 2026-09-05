import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw, ShoppingCart, Receipt, Package, Truck, X } from 'lucide-react';
import { z } from 'zod';
import { apiFetch } from '@/api/client';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';

interface Operations {
    generatedAt: string;
    orders: { total: number; open: number; completed: number; lastOrderAt: string | null } | null;
    finance: { issuedCount: number; openCount: number; overdueCount: number; outstandingCents: number; overdueCents: number; currency: 'EUR' } | null;
    inventory: { products: number; units: number; lowStock: number; locations: number } | null;
    procurement: { openOrders: number; overdueOrders: number } | null;
    unavailable: string[];
}
type Section = 'invoices' | 'orders' | 'inventory' | 'procurement';
type Filter = 'open' | 'overdue' | 'low_stock';
const TITLES: Record<Section, string> = { invoices: 'Rechnungen & Forderungen', orders: 'Bestellungen', inventory: 'Lager & Bestand', procurement: 'Einkauf' };
const FILTERS: Record<Section, Array<{ value: Filter; label: string }>> = {
    invoices: [{ value: 'open', label: 'Offene Rechnungen' }, { value: 'overdue', label: 'Überfällige Rechnungen' }],
    orders: [{ value: 'open', label: 'Offene Bestellungen' }], inventory: [{ value: 'low_stock', label: 'Mindestbestand erreicht' }],
    procurement: [{ value: 'open', label: 'Offene Einkaufsbestellungen' }, { value: 'overdue', label: 'Liefertermin überschritten' }],
};
const STATUS: Record<string, string> = { issued: 'Offen', paid: 'Bezahlt', sent: 'Gesendet', confirmed: 'Bestätigt', partially_received: 'Teilweise eingegangen', open: 'Offen', pending: 'Ausstehend', processing: 'In Bearbeitung', new: 'Neu', received: 'Eingegangen', completed: 'Abgeschlossen', done: 'Abgeschlossen' };
const itemSchema = z.object({ id: z.string(), label: z.string(), detail: z.string().nullable(), status: z.string().nullable(), occurredAt: z.string().nullable(), dueAt: z.string().nullable(), amountCents: z.number().nullable(), currency: z.string().nullable(), stock: z.number().nullable(), minimumStock: z.number().nullable() });
const pageSchema = z.object({ section: z.enum(['invoices', 'orders', 'inventory', 'procurement']), filter: z.string(), items: z.array(itemSchema), nextCursor: z.string().nullable(), generatedAt: z.string() });

function money(cents: number | null, currency: string | null = 'EUR'): string {
    if (cents === null || !currency) return '—';
    try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(cents / 100); } catch { return '—'; }
}
function date(value: string | null): string { return value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString('de-DE') : '—'; }

export function TenantOperations({ tenantId }: { tenantId: string }): JSX.Element {
    return <OperationsWorkspace key={tenantId} tenantId={tenantId} />;
}

function OperationsWorkspace({ tenantId }: { tenantId: string }): JSX.Element {
    const [selected, setSelected] = useState<Section | null>(null);
    const detailTrigger = useRef<HTMLButtonElement | null>(null);
    const query = useQuery({ queryKey: ['admin', 'tenant-operations', tenantId], queryFn: () => apiFetch<Operations>(`/api/admin/tenants/${encodeURIComponent(tenantId)}/operations`), staleTime: 30_000 });
    if (query.isLoading) return <LoadingState label="Betriebsdaten werden geladen…" />;
    if (query.error || !query.data) return <ErrorState title="Betriebsdaten nicht verfügbar" message="Die Übersicht konnte nicht geladen werden." onRetry={() => void query.refetch()} />;
    const data = query.data;
    const areas = [
        { section: 'orders' as const, icon: ShoppingCart, rows: data.orders ? [{ label: 'Gesamt', value: data.orders.total }, { label: 'Offen', value: data.orders.open }, { label: 'Abgeschlossen', value: data.orders.completed }, { label: 'Letzte Bestellung', value: date(data.orders.lastOrderAt) }] : null },
        { section: 'invoices' as const, icon: Receipt, rows: data.finance ? [{ label: 'Rechnungen', value: data.finance.issuedCount }, { label: 'Offen', value: data.finance.openCount }, { label: 'Offener Betrag', value: money(data.finance.outstandingCents) }, { label: 'Überfällig', value: `${data.finance.overdueCount} · ${money(data.finance.overdueCents)}` }] : null },
        { section: 'inventory' as const, icon: Package, rows: data.inventory ? [{ label: 'Produkte', value: data.inventory.products }, { label: 'Einheiten', value: data.inventory.units }, { label: 'Mindestbestand erreicht', value: data.inventory.lowStock }, { label: 'Lagerorte', value: data.inventory.locations }] : null },
        { section: 'procurement' as const, icon: Truck, rows: data.procurement ? [{ label: 'Offene Bestellungen', value: data.procurement.openOrders }, { label: 'Überfällige Bestellungen', value: data.procurement.overdueOrders }] : null },
    ];
    return <div className="mb-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Betriebsübersicht</h2><p className="mt-1 text-sm text-text-muted">Partsunion-Warenwirtschaft · Stand {new Date(data.generatedAt).toLocaleString('de-DE')}</p></div><Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="size-4" />Aktualisieren</Button></div>
        {data.unavailable.length > 0 && <p role="status" className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">Einige Datenquellen sind derzeit nicht verfügbar. Diese Bereiche werden als unbekannt angezeigt.</p>}
        <div className="grid gap-4 md:grid-cols-2">{areas.map(area => <section key={area.section} className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><area.icon className="size-4 text-text-muted" />{TITLES[area.section]}</h3>
                {area.rows && <Button variant="ghost" size="sm" aria-expanded={selected === area.section} aria-controls="operations-detail" onClick={event => { detailTrigger.current = event.currentTarget; setSelected(area.section); }}>Vorgänge ansehen<span className="sr-only">: {TITLES[area.section]}</span><ArrowRight className="size-3.5" /></Button>}
            </div>
            {area.rows ? <dl className="grid grid-cols-2 gap-x-5 gap-y-4 p-4">{area.rows.map(item => <div key={item.label}><dt className="text-xs text-text-muted">{item.label}</dt><dd className="mt-1 text-base font-semibold tabular-nums">{item.value}</dd></div>)}</dl> : <p className="p-4 text-sm text-text-muted">Datenquelle nicht verfügbar.</p>}
        </section>)}</div>
        {selected && <OperationDetails key={selected} tenantId={tenantId} section={selected} onClose={() => { setSelected(null); detailTrigger.current?.focus(); }} />}
        <p className="text-xs leading-relaxed text-text-muted">Diese Ansicht dient der Prüfung. Operative Änderungen erfolgen mit den entsprechenden Rechten in der Händler-Warenwirtschaft. <Link to={`/tenants/${tenantId}?tab=access`} className="font-medium text-accent-500 hover:underline">Zugänge & Sicherheit</Link></p>
    </div>;
}

function OperationDetails({ tenantId, section, onClose }: { tenantId: string; section: Section; onClose: () => void }): JSX.Element {
    const heading = useRef<HTMLHeadingElement | null>(null);
    useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView?.({ block: 'start' }); }, []);
    const [filter, setFilter] = useState<Filter>(FILTERS[section][0].value);
    const query = useInfiniteQuery({
        queryKey: ['admin', 'tenant-operation-detail', tenantId, section, filter], initialPageParam: null as string | null,
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams({ filter, limit: '50' });
            if (pageParam) params.set('cursor', pageParam);
            return pageSchema.parse(await apiFetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/operations/${section}?${params}`));
        },
        getNextPageParam: page => page.nextCursor ?? undefined, staleTime: 30_000,
    });
    const items = [...new Map((query.data?.pages.flatMap(page => page.items) || []).map(item => [item.id, item])).values()];
    return <section id="operations-detail" aria-label={`${TITLES[section]} im Detail`} className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4"><h3 ref={heading} tabIndex={-1} className="text-base font-semibold focus:outline-none">{TITLES[section]} · Vorgänge</h3><div className="flex min-w-0 items-center gap-2">
            <select aria-label="Vorgänge filtern" value={filter} onChange={event => setFilter(event.target.value as Filter)} className="h-9 min-w-0 max-w-full rounded-md border border-border-subtle bg-surface px-2 text-sm">{FILTERS[section].map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Vorgangsdetails schließen"><X className="size-4" /></Button>
        </div></div>
        {query.isLoading ? <LoadingState label="Vorgänge werden geladen…" /> : query.isError ? <ErrorState title="Vorgänge nicht verfügbar" message="Die Detaildaten konnten nicht geladen werden. Es wird kein leerer Bestand angenommen." onRetry={() => void query.refetch()} className="m-4" />
            : items.length === 0 ? <p className="px-4 py-8 text-sm text-text-muted">Keine Vorgänge für diesen Filter vorhanden.</p>
                : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{TITLES[section]}, {FILTERS[section].find(option => option.value === filter)?.label}</caption>
                    <thead className="border-b border-border-subtle bg-elevated/50 text-xs text-text-secondary"><tr><th scope="col" className="px-4 py-3 font-medium">Vorgang / Artikel</th><th scope="col" className="px-4 py-3 font-medium">Status</th>
                        {section === 'inventory' ? <><th scope="col" className="px-4 py-3 text-right font-medium">Bestand</th><th scope="col" className="px-4 py-3 text-right font-medium">Mindestbestand</th></>
                            : <><th scope="col" className="px-4 py-3 font-medium">Datum</th><th scope="col" className="px-4 py-3 font-medium">Fällig / Liefertermin</th><th scope="col" className="px-4 py-3 text-right font-medium">{section === 'invoices' ? 'Offener Betrag' : 'Betrag'}</th></>}
                    </tr></thead><tbody className="divide-y divide-border-subtle">{items.map(item => <tr key={item.id} className="hover:bg-elevated/40"><td className="max-w-xs px-4 py-3"><div className="font-medium text-text-primary">{item.label}</div>{item.detail && <p className="mt-1 break-words text-xs text-text-muted">{item.detail}</p>}</td><td className="whitespace-nowrap px-4 py-3 text-text-secondary">{item.status ? STATUS[item.status] || item.status : '—'}</td>
                        {section === 'inventory' ? <><td className="px-4 py-3 text-right tabular-nums">{item.stock ?? '—'}</td><td className="px-4 py-3 text-right tabular-nums">{item.minimumStock ?? '—'}</td></>
                            : <><td className="whitespace-nowrap px-4 py-3 text-text-secondary">{date(item.occurredAt)}</td><td className="whitespace-nowrap px-4 py-3 text-text-secondary">{date(item.dueAt)}</td><td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money(item.amountCents, item.currency)}</td></>}
                    </tr>)}</tbody></table></div>}
        {query.data && !query.isError && <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 text-xs text-text-muted"><span>{items.length} Vorgänge geladen · Nur lesender Zugriff</span>{query.hasNextPage && <Button variant="outline" size="sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? 'Lädt…' : 'Weitere Vorgänge laden'}</Button>}</div>}
    </section>;
}
