/**
 * AccuracyView — OEM-Accuracy KPIs and trends.
 */
import { useQuery } from '@tanstack/react-query';

import { fetchAccuracyStats } from '@/api/oem';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';

export default function AccuracyView(): JSX.Element {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['admin', 'accuracy'] as const,
        queryFn: () => fetchAccuracyStats(),
        staleTime: 30_000,
        gcTime: 5 * 60_000,
    });

    if (isLoading) return <LoadingState label="Lade Accuracy-Daten…" />;
    if (error || !data) {
        return (
            <ErrorState
                message="Accuracy-Daten konnten nicht geladen werden."
                onRetry={() => void refetch()}
            />
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">OEM Accuracy</h1>
                <p className="text-sm text-text-secondary">Qualitäts-Übersicht der OEM-Daten.</p>
            </header>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Kpi label="Total Resolutions" value={data.totalResolutions} />
                <Kpi label="Bestätigt" value={data.confirmed} accent="success" />
                <Kpi label="Abgelehnt" value={data.rejected} accent="warning" />
                <Kpi label="Pending" value={data.pending} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mt-6">
                <div className="rounded-md border border-border bg-surface/40 p-4">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-2">
                        Avg Confidence
                    </h3>
                    <div className="font-mono text-3xl font-semibold">
                        {(data.avgConfidence * 100).toFixed(1)}%
                    </div>
                </div>
                <div className="rounded-md border border-border bg-surface/40 p-4">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-2">
                        Accuracy Rate
                    </h3>
                    <div className="font-mono text-3xl font-semibold">
                        {(data.accuracyRate * 100).toFixed(1)}%
                    </div>
                </div>
            </div>
        </div>
    );
}

function Kpi({
    label,
    value,
    accent,
}: {
    label: string;
    value: number;
    accent?: 'success' | 'warning';
}): JSX.Element {
    return (
        <div className="rounded-md border border-border bg-surface/40 p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-text-secondary mb-2">
                {label}
            </div>
            <div
                className={
                    'font-mono text-2xl font-semibold tabular-nums ' +
                    (accent === 'success' ? 'text-success' : accent === 'warning' ? 'text-warning' : '')
                }
            >
                {value}
            </div>
        </div>
    );
}
