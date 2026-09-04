/**
 * OeQualityView — OE-Lernschleife überwachen (Ops).
 *
 *  - 4 Stat-Cards: gelerntes Wissen (+7d), Quellen-Aufschlüsselung,
 *    offene Verdachtsfälle, Unresolved-Rate der Lookups.
 *  - Review-Queue-Tabelle: pro Verdachtsfall „Verwerfen" (dismiss, Fehlalarm)
 *    oder „OE widerlegen" (refute — entfernt die Nummer DAUERHAFT aus dem
 *    gelernten Wissen, deshalb Bestätigungs-Dialog Pflicht).
 *  - Blöcke mit Backend-`error` (Migration 170 noch nicht aktiv) zeigen einen
 *    dezenten Hinweis statt Kaputt-Optik.
 */
import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import {
    BookOpenCheck,
    Camera,
    CircleHelp,
    Percent,
    ShieldAlert,
    ShieldCheck,
    Store,
    UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import {
    useCloseReviewItem,
    useOeMetrics,
    useOeReviewQueue,
    usePartslinkComparisons,
} from '@/hooks/useOeQuality';
import type { OeReviewItem } from '@/api/oeQuality';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatNumber, formatPercent } from '@/utils/format/number';
import { formatRelative } from '@/utils/format/date';
import { cn } from '@/lib/utils';
import { SEITEN_RAND } from '@/components/ui/seite';

// ──────────────────────────────────────────────────────────────────────────
//  Quellen-Metadaten (Lernschleife)
// ──────────────────────────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; hint: string; icon: JSX.Element }> = {
    photo: {
        label: 'Altteil-Foto',
        hint: 'OE per Foto des Altteils bestätigt',
        icon: <Camera className="size-3" aria-hidden />,
    },
    'customer-pick': {
        label: 'Kundenwahl',
        hint: 'Kunde hat diese OE im Chat gewählt',
        icon: <UserCheck className="size-3" aria-hidden />,
    },
    dealer: {
        label: 'Händler',
        hint: 'Vom Händler bestätigt',
        icon: <Store className="size-3" aria-hidden />,
    },
    'qa-session': {
        label: 'Partslink-Verifikation',
        hint: 'In einer QA-Session gegen Partslink verifiziert',
        icon: <BookOpenCheck className="size-3" aria-hidden />,
    },
};

/**
 * unresolvedRate kommt laut Vertrag als Zahl — defensiv normalisiert:
 * Werte ≤ 1 gelten als Bruch (0.12 → 12 %), Werte > 1 als bereits-Prozent.
 */
function toFraction(rate: number): number {
    if (!Number.isFinite(rate)) return 0;
    return rate > 1 ? rate / 100 : rate;
}

// ──────────────────────────────────────────────────────────────────────────
//  Kleine Bausteine (Muster: OverviewView)
// ──────────────────────────────────────────────────────────────────────────

function AnimatedCounter({
    value,
    format,
}: {
    value: number;
    format?: (n: number) => string;
}): JSX.Element {
    const mv = useMotionValue(0);
    const rounded = useTransform(mv, (latest) =>
        format ? format(latest) : Math.round(latest).toString(),
    );
    useEffect(() => {
        const controls = animate(mv, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
        return () => controls.stop();
    }, [mv, value]);
    return <motion.span className="font-mono tabular-nums">{rounded}</motion.span>;
}

/** Dezenter Hinweis für Blöcke, deren Backend-Migration noch nicht aktiv ist. */
function MigrationHint(): JSX.Element {
    return (
        <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <CircleHelp className="size-3.5 shrink-0" aria-hidden />
            Migration 170 noch nicht aktiv
        </p>
    );
}

function StatCard({
    icon,
    label,
    hint,
    delay = 0,
    children,
}: {
    icon: JSX.Element;
    label: string;
    /** Tooltip (title) — fachliche Erklärung der Kennzahl. */
    hint?: string;
    delay?: number;
    children: React.ReactNode;
}): JSX.Element {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: delay * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-md border border-border bg-surface/40 p-4"
            title={hint}
        >
            <div className="flex items-center justify-between text-text-secondary mb-3">
                <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
                <span className="text-text-muted">{icon}</span>
            </div>
            {children}
        </motion.div>
    );
}

