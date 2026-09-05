import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { apiFetch } from '@/api/client';
import { Button } from '@/components/ui/button';

const pageSchema = z.object({ events: z.array(z.object({ id: z.string(), version: z.number(), occurredAt: z.string(), actorId: z.string(), actorName: z.string().nullable(), fromStage: z.string(), toStage: z.string() })), nextCursor: z.string().nullable() });
const stages: Record<string, string> = { draft: 'Entwurf', provisioning: 'Einrichtung', integration: 'Integrationen', review: 'Freigabeprüfung', live: 'Go-live freigegeben' };

export function TenantProvisioningHistory({ tenantId, version }: { tenantId: string; version?: number }): JSX.Element {
    const [open, setOpen] = useState(false);
    const query = useInfiniteQuery({
        queryKey: ['admin', 'provisioning-history', tenantId, version], enabled: open,
        initialPageParam: null as string | null,
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams({ limit: '50' });
            if (pageParam) params.set('cursor', pageParam);
            return pageSchema.parse(await apiFetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/provisioning/history?${params}`));
        },
        getNextPageParam: page => page.nextCursor ?? undefined,
    });
    const events = query.data?.pages.flatMap(page => page.events) || [];
    return <details className="rounded-lg border border-border bg-surface" onToggle={event => setOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Änderungshistorie</summary>
        <div className="border-t border-border-subtle p-4">
            {query.isLoading ? <p role="status" className="text-sm text-text-muted">Historie wird geladen…</p> : query.isError ? <div role="alert" className="text-sm text-danger">Historie konnte nicht geladen werden. <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>Erneut laden</Button></div>
                : events.length === 0 ? <p className="text-sm text-text-muted">Noch keine Änderungen am Einrichtungsprozess dokumentiert.</p>
                    : <ol className="space-y-4">{events.map(event => <li key={event.id} className="border-l-2 border-border-subtle pl-3"><div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm font-medium">{event.fromStage === event.toStage ? 'Einrichtungsstand aktualisiert' : `${stages[event.fromStage] || event.fromStage} → ${stages[event.toStage] || event.toStage}`}</span><span className="text-xs text-text-muted">Version {event.version}</span></div><p className="mt-1 text-xs leading-relaxed text-text-secondary">{event.actorName || 'Interner Mitarbeiter'} · <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString('de-DE')}</time></p></li>)}</ol>}
            {query.hasNextPage && <Button variant="outline" size="sm" className="mt-4" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? 'Lädt…' : 'Weitere Änderungen laden'}</Button>}
        </div>
    </details>;
}
