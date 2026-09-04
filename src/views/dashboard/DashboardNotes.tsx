import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, Lightbulb, ListTodo, Plus, Trash2, Wrench } from 'lucide-react';
import { toast } from 'sonner';

import {
    createDashboardNote,
    deleteDashboardNote,
    listDashboardNotes,
    updateDashboardNote,
    type DashboardNoteCategory,
} from '@/api/dashboardNotes';
import { cn } from '@/lib/utils';

const QUERY_KEY = ['admin', 'dashboard', 'notes'] as const;

const KATEGORIEN: Record<DashboardNoteCategory, {
    label: string;
    icon: typeof Lightbulb;
    tone: string;
}> = {
    important: { label: 'Wichtig', icon: AlertCircle, tone: 'bg-danger/10 text-danger' },
    idea: { label: 'Idee', icon: Lightbulb, tone: 'bg-warning/10 text-warning' },
    improvement: { label: 'Verbesserung', icon: Wrench, tone: 'bg-accent-500/10 text-accent-500' },
    todo: { label: 'To-do', icon: ListTodo, tone: 'bg-success/10 text-success' },
};

export function DashboardNotes({ fullHeight = false }: { fullHeight?: boolean } = {}): JSX.Element {
    const qc = useQueryClient();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [category, setCategory] = useState<DashboardNoteCategory>('idea');

    const notesQuery = useQuery({
        queryKey: QUERY_KEY,
        queryFn: listDashboardNotes,
        staleTime: 15_000,
    });

    const refresh = async (): Promise<void> => {
        await qc.invalidateQueries({ queryKey: QUERY_KEY });
    };

    const create = useMutation({
        mutationFn: createDashboardNote,
        onSuccess: async () => {
            setTitle('');
            setBody('');
            await refresh();
            toast.success('Notiz gespeichert');
        },
        onError: () => toast.error('Notiz konnte nicht gespeichert werden.'),
    });

    const update = useMutation({
        mutationFn: ({ id, status }: { id: string; status: 'open' | 'done' }) => updateDashboardNote(id, { status }),
        onSuccess: refresh,
        onError: () => toast.error('Status konnte nicht geändert werden.'),
    });

    const remove = useMutation({
        mutationFn: deleteDashboardNote,
        onSuccess: refresh,
        onError: () => toast.error('Notiz konnte nicht gelöscht werden.'),
    });

    const notes = notesQuery.data?.notes ?? [];
    const offene = notes.filter((note) => note.status === 'open');
    const erledigte = notes.filter((note) => note.status === 'done');

    function speichern(): void {
        const saubererTitel = title.trim();
        if (!saubererTitel) return;
        create.mutate({ title: saubererTitel, body: body.trim(), category });
    }

    return (
        <section className={cn('mb-7', fullHeight && 'mb-0 flex min-h-[calc(100vh-245px)]')} aria-labelledby="notizboard-titel">
            <div className={cn('karte w-full overflow-hidden !rounded-[20px]', fullHeight && 'flex')}>
                <div className={cn(
                    'grid w-full lg:grid-cols-[minmax(300px,0.8fr)_minmax(420px,1.2fr)]',
                    fullHeight && 'lg:grid-cols-[minmax(360px,0.72fr)_minmax(560px,1.28fr)]',
                )}>
                    <div className={cn(
                        'border-b border-border-subtle p-5 lg:border-b-0 lg:border-r',
                        fullHeight && 'flex flex-col lg:p-6',
                    )}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-accent-500">
                                    Gemeinsam festhalten
                                </p>
                                <h2 id="notizboard-titel" className="mt-1 font-display text-[18px] font-semibold text-text-primary">
                                    Notizboard
                                </h2>
                                <p className="mt-1 text-[11.5px] leading-relaxed text-text-muted">
                                    Wichtiges, Ideen und Verbesserungen für das ganze Team.
                                </p>
                            </div>
                            <span className="rounded-full bg-overlay/[0.055] px-2.5 py-1 font-mono text-[10px] text-text-muted">
                                {offene.length} offen
                            </span>
                        </div>

                        <div className={cn('mt-5 space-y-3', fullHeight && 'flex flex-1 flex-col')}>
                            <input
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.shiftKey) speichern();
                                }}
                                maxLength={140}
                                placeholder="Was dürfen wir nicht vergessen?"
                                className="h-11 w-full rounded-xl border border-border-subtle bg-canvas/60 px-3.5 text-[13px] font-semibold text-text-primary outline-none transition focus:border-accent-500/60 focus:ring-2 focus:ring-accent-500/10"
                            />
                            <textarea
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                maxLength={4000}
                                rows={fullHeight ? 8 : 3}
                                placeholder="Kontext, nächster Schritt oder eine kurze Erklärung …"
                                className={cn(
                                    'w-full resize-none rounded-xl border border-border-subtle bg-canvas/60 px-3.5 py-3 text-[12px] leading-relaxed text-text-secondary outline-none transition placeholder:text-text-faint focus:border-accent-500/60 focus:ring-2 focus:ring-accent-500/10',
                                    fullHeight && 'min-h-[200px] flex-1',
                                )}
                            />
                            <div className="flex flex-wrap items-center gap-1.5">
                                {(Object.entries(KATEGORIEN) as Array<[DashboardNoteCategory, typeof KATEGORIEN[DashboardNoteCategory]]>).map(([key, item]) => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setCategory(key)}
                                            className={cn(
                                                'flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10.5px] font-semibold transition-colors',
                                                category === key
                                                    ? 'border-accent-500/40 bg-accent-500/10 text-accent-500'
                                                    : 'border-border-subtle text-text-muted hover:bg-overlay/[0.04] hover:text-text-primary',
                                            )}
                                        >
                                            <Icon className="size-3.5" aria-hidden />
                                            {item.label}
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    disabled={!title.trim() || create.isPending}
                                    onClick={speichern}
                                    className="ml-auto flex h-9 items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 text-[11px] font-bold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Plus className="size-3.5" aria-hidden />
                                    Eintragen
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className={cn('min-h-[292px] p-3.5', fullHeight && 'min-h-[520px] overflow-y-auto lg:p-5')}>
                        {notesQuery.isLoading ? (
                            <div className={cn('grid gap-2 sm:grid-cols-2', fullHeight && 'xl:grid-cols-3')}>
                                {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-overlay/[0.045]" />)}
                            </div>
                        ) : offene.length === 0 ? (
                            <div className={cn('flex h-full min-h-[250px] flex-col items-center justify-center text-center', fullHeight && 'min-h-[480px]')}>
                                <span className="flex size-11 items-center justify-center rounded-[13px] bg-success/10 text-success">
                                    <Check className="size-5" aria-hidden />
                                </span>
                                <p className="mt-3 text-[13px] font-semibold text-text-primary">Alles festgehalten</p>
                                <p className="mt-1 max-w-[260px] text-[11.5px] text-text-muted">Neue Gedanken können direkt links eingetragen werden.</p>
                            </div>
                        ) : (
                            <div className={cn('grid gap-2 sm:grid-cols-2', fullHeight && 'xl:grid-cols-3')}>
                                {offene.map((note) => {
                                    const meta = KATEGORIEN[note.category];
                                    const Icon = meta.icon;
                                    return (
                                        <article key={note.id} className="group flex flex-col rounded-xl border border-border-subtle bg-overlay/[0.022] p-3.5 transition-colors hover:bg-overlay/[0.04]">
                                            <div className="flex items-start gap-2.5">
                                                <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', meta.tone)}>
                                                    <Icon className="size-3.5" aria-hidden />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="text-[12.5px] font-bold leading-snug text-text-primary">{note.title}</h3>
                                                    {note.body && <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[11px] leading-relaxed text-text-muted">{note.body}</p>}
                                                </div>
                                            </div>
                                            <div className="mt-auto flex items-center gap-2 pt-3">
                                                <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-text-faint">
                                                    {note.author_label} · {new Date(note.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                                                </span>
                                                <button
                                                    type="button"
                                                    title="Als erledigt markieren"
                                                    aria-label={`${note.title} als erledigt markieren`}
                                                    onClick={() => update.mutate({ id: note.id, status: 'done' })}
                                                    className="flex size-7 items-center justify-center rounded-lg text-text-faint transition hover:bg-success/10 hover:text-success"
                                                >
                                                    <Check className="size-3.5" aria-hidden />
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Notiz löschen"
                                                    aria-label={`${note.title} löschen`}
                                                    onClick={() => remove.mutate(note.id)}
                                                    className="flex size-7 items-center justify-center rounded-lg text-text-faint transition hover:bg-danger/10 hover:text-danger"
                                                >
                                                    <Trash2 className="size-3.5" aria-hidden />
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                        {erledigte.length > 0 && (
                            <p className="mt-3 text-right font-mono text-[9.5px] text-text-faint">
                                {erledigte.length} erledigt
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
