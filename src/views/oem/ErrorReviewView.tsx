/**
 * ErrorReviewView — Review unresolved OEM-lookup errors.
 *
 * Backed by useOemErrors / useResolveOemError; persistence is server-side.
 */
import { useState } from 'react';
import { toast } from 'sonner';

import { useOemErrors, useResolveOemError } from '@/hooks/useOemErrors';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatRelative } from '@/utils/format/date';

export default function ErrorReviewView(): JSX.Element {
    const { entries, isLoading, error, refetch } = useOemErrors();
    const resolveMut = useResolveOemError();

    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [confirmBulk, setConfirmBulk] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    if (isLoading) return <LoadingState label="Lade Errors…" />;
    if (error) return <ErrorState message="Errors konnten nicht geladen werden." onRetry={refetch} />;

    const unresolved = entries.filter((e) => !e.resolved);

    function toggleSelect(id: string): void {
        setSelected((s) => {
            const next = new Set(s);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    async function resolveOne(id: string): Promise<void> {
        try {
            await resolveMut.mutateAsync(id);
            toast.success('Verworfen.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Aktion fehlgeschlagen.');
        }
    }

    async function resolveBulk(): Promise<void> {
        const ids = Array.from(selected);
        let ok = 0;
        let fail = 0;
        for (const id of ids) {
            try {
                await resolveMut.mutateAsync(id);
                ok += 1;
            } catch {
                fail += 1;
            }
        }
        toast.success(`${ok} verworfen${fail ? `, ${fail} Fehler` : ''}.`);
        setSelected(new Set());
    }

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto">
            <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-display font-semibold tracking-tight">
                        OEM Error Review
                    </h1>
                    <p className="text-sm text-text-secondary">
                        {unresolved.length} offene Einträge.
                    </p>
                </div>
                {selected.size > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setConfirmBulk(true)}>
                        {selected.size} verwerfen
                    </Button>
                )}
            </header>

            {unresolved.length === 0 ? (
                <EmptyState
                    title="Keine offenen Errors"
                    description="Alle OEM-Errors sind aufgelöst."
                />
            ) : (
                <ul className="space-y-2">
                    {unresolved.map((e) => (
                        <li
                            key={e.id}
                            className="rounded-md border border-border bg-surface/40 p-3 flex items-center gap-3"
                        >
                            <input
                                type="checkbox"
                                checked={selected.has(e.id)}
                                onChange={() => toggleSelect(e.id)}
                                aria-label={`Auswählen ${e.oem}`}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="font-mono">{e.oem}</div>
                                <div className="text-xs text-text-muted truncate">
                                    {e.error} · {formatRelative(e.occurred_at)}
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmId(e.id)}
                            >
                                Verwerfen
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            <ConfirmDialog
                open={!!confirmId}
                onOpenChange={(open) => !open && setConfirmId(null)}
                title="Eintrag verwerfen?"
                description="Wird in der Registry als 'verworfen' markiert."
                tone="danger"
                onConfirm={async () => {
                    if (confirmId) await resolveOne(confirmId);
                    setConfirmId(null);
                }}
            />

            <ConfirmDialog
                open={confirmBulk}
                onOpenChange={(open) => !open && setConfirmBulk(false)}
                title={`${selected.size} Einträge verwerfen?`}
                description="Alle ausgewählten Errors werden serverseitig als verworfen markiert."
                tone="danger"
                onConfirm={async () => {
                    await resolveBulk();
                    setConfirmBulk(false);
                }}
            />
        </div>
    );
}
