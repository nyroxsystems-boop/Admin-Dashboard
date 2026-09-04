import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertTriangle,
    Check,
    CircleDot,
    Clock3,
    ExternalLink,
    Lightbulb,
    MessageSquareText,
    Search,
    Sparkles,
    UserRound,
    Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

import {
    listProductFeedback,
    updateProductFeedback,
    type ProductFeedback,
    type ProductFeedbackCategory,
    type ProductFeedbackPriority,
    type ProductFeedbackStatus,
} from '@/api/productFeedback';
import { ErrorState } from '@/components/feedback/ErrorState';
import { SEITEN_RAND } from '@/components/ui/seite';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/utils/format/date';

const QUERY_KEY = ['admin', 'product-feedback'] as const;

const STATUS: Record<ProductFeedbackStatus, { label: string; tone: string; icon: typeof CircleDot }> = {
    new: { label: 'Neu', tone: 'bg-accent-500/12 text-accent-500', icon: CircleDot },
    seen: { label: 'Gesehen', tone: 'bg-overlay/[0.06] text-text-secondary', icon: MessageSquareText },
    planned: { label: 'Geplant', tone: 'bg-warning/12 text-warning', icon: Clock3 },
    done: { label: 'Erledigt', tone: 'bg-success/12 text-success', icon: Check },
    rejected: { label: 'Nicht übernommen', tone: 'bg-danger/10 text-danger', icon: AlertTriangle },
};

const CATEGORY: Record<ProductFeedbackCategory, { label: string; icon: typeof Lightbulb }> = {
    idea: { label: 'Idee', icon: Lightbulb },
    improvement: { label: 'Verbesserung', icon: Wrench },
    problem: { label: 'Problem', icon: AlertTriangle },
    other: { label: 'Sonstiges', icon: Sparkles },
};

const PRIORITY: Record<ProductFeedbackPriority, string> = {
    low: 'Niedrig',
    normal: 'Normal',
    high: 'Hoch',
};