function StatCardsSkeleton(): JSX.Element {
    return (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-md border border-border bg-surface/40 p-4">
                    <Skeleton className="h-3 w-24 mb-4" />
                    <Skeleton className="h-8 w-20 mb-2" />
                    <Skeleton className="h-3 w-28" />
                </div>
            ))}
        </div>
    );
}

function QueueSkeleton(): JSX.Element {
    return (
        <div className="rounded-md border border-border p-3 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
            ))}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────────
//  View
// ──────────────────────────────────────────────────────────────────────────

export default function OeQualityView(): JSX.Element {
    const { metrics, isLoading: metricsLoading, error: metricsError, refetch: refetchMetrics } =
        useOeMetrics();
    const {
        items,
        backendError: queueBackendError,
        isLoading: queueLoading,
        error: queueError,
        refetch: refetchQueue,
    } = useOeReviewQueue('open', 50);
    const {
        items: partslinkMismatches,
        backendError: partslinkBackendError,
        isLoading: partslinkLoading,
        error: partslinkError,
        refetch: refetchPartslink,
    } = usePartslinkComparisons('mismatch', 50);
    const closeMut = useCloseReviewItem();

    /** Verdachtsfall, für den gerade der Widerlegen-Dialog offen ist. */
    const [pendingRefute, setPendingRefute] = useState<OeReviewItem | null>(null);

    function isRowBusy(item: OeReviewItem): boolean {
        return closeMut.isPending && closeMut.variables?.id === item.id;
    }

    function handleDismiss(item: OeReviewItem): void {
        closeMut.mutate(
            { id: item.id, action: 'dismiss' },
            {
                onSuccess: () => toast.success(`Verdachtsfall zu ${item.oe_number} verworfen.`),
                onError: (e) =>
                    toast.error(e instanceof Error ? e.message : 'Verwerfen fehlgeschlagen.'),
            },
        );
    }

    const knowledge = metrics?.knowledge;
    const reviewQueue = metrics?.reviewQueue;
    const lookups = metrics?.lookups;
    const partslink = metrics?.partslinkComparison;

    const sourceEntries = Object.entries(knowledge?.bySource ?? {}).sort((a, b) => b[1] - a[1]);
    const modeEntries = Object.entries(lookups?.byMode ?? {}).sort((a, b) => b[1] - a[1]);

    return (
        <div className={cn(SEITEN_RAND)}>
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">OE-Qualität</h1>
                <p className="text-sm text-text-secondary">
                    Lernschleife überwachen: bestätigtes OE-Wissen, Lookup-Qualität und offene
                    Verdachtsfälle.
                </p>
            </header>

            {/* ── Stat-Cards ─────────────────────────────────────────────── */}
            <section className="mb-8" aria-label="OE-Metriken">
                {metricsLoading && !metrics ? (
                    <StatCardsSkeleton />
                ) : metricsError && !metrics ? (
                    <ErrorState
                        message="OE-Metriken konnten nicht geladen werden."
                        onRetry={refetchMetrics}
                    />
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            icon={<BookOpenCheck className="size-4" aria-hidden />}
                            label="Gelerntes Wissen"
                            hint="Bestätigte OE-Nummern in der Wissensbasis (oe_knowledge)"
                            delay={0}
                        >
                            {knowledge?.error ? (
                                <MigrationHint />
                            ) : (
                                <>
                                    <div className="text-2xl font-display font-semibold tracking-tight">
                                        <AnimatedCounter
                                            value={knowledge?.total ?? 0}
                                            format={(n) => formatNumber(Math.round(n))}
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-text-muted">
                                        +{formatNumber(knowledge?.last7d ?? 0)} in 7 Tagen
                                    </p>
                                </>
                            )}
                        </StatCard>

                        <StatCard
                            icon={<Camera className="size-4" aria-hidden />}
                            label="Quellen"
                            hint="Woher das gelernte OE-Wissen stammt"
                            delay={1}
                        >
                            {knowledge?.error ? (
                                <MigrationHint />
                            ) : sourceEntries.length === 0 ? (
                                <p className="text-xs text-text-muted">Noch keine Einträge.</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {sourceEntries.map(([source, count]) => {
                                        const meta = SOURCE_META[source];
                                        return (
                                            <Badge
                                                key={source}
                                                variant="secondary"
                                                title={meta?.hint ?? source}
                                            >
                                                {meta?.icon}
                                                {meta?.label ?? source}
                                                <span className="font-mono tabular-nums">
                                                    {formatNumber(count)}
                                                </span>
                                            </Badge>
                                        );
                                    })}
                                </div>
                            )}
                        </StatCard>

                        <StatCard
                            icon={<ShieldAlert className="size-4" aria-hidden />}
                            label="Offene Verdachtsfälle"
                            hint="Review-Queue: OE-Nummern mit Verdacht (z. B. keine Angebote auf gewählte OE)"
                            delay={2}
                        >
                            {reviewQueue?.error ? (
                                <MigrationHint />
                            ) : (
                                <>
                                    <div className="text-2xl font-display font-semibold tracking-tight">
                                        <AnimatedCounter
                                            value={reviewQueue?.open ?? 0}
                                            format={(n) => formatNumber(Math.round(n))}
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-text-muted">
                                        +{formatNumber(reviewQueue?.last7d ?? 0)} in 7 Tagen
                                    </p>
                                </>
                            )}
                        </StatCard>

                        <StatCard
                            icon={<Percent className="size-4" aria-hidden />}
                            label="Unresolved-Rate"
                            hint="Anteil der OE-Lookups ohne auflösbares Ergebnis"
                            delay={3}
                        >
                            {lookups?.error ? (
                                <MigrationHint />
                            ) : (
                                <>
                                    <div className="text-2xl font-display font-semibold tracking-tight">
                                        <AnimatedCounter
                                            value={toFraction(lookups?.unresolvedRate ?? 0)}
                                            format={(n) => formatPercent(n)}
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-text-muted">
                                        {formatNumber(lookups?.total ?? 0)} Lookups
                                        {modeEntries.length > 0 && (
                                            <>
                                                {' · '}
                                                {modeEntries
                                                    .map(([mode, count]) => `${mode}: ${formatNumber(count)}`)
                                                    .join(' · ')}
                                            </>
                                        )}
                                    </p>
                                </>
                            )}
                        </StatCard>
                    </div>
                )}
            </section>

            {/* ── Unabhängiger Partslink24-Dauerabgleich ─────────────────── */}
            <section className="mb-8" aria-label="Partslink24-Dauerabgleich">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-display font-semibold tracking-tight">
                            Partslink24-Dauerabgleich
                        </h2>
                        <p className="text-sm text-text-secondary">
                            Unabhängige QA nach jeder VIN-Teileanfrage. Ziel: mindestens 97&nbsp;%
                            exakte OE-Übereinstimmung bei 1.000 vergleichbaren Fällen.
                        </p>
                    </div>
                    <Badge
                        variant={partslink?.releaseGatePassed ? 'default' : 'destructive'}
                        title="Freigabe erst ab Zielquote und Mindeststichprobe"
                    >
                        {partslink?.releaseGatePassed ? '97%-Gate bestanden' : 'Gate noch gesperrt'}
                    </Badge>
                </div>

                {partslink?.error ? (
                    <div className="rounded-md border border-dashed border-border-subtle bg-surface/50 px-6 py-8">
                        <p className="text-sm text-text-secondary">
                            Partslink24-Vergleichsmetriken sind noch nicht verfügbar.
                        </p>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <StatCard
                            icon={<Percent className="size-4" aria-hidden />}
                            label="Exakte Quote"
                            hint="Match / (Match + Abweichung). Offene und technisch nicht vergleichbare Fälle werden nicht als Treffer gezählt."
                        >
                            <div className="text-2xl font-display font-semibold tracking-tight">
                                {partslink?.accuracyRate == null
                                    ? '—'
                                    : formatPercent(partslink.accuracyRate)}
                            </div>
                            <p className="mt-1 text-xs text-text-muted">
                                Ziel {formatPercent(partslink?.targetRate ?? 0.97)}
                            </p>
                        </StatCard>
                        <StatCard
                            icon={<BookOpenCheck className="size-4" aria-hidden />}
                            label="Vergleichbare Fälle"
                            hint="Nur eindeutige YQ-Ergebnisse mit auswertbarem Partslink24-Gegenbeleg"
                        >
                            <div className="text-2xl font-display font-semibold tracking-tight">
                                {formatNumber(partslink?.comparable ?? 0)}
                                <span className="text-sm text-text-muted">
                                    {' / '}{formatNumber(partslink?.minimumComparable ?? 1000)}
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-text-muted">
                                {formatNumber(partslink?.matches ?? 0)} Treffer ·{' '}
                                {formatNumber(partslink?.mismatches ?? 0)} Abweichungen
                            </p>
                        </StatCard>
                        <StatCard
                            icon={<ShieldCheck className="size-4" aria-hidden />}
                            label="Position"
                            hint="Gegenprüfung von Achse und Seite, sofern Partslink24 Positionsbelege liefert"
                        >
                            <div className="text-2xl font-display font-semibold tracking-tight">
                                {partslink?.position.rate == null
                                    ? '—'
                                    : formatPercent(partslink.position.rate)}
                            </div>
                            <p className="mt-1 text-xs text-text-muted">
                                {formatNumber(partslink?.position.checked ?? 0)} geprüft
                            </p>
                        </StatCard>
                        <StatCard
                            icon={<ShieldAlert className="size-4" aria-hidden />}
                            label="Prüfwarteschlange"
                            hint="Ausstehende und aktuell laufende Partslink24-Vergleiche"
                        >
                            <div className="text-2xl font-display font-semibold tracking-tight">
                                {formatNumber((partslink?.pending ?? 0) + (partslink?.processing ?? 0))}
                            </div>
                            <p className="mt-1 text-xs text-text-muted">
                                {formatNumber(partslink?.providerErrors ?? 0)} Providerfehler ·{' '}
                                {formatNumber(partslink?.blocked ?? 0)} blockiert ·{' '}
                                {formatNumber(partslink?.notComparable ?? 0)} nicht vergleichbar
                            </p>
                        </StatCard>
                    </div>
                )}

                <div className="mb-3">
                    <h3 className="text-sm font-semibold">Aktuelle Abweichungen</h3>
                    <p className="text-xs text-text-secondary">
                        Diese Fälle müssen fachlich geprüft und anschließend in der YQ-Suchlogik
                        oder Begriffs-/Positionslogik korrigiert werden.
                    </p>
                </div>
                {partslinkLoading && partslinkMismatches.length === 0 ? (
                    <QueueSkeleton />
                ) : partslinkError && partslinkMismatches.length === 0 ? (
                    <ErrorState
                        message="Partslink24-Abweichungen konnten nicht geladen werden."
                        onRetry={refetchPartslink}
                    />
                ) : partslinkBackendError ? (
                    <div className="rounded-md border border-dashed border-border-subtle bg-surface/50 px-6 py-8 text-center">
                        <p className="text-sm text-text-secondary">{partslinkBackendError}</p>
                    </div>
                ) : partslinkMismatches.length === 0 ? (
                    <EmptyState
                        icon={ShieldCheck}
                        title="Keine Partslink24-Abweichungen"
                        description="Unter den bisher abgeschlossenen Vergleichen gibt es keine offene OE-Abweichung."
                    />
                ) : (
                    <div className="rounded-md border border-border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-surface/60 hover:bg-surface/60">
                                    <TableHead className="px-3">Teileanfrage</TableHead>
                                    <TableHead className="px-3">YQ</TableHead>
                                    <TableHead className="px-3">Partslink24</TableHead>
                                    <TableHead className="px-3">Prüfung</TableHead>
                                    <TableHead className="px-3">Grund</TableHead>
                                    <TableHead className="px-3">Alter</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {partslinkMismatches.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="px-3">
                                            <div className="text-xs font-medium">{item.part_query}</div>
                                            <div className="max-w-[220px] truncate text-[10px] text-text-muted">
                                                {item.vehicle_label ?? 'VIN-pseudonymisiert'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-3 font-mono text-xs">
                                            {item.yq_exact_oem
                                                ?? item.yq_oem_numbers?.slice(0, 2).join(', ')
                                                ?? 'kein Treffer'}
                                        </TableCell>
                                        <TableCell className="px-3 font-mono text-xs">
                                            {item.partslink_results?.slice(0, 3).map((entry) => entry.oem).join(', ')
                                                || 'kein Treffer'}
                                        </TableCell>
                                        <TableCell className="px-3">
                                            <div className="flex flex-wrap gap-1">
                                                <Badge variant={item.oe_match === false ? 'destructive' : 'outline'}>
                                                    OE {item.oe_match === true ? 'gleich' : item.oe_match === false ? 'abweichend' : 'offen'}
                                                </Badge>
                                                {(item.requested_axle || item.requested_side) && (
                                                    <Badge variant={item.position_match === false ? 'destructive' : 'outline'}>
                                                        Position {item.position_match === false ? 'falsch' : item.position_match === true ? 'gleich' : 'offen'}
                                                    </Badge>
                                                )}
                                                {item.requested_grouping && item.requested_grouping !== 'part' && (
                                                    <Badge variant={item.grouping_match === false ? 'destructive' : 'outline'}>
                                                        Gruppe {item.grouping_match === false ? 'falsch' : item.grouping_match === true ? 'gleich' : 'offen'}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-3 max-w-[300px]">
                                            <span
                                                className="block truncate text-xs text-text-secondary"
                                                title={item.comparison_reason ?? ''}
                                            >
                                                {item.comparison_reason ?? '—'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-3 text-xs text-text-secondary">
                                            {formatRelative(item.created_at)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </section>

            {/* ── Review-Queue ───────────────────────────────────────────── */}
            <section aria-label="Review-Queue">
                <div className="mb-3">
                    <h2 className="text-lg font-display font-semibold tracking-tight">
                        Review-Queue
                    </h2>
                    <p className="text-sm text-text-secondary">
                        Offene Verdachtsfälle — pro Fall entscheiden: „Verwerfen" (Fehlalarm) oder
                        „OE widerlegen" (Nummer ist falsch, wird dauerhaft aus dem Wissen entfernt).
                    </p>
                </div>

                {queueLoading && items.length === 0 && !queueBackendError ? (
                    <QueueSkeleton />
                ) : queueError && items.length === 0 ? (
                    <ErrorState
                        message="Review-Queue konnte nicht geladen werden."
                        onRetry={refetchQueue}
                    />
                ) : queueBackendError ? (
                    <div className="rounded-md border border-dashed border-border-subtle bg-surface/50 px-6 py-8 text-center">
                        <MigrationHint />
                    </div>
                ) : items.length === 0 ? (
                    <EmptyState
                        icon={ShieldCheck}
                        title="Keine offenen Verdachtsfälle"
                        description="Die Review-Queue ist leer — das gelernte OE-Wissen ist aktuell unauffällig."
                    />
                ) : (
                    <div className="rounded-md border border-border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-surface/60 hover:bg-surface/60">
                                    <TableHead className="px-3">OE-Nummer</TableHead>
                                    <TableHead className="px-3">Teiletyp</TableHead>
                                    <TableHead className="px-3">Grund</TableHead>
                                    <TableHead className="px-3">Alter</TableHead>
                                    <TableHead className="px-3">Tenant</TableHead>
                                    <TableHead className="px-3 text-right">Aktion</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="px-3">
                                            <span className="font-mono text-xs">{item.oe_number}</span>
                                            {item.oe_number_norm &&
                                                item.oe_number_norm !== item.oe_number && (
                                                    <div className="font-mono text-[10px] text-text-muted">
                                                        {item.oe_number_norm}
                                                    </div>
                                                )}
                                        </TableCell>
                                        <TableCell className="px-3 text-xs">
                                            {item.part_type_norm ?? '—'}
                                        </TableCell>
                                        <TableCell className="px-3 max-w-[280px]">
                                            <span
                                                className="block truncate text-xs text-text-secondary"
                                                title={item.reason}
                                            >
                                                {item.reason}
                                            </span>
                                        </TableCell>
                                        <TableCell
                                            className="px-3 text-xs text-text-secondary"
                                            title={item.created_at}
                                        >
                                            {formatRelative(item.created_at)}
                                        </TableCell>
                                        <TableCell className="px-3">
                                            {item.tenant_id ? (
                                                <span
                                                    className="font-mono text-xs"
                                                    title={`Herkunfts-Tenant ${item.tenant_id}`}
                                                >
                                                    {item.tenant_id}
                                                </span>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    title="Kein Herkunfts-Tenant — Eintrag im geteilten Katalog"
                                                >
                                                    geteilt
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-3">
                                            <div className="flex justify-end gap-1.5 whitespace-nowrap">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={isRowBusy(item)}
                                                    onClick={() => handleDismiss(item)}
                                                    title="Fehlalarm — Verdachtsfall schließen, Wissen bleibt unverändert"
                                                >
                                                    Verwerfen
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    disabled={isRowBusy(item)}
                                                    onClick={() => setPendingRefute(item)}
                                                    title="Die OE ist falsch — dauerhaft aus dem gelernten Wissen entfernen"
                                                >
                                                    OE widerlegen
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </section>

            {/* ── Bestätigungs-Dialog fürs Widerlegen (folgenreich!) ─────── */}
            <ConfirmDialog
                open={!!pendingRefute}
                onOpenChange={(open) => !open && setPendingRefute(null)}
                title={
                    pendingRefute ? `OE ${pendingRefute.oe_number} widerlegen?` : 'OE widerlegen?'
                }
                description={
                    <>
                        Die Nummer{' '}
                        <span className="font-mono">{pendingRefute?.oe_number ?? ''}</span> wird als
                        falsch markiert und <strong>dauerhaft</strong> aus dem gelernten OE-Wissen
                        entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
                    </>
                }
                confirmLabel="Ja, OE widerlegen"
                tone="danger"
                loading={closeMut.isPending}
                onConfirm={async () => {
                    if (!pendingRefute) return;
                    try {
                        const res = await closeMut.mutateAsync({
                            id: pendingRefute.id,
                            action: 'refute',
                        });
                        toast.success(
                            `OE ${pendingRefute.oe_number} widerlegt — ${formatNumber(res.refutedRows)} Wissens-Einträge entfernt.`,
                        );
                        setPendingRefute(null); // nur bei Erfolg schließen → Retry bleibt möglich
                    } catch (err) {
                        toast.error(
                            err instanceof Error ? err.message : 'Widerlegen fehlgeschlagen.',
                        );
                    }
                }}
            />
        </div>
    );
}
