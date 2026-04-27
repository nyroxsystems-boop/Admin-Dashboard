/**
 * AuditLogView — Cursor-paginated audit log with live-search and CSV export.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Search } from 'lucide-react';
import { toast } from 'sonner';

import { useAuditLogs, useExportAuditCsv } from '@/hooks/useAuditLogs';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDateTime } from '@/utils/format/date';

export default function AuditLogView(): JSX.Element {
    const [params] = useSearchParams();
    const tenantFilter = params.get('tenant');

    const { entries, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useAuditLogs();
    const exportMut = useExportAuditCsv();
    const [search, setSearch] = useState('');
    const debounced = useDebounce(search, 200);

    const filtered = useMemo(() => {
        return entries.filter((e) => {
            if (tenantFilter && e.entity_id !== tenantFilter) return false;
            if (!debounced) return true;
            const q = debounced.toLowerCase();
            return (
                (e.admin_user ?? '').toLowerCase().includes(q) ||
                (e.admin_username ?? '').toLowerCase().includes(q) ||
                (e.action ?? '').toLowerCase().includes(q) ||
                (e.action_type ?? '').toLowerCase().includes(q) ||
                (e.entity_type ?? '').toLowerCase().includes(q)
            );
        });
    }, [entries, debounced, tenantFilter]);

    async function handleExport(): Promise<void> {
        try {
            const blob = await exportMut.mutateAsync(undefined);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'audit.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('CSV exportiert.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Export fehlgeschlagen.');
        }
    }

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-display font-semibold tracking-tight">Audit Log</h1>
                    <p className="text-sm text-text-secondary">
                        {filtered.length} Einträge{tenantFilter ? ` · gefiltert nach ${tenantFilter}` : ''}
                    </p>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={exportMut.isPending}
                    onClick={() => void handleExport()}
                >
                    <Download className="size-4" /> {exportMut.isPending ? 'Exportiere…' : 'CSV Export'}
                </Button>
            </header>

            <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
                    <Input
                        type="search"
                        placeholder="Suche nach Actor, Action, Resource…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            {isLoading && entries.length === 0 ? (
                <LoadingState label="Lade Audit-Einträge…" />
            ) : (
                <div className="rounded-md border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-surface/60 text-left">
                            <tr>
                                <th className="px-3 py-2">Zeit</th>
                                <th className="px-3 py-2">Actor</th>
                                <th className="px-3 py-2">Action</th>
                                <th className="px-3 py-2">Entity</th>
                                <th className="px-3 py-2">IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((e) => {
                                const ts = e.created_at ?? e.timestamp ?? '';
                                return (
                                    <tr key={e.id} className="border-t border-border">
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {ts ? formatDateTime(ts) : '—'}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="font-medium">{e.admin_user ?? '—'}</div>
                                            <div className="text-xs text-text-muted">
                                                {e.admin_username ?? ''}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {e.action ?? e.action_type ?? '—'}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {e.entity_type ?? '—'}
                                            {e.entity_id ? `:${e.entity_id}` : ''}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {e.ip_address ?? '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {hasNextPage && (
                <div className="flex justify-center mt-4">
                    <Button variant="outline" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
                        {isFetchingNextPage ? 'Lade…' : 'Weitere laden'}
                    </Button>
                </div>
            )}
        </div>
    );
}
