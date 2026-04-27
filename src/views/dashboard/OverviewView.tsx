/**
 * OverviewView — Admin Dashboard home.
 *
 * Stats-Cards (Animated-Counter via framer-motion useMotionValue),
 * 7-day trend charts (simple SVG sparklines), Activity-Feed (right rail),
 * System-Health-Widget on top.
 */
import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Activity, Building2, ShoppingCart, TrendingUp, Users } from 'lucide-react';

import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { formatCurrency, formatNumber } from '@/utils/format/number';
import { formatRelative } from '@/utils/format/date';

function AnimatedCounter({ value, format }: { value: number; format?: (n: number) => string }): JSX.Element {
    const mv = useMotionValue(0);
    const rounded = useTransform(mv, (latest) => (format ? format(latest) : Math.round(latest).toString()));
    useEffect(() => {
        const controls = animate(mv, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
        return () => controls.stop();
    }, [mv, value]);
    return <motion.span className="font-mono tabular-nums">{rounded}</motion.span>;
}

function Sparkline({ data, color = 'var(--accent-500, #1D6FE8)' }: { data: number[]; color?: string }): JSX.Element {
    if (data.length === 0) return <svg className="w-full h-12" />;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const w = 200;
    const h = 48;
    const step = w / Math.max(data.length - 1, 1);
    const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" aria-hidden="true">
            <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
        </svg>
    );
}

function HealthDot({ status }: { status: 'ok' | 'degraded' | 'down' }): JSX.Element {
    const color = status === 'ok' ? '#4ADE80' : status === 'degraded' ? '#F5A524' : '#F87171';
    return (
        <span
            className="inline-block size-1.5 rounded-full"
            style={{ background: color, boxShadow: `0 0 6px ${color}` }}
            aria-label={status}
        />
    );
}

export default function OverviewView(): JSX.Element {
    const { metrics, isLoading, error, refetch } = useDashboardMetrics();
    const { health } = useSystemHealth();
    const { entries: audit } = useAuditLogs();

    if (isLoading && !metrics) return <LoadingState label="Lade Metriken…" />;
    if (error && !metrics) return <ErrorState message="Metriken konnten nicht geladen werden." onRetry={refetch} />;
    if (!metrics) return <LoadingState label="Lade Metriken…" />;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <header className="flex items-end justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-display font-semibold tracking-tight">Overview</h1>
                    <p className="text-sm text-text-secondary">System-Status auf einen Blick.</p>
                </div>
                {health && (
                    <div
                        className="hidden md:flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-elevated/40"
                        aria-label="System Health"
                    >
                        <span className="flex items-center gap-1.5 text-xs">
                            <HealthDot status={health.redis} /> Redis
                        </span>
                        <span className="flex items-center gap-1.5 text-xs">
                            <HealthDot status={health.db} /> DB
                        </span>
                        <span className="flex items-center gap-1.5 text-xs">
                            <HealthDot status={health.botApi} /> Bot
                        </span>
                    </div>
                )}
            </header>

            <div className="grid lg:grid-cols-[1fr_320px] gap-6">
                <section className="space-y-6">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KpiCard
                            icon={<Building2 className="size-4" />}
                            label="Aktive Tenants"
                            value={metrics.activeTenants}
                            delay={0}
                        />
                        <KpiCard
                            icon={<Users className="size-4" />}
                            label="User gesamt"
                            value={metrics.totalUsers}
                            delay={1}
                        />
                        <KpiCard
                            icon={<ShoppingCart className="size-4" />}
                            label="Orders heute"
                            value={metrics.ordersToday}
                            delay={2}
                        />
                        <KpiCard
                            icon={<TrendingUp className="size-4" />}
                            label="Umsatz MTD"
                            value={metrics.revenueMtd}
                            format={(n) => formatCurrency(n)}
                            delay={3}
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="rounded-md border border-border bg-surface/40 p-4">
                            <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-2">
                                Orders 7 Tage
                            </h3>
                            <Sparkline data={metrics.seriesOrders7d} />
                        </div>
                        <div className="rounded-md border border-border bg-surface/40 p-4">
                            <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-2">
                                Umsatz 7 Tage
                            </h3>
                            <Sparkline data={metrics.seriesRevenue7d} />
                        </div>
                    </div>
                </section>

                <aside className="rounded-md border border-border bg-surface/40 p-4" aria-label="Activity Feed">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-3 flex items-center gap-2">
                        <Activity className="size-3" /> Activity
                    </h3>
                    <ul className="space-y-3 text-sm">
                        {audit.slice(0, 8).map((e) => {
                            const ts = e.created_at ?? e.timestamp ?? '';
                            return (
                                <li key={e.id} className="flex items-start gap-2">
                                    <span
                                        className="size-1.5 rounded-full bg-accent-500 mt-1.5"
                                        aria-hidden="true"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate">
                                            <span className="font-medium">{e.admin_user ?? '—'}</span>{' '}
                                            <span className="text-text-secondary">
                                                {e.action ?? e.action_type ?? ''}
                                            </span>
                                        </div>
                                        <div className="text-xs text-text-muted">
                                            {ts ? formatRelative(ts) : '—'}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                        {audit.length === 0 && <li className="text-xs text-text-muted">Keine Aktivität.</li>}
                    </ul>
                </aside>
            </div>
        </div>
    );
}

function KpiCard({
    icon,
    label,
    value,
    delay = 0,
    format,
}: {
    icon: JSX.Element;
    label: string;
    value: number;
    delay?: number;
    format?: (n: number) => string;
}): JSX.Element {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: delay * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-md border border-border bg-surface/40 p-4"
        >
            <div className="flex items-center justify-between text-text-secondary mb-3">
                <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
                <span className="text-text-muted">{icon}</span>
            </div>
            <div className="text-2xl font-display font-semibold tracking-tight">
                <AnimatedCounter value={value} format={format ?? ((n) => formatNumber(Math.round(n)))} />
            </div>
        </motion.div>
    );
}