export default function FeedbackView(): JSX.Element {
    const queryClient = useQueryClient();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [internalNote, setInternalNote] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | ProductFeedbackStatus>('all');
    const [categoryFilter, setCategoryFilter] = useState<'all' | ProductFeedbackCategory>('all');

    const feedbackQuery = useQuery({
        queryKey: QUERY_KEY,
        queryFn: listProductFeedback,
        staleTime: 15_000,
        refetchInterval: 60_000,
    });

    const update = useMutation({
        mutationFn: ({ id, input }: {
            id: string;
            input: Partial<Pick<ProductFeedback, 'status' | 'priority' | 'internal_note'>>;
        }) => updateProductFeedback(id, input),
        onSuccess: async ({ feedback }) => {
            setInternalNote(feedback.internal_note);
            await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
        onError: () => toast.error('Feedback konnte nicht aktualisiert werden.'),
    });

    const all = feedbackQuery.data?.feedback ?? [];
    const counts = useMemo(() => ({
        new: all.filter((item) => item.status === 'new').length,
        seen: all.filter((item) => item.status === 'seen').length,
        planned: all.filter((item) => item.status === 'planned').length,
        done: all.filter((item) => item.status === 'done').length,
    }), [all]);

    const filtered = useMemo(() => {
        const needle = search.trim().toLocaleLowerCase('de-DE');
        return all.filter((item) => {
            if (statusFilter !== 'all' && item.status !== statusFilter) return false;
            if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
            if (!needle) return true;
            return [item.subject, item.message, item.tenant_name, item.user_label]
                .some((value) => value.toLocaleLowerCase('de-DE').includes(needle));
        });
    }, [all, categoryFilter, search, statusFilter]);

    const selected = all.find((item) => item.id === selectedId) ?? null;

    function openFeedback(item: ProductFeedback): void {
        setSelectedId(item.id);
        setInternalNote(item.internal_note);
        if (item.status === 'new') {
            update.mutate({ id: item.id, input: { status: 'seen' } });
        }
    }

    function setStatus(status: ProductFeedbackStatus): void {
        if (!selected) return;
        update.mutate({ id: selected.id, input: { status } });
    }

    return (
        <div className={`${SEITEN_RAND} py-7`}>
            <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] border border-accent-500/20 bg-accent-500/10 text-accent-500">
                        <MessageSquareText className="size-5" aria-hidden />
                    </span>
                    <div>
                        <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-accent-500">
                            Produkt-Rückmeldungen
                        </p>
                        <h1 className="mt-1 font-display text-[26px] font-semibold tracking-tight text-text-primary">
                            Feedback
                        </h1>
                        <p className="mt-1 text-[12.5px] text-text-muted">
                            Rückmeldungen aus Nutzer-Dashboard, App und digitalen Anfragen zentral bearbeiten.
                        </p>
                    </div>
                </div>
                <span className="inline-flex items-center gap-2 rounded-xl border border-success/20 bg-success/8 px-3 py-2 text-[11px] font-semibold text-success">
                    <span className="size-1.5 rounded-full bg-success" />
                    Eingang vorbereitet
                </span>
            </header>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                    ['new', 'Neu', counts.new],
                    ['seen', 'Gesehen', counts.seen],
                    ['planned', 'Geplant', counts.planned],
                    ['done', 'Erledigt', counts.done],
                ] as const).map(([key, label, count]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
                        className={cn(
                            'flex min-h-16 items-center justify-between rounded-xl border px-4 text-left transition-colors',
                            statusFilter === key
                                ? 'border-accent-500/45 bg-accent-500/10'
                                : 'border-border-subtle bg-overlay/[0.02] hover:bg-overlay/[0.04]',
                        )}
                    >
                        <span className="text-[11.5px] font-semibold text-text-muted">{label}</span>
                        <strong className="font-mono text-[21px] text-text-primary">{count}</strong>
                    </button>
                ))}
            </div>

            <section className="karte min-h-[calc(100vh-300px)] w-full overflow-hidden !rounded-[20px]" aria-label="Feedback-Eingang">
                <div className="grid min-h-[calc(100vh-300px)] lg:grid-cols-[minmax(390px,0.82fr)_minmax(520px,1.18fr)]">
                    <div className="flex min-h-0 flex-col border-b border-border-subtle lg:border-b-0 lg:border-r">
                        <div className="grid gap-2 border-b border-border-subtle p-3 sm:grid-cols-[1fr_150px] lg:grid-cols-1 xl:grid-cols-[1fr_150px]">
                            <label className="relative">
                                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-faint" aria-hidden />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Feedback durchsuchen"
                                    className="h-10 w-full rounded-xl border border-border-subtle bg-canvas/55 pl-9 pr-3 text-[12px] text-text-primary outline-none focus:border-accent-500/60 focus:ring-2 focus:ring-accent-500/10"
                                />
                            </label>
                            <Select
                                value={categoryFilter}
                                onValueChange={(value) => setCategoryFilter(value as typeof categoryFilter)}
                            >
                                <SelectTrigger
                                    aria-label="Kategorie filtern"
                                    className={cn(
                                        'h-10 rounded-[10px] border-border-subtle bg-overlay/[0.025] px-3.5',
                                        'text-[11.5px] font-semibold text-text-secondary shadow-none',
                                        'transition-colors hover:border-overlay/20 hover:bg-overlay/[0.05]',
                                        'focus-visible:border-accent-500/60 focus-visible:ring-2 focus-visible:ring-accent-500/15',
                                        'data-[state=open]:border-accent-500/45 data-[state=open]:bg-accent-500/[0.07]',
                                        '[&_svg]:text-text-faint data-[state=open]:[&_svg]:rotate-180 data-[state=open]:[&_svg]:text-accent-500',
                                    )}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-[10px] border-border-subtle bg-popover p-1 shadow-xl">
                                    <SelectItem className="rounded-[7px] text-[11.5px]" value="all">Alle Kategorien</SelectItem>
                                    <SelectItem className="rounded-[7px] text-[11.5px]" value="idea">Ideen</SelectItem>
                                    <SelectItem className="rounded-[7px] text-[11.5px]" value="improvement">Verbesserungen</SelectItem>
                                    <SelectItem className="rounded-[7px] text-[11.5px]" value="problem">Probleme</SelectItem>
                                    <SelectItem className="rounded-[7px] text-[11.5px]" value="other">Sonstiges</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="min-h-[360px] flex-1 overflow-y-auto p-2.5">
                            {feedbackQuery.isLoading ? (
                                <div className="space-y-2">
                                    {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-overlay/[0.045]" />)}
                                </div>
                            ) : feedbackQuery.isError ? (
                                <ErrorState className="m-2" onRetry={() => void feedbackQuery.refetch()} />
                            ) : filtered.length === 0 ? (
                                <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
                                    <span className="flex size-12 items-center justify-center rounded-[14px] bg-accent-500/10 text-accent-500">
                                        <MessageSquareText className="size-5" aria-hidden />
                                    </span>
                                    <p className="mt-3 text-[13px] font-bold text-text-primary">
                                        {all.length === 0 ? 'Noch kein Nutzer-Feedback' : 'Kein Treffer'}
                                    </p>
                                    <p className="mt-1 max-w-[290px] text-[11.5px] leading-relaxed text-text-muted">
                                        {all.length === 0
                                            ? 'Der Eingang ist bereit. Sobald das Feedback-Modul im Nutzer-Dashboard aktiviert wird, erscheinen Rückmeldungen hier.'
                                            : 'Passe Suche oder Filter an, um weitere Rückmeldungen zu sehen.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {filtered.map((item) => {
                                        const categoryMeta = CATEGORY[item.category];
                                        const CategoryIcon = categoryMeta.icon;
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => openFeedback(item)}
                                                className={cn(
                                                    'w-full rounded-xl border p-3.5 text-left transition-colors',
                                                    selected?.id === item.id
                                                        ? 'border-accent-500/40 bg-accent-500/8'
                                                        : 'border-transparent bg-overlay/[0.018] hover:border-border-subtle hover:bg-overlay/[0.04]',
                                                )}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-overlay/[0.055] text-text-secondary">
                                                        <CategoryIcon className="size-4" aria-hidden />
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <h2 className="truncate text-[12.5px] font-bold text-text-primary">{item.subject}</h2>
                                                            {item.status === 'new' && <span className="mt-1 size-2 shrink-0 rounded-full bg-accent-500" />}
                                                        </div>
                                                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-muted">{item.message}</p>
                                                        <div className="mt-2.5 flex items-center justify-between gap-3 font-mono text-[9px] text-text-faint">
                                                            <span className="truncate">{item.tenant_name} · {item.user_label}</span>
                                                            <time className="shrink-0">{formatDateTime(item.created_at)}</time>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="min-h-[500px] bg-overlay/[0.012] p-4 lg:p-6">
                        {!selected ? (
                            <div className="flex h-full min-h-[480px] flex-col items-center justify-center text-center">
                                <MessageSquareText className="size-7 text-text-faint" aria-hidden />
                                <p className="mt-3 text-[13px] font-bold text-text-primary">Rückmeldung auswählen</p>
                                <p className="mt-1 max-w-[300px] text-[11.5px] text-text-muted">Links eine Rückmeldung öffnen, um Kontext, Priorität und Bearbeitungsstatus zu sehen.</p>
                            </div>
                        ) : (
                            <FeedbackDetail
                                feedback={selected}
                                internalNote={internalNote}
                                setInternalNote={setInternalNote}
                                pending={update.isPending}
                                onStatus={setStatus}
                                onPriority={(priority) => update.mutate({ id: selected.id, input: { priority } })}
                                onSaveNote={() => {
                                    update.mutate(
                                        { id: selected.id, input: { internal_note: internalNote } },
                                        { onSuccess: () => toast.success('Interne Notiz gespeichert') },
                                    );
                                }}
                            />
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}

function FeedbackDetail({
    feedback,
    internalNote,
    setInternalNote,
    pending,
    onStatus,
    onPriority,
    onSaveNote,
}: {
    feedback: ProductFeedback;
    internalNote: string;
    setInternalNote: (value: string) => void;
    pending: boolean;
    onStatus: (status: ProductFeedbackStatus) => void;
    onPriority: (priority: ProductFeedbackPriority) => void;
    onSaveNote: () => void;
}): JSX.Element {
    const status = STATUS[feedback.status];
    const StatusIcon = status.icon;
    const category = CATEGORY[feedback.category];
    const CategoryIcon = category.icon;
    const sourceLabel = feedback.source === 'user-dashboard'
        ? 'Nutzer-Dashboard'
        : feedback.source === 'mobile-app' ? 'Mobile App' : 'Digitale Anfrage';

    return (
        <article className="mx-auto max-w-[820px]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle pb-5">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold', status.tone)}>
                            <StatusIcon className="size-3.5" aria-hidden />
                            {status.label}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-overlay/[0.05] px-2.5 py-1 text-[10px] font-semibold text-text-muted">
                            <CategoryIcon className="size-3.5" aria-hidden />
                            {category.label}
                        </span>
                    </div>
                    <h2 className="mt-4 font-display text-[23px] font-semibold leading-tight text-text-primary">{feedback.subject}</h2>
                    <time className="mt-2 block font-mono text-[9.5px] text-text-faint">{formatDateTime(feedback.created_at)}</time>
                </div>
                <select
                    aria-label="Priorität"
                    value={feedback.priority}
                    onChange={(event) => onPriority(event.target.value as ProductFeedbackPriority)}
                    className="h-9 rounded-lg border border-border-subtle bg-canvas/60 px-3 text-[11px] font-semibold text-text-secondary outline-none focus:border-accent-500/60"
                >
                    {(Object.entries(PRIORITY) as Array<[ProductFeedbackPriority, string]>).map(([key, label]) => (
                        <option key={key} value={key}>Priorität: {label}</option>
                    ))}
                </select>
            </div>

            <div className="grid gap-3 border-b border-border-subtle py-4 sm:grid-cols-2">
                <div className="flex items-start gap-2.5">
                    <UserRound className="mt-0.5 size-4 text-accent-500" aria-hidden />
                    <div>
                        <p className="text-[11.5px] font-bold text-text-primary">{feedback.user_label}</p>
                        <p className="mt-0.5 text-[10.5px] text-text-muted">{feedback.tenant_name}{feedback.user_email ? ` · ${feedback.user_email}` : ''}</p>
                    </div>
                </div>
                <div className="sm:text-right">
                    <p className="text-[11.5px] font-bold text-text-primary">{sourceLabel}</p>
                    <p className="mt-0.5 font-mono text-[9.5px] text-text-faint">Mandant {feedback.tenant_id}</p>
                </div>
            </div>

            <div className="py-6">
                <p className="whitespace-pre-wrap text-[13px] leading-[1.75] text-text-secondary">{feedback.message}</p>
                {feedback.context?.route && (
                    <p className="mt-5 inline-flex items-center gap-1.5 font-mono text-[9.5px] text-text-faint">
                        <ExternalLink className="size-3" aria-hidden />
                        Gemeldet auf {String(feedback.context.route)}
                    </p>
                )}
            </div>

            <div className="border-t border-border-subtle pt-5">
                <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted" htmlFor="feedback-internal-note">
                    Interne Notiz
                </label>
                <textarea
                    id="feedback-internal-note"
                    value={internalNote}
                    onChange={(event) => setInternalNote(event.target.value)}
                    maxLength={4000}
                    rows={4}
                    placeholder="Entscheidung, Rückfrage oder nächster Schritt …"
                    className="mt-2 w-full resize-none rounded-xl border border-border-subtle bg-canvas/55 px-3.5 py-3 text-[12px] leading-relaxed text-text-secondary outline-none placeholder:text-text-faint focus:border-accent-500/60 focus:ring-2 focus:ring-accent-500/10"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" disabled={pending} onClick={onSaveNote} className="h-9 rounded-lg border border-border-subtle px-3 text-[10.5px] font-bold text-text-secondary transition hover:bg-overlay/[0.05] disabled:opacity-50">
                        Notiz speichern
                    </button>
                    <div className="ml-auto flex flex-wrap gap-1.5">
                        <button type="button" disabled={pending} onClick={() => onStatus('planned')} className="h-9 rounded-lg bg-warning/12 px-3 text-[10.5px] font-bold text-warning transition hover:bg-warning/18 disabled:opacity-50">Einplanen</button>
                        <button type="button" disabled={pending} onClick={() => onStatus('rejected')} className="h-9 rounded-lg bg-overlay/[0.05] px-3 text-[10.5px] font-bold text-text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-50">Nicht übernehmen</button>
                        <button type="button" disabled={pending} onClick={() => onStatus('done')} className="h-9 rounded-lg bg-success px-3 text-[10.5px] font-bold text-white transition hover:brightness-110 disabled:opacity-50">Erledigt</button>
                    </div>
                </div>
            </div>
        </article>
    );
}
