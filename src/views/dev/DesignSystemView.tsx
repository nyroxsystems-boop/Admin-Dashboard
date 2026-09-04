/**
 * DesignSystemView (P5.1) — Dev-only Showcase (ohne Login) der NEUEN Cockpit-
 * Komponenten als Abnahme-Referenz: Tokens, Buttons, Feedback-Primitives,
 * Order-Status-Badges, OEM-Confidence, E2E-Stufenleiste, Live-Sim-KPIs.
 *
 * Bewusst nur PRÄSENTATION (keine API/kein Auth) — gemountet nur unter
 * import.meta.env.DEV (siehe routes/adminRoutes.tsx).
 */
import { CheckCircle2, Circle, MinusCircle, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SEITEN_RAND } from '@/components/ui/seite';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/feedback/LoadingState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ORDER_STATUSES, orderStatusBadge, orderStatusLabel } from '@/lib/orderStatus';

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
    return (
        <section className="space-y-3 border-b border-border pb-8">
            <h2 className="text-xs font-mono uppercase tracking-widest text-text-secondary">{title}</h2>
            {children}
        </section>
    );
}

const TOKENS = [
    'bg-canvas', 'bg-surface', 'bg-elevated', 'bg-accent-500',
    'bg-status-success', 'bg-status-warning', 'bg-status-danger', 'bg-status-info',
];

const OEM_MOCK = [
    { oem: '1K0615301AA', confidence: 0.94 },
    { oem: '5Q0615301', confidence: 0.71 },
    { oem: 'JZW615301', confidence: 0.42 },
];

const STAGES = [
    { label: 'OCR', status: 'ok' as const },
    { label: 'OEM', status: 'ok' as const },
    { label: 'Preis', status: 'ok' as const },
    { label: 'Angebot', status: 'skipped' as const },
    { label: 'Bestellung', status: 'fail' as const },
    { label: 'Rechnung', status: 'pending' as const },
];

function stageIcon(s: 'ok' | 'fail' | 'skipped' | 'pending'): JSX.Element {
    if (s === 'ok') return <CheckCircle2 className="size-5 text-status-success" />;
    if (s === 'fail') return <XCircle className="size-5 text-status-danger" />;
    if (s === 'skipped') return <MinusCircle className="size-5 text-text-muted" />;
    return <Circle className="size-5 text-text-muted/50" />;
}

export default function DesignSystemView(): JSX.Element {
    return (
        <div className={cn(SEITEN_RAND, 'min-h-screen bg-background')}>
            <div className="mx-auto max-w-4xl space-y-10">
                <header>
                    <h1 className="text-2xl font-display font-semibold tracking-tight">Design-System</h1>
                    <p className="text-sm text-text-secondary">
                        Abnahme-Referenz der Cockpit-Komponenten (dev-only, ohne Login).
                    </p>
                </header>

                <Section title="Farb-Tokens">
                    <div className="flex flex-wrap gap-3">
                        {TOKENS.map((t) => (
                            <div key={t} className="text-center">
                                <div className={`size-14 rounded-md border border-border ${t}`} />
                                <div className="mt-1 font-mono text-[10px] text-text-muted">{t}</div>
                            </div>
                        ))}
                    </div>
                </Section>

                <Section title="Buttons">
                    <div className="flex flex-wrap gap-2">
                        <Button>Default</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="destructive">Destructive</Button>
                    </div>
                </Section>

                <Section title="Order-Status-Badges (P5.4)">
                    <div className="flex flex-wrap gap-2">
                        {ORDER_STATUSES.map((s) => (
                            <span
                                key={s}
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${orderStatusBadge(s)}`}
                            >
                                {orderStatusLabel(s)}
                            </span>
                        ))}
                    </div>
                </Section>

                <Section title="OEM-Confidence (Bot-Test-Lab)">
                    <div className="max-w-sm space-y-1.5">
                        {OEM_MOCK.map((c) => (
                            <div key={c.oem} className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-mono">{c.oem}</span>
                                <span className="flex items-center gap-1.5">
                                    <span className="h-1 w-16 overflow-hidden rounded bg-border">
                                        <span className="block h-full bg-accent-500" style={{ width: `${Math.round(c.confidence * 100)}%` }} />
                                    </span>
                                    <span className="tabular-nums text-text-muted">{Math.round(c.confidence * 100)}%</span>
                                </span>
                            </div>
                        ))}
                    </div>
                </Section>

                <Section title="E2E-Stufenleiste (P3)">
                    <ol className="max-w-md space-y-2">
                        {STAGES.map((st) => (
                            <li key={st.label} className="flex items-center gap-3 rounded-md border border-border bg-surface/40 p-2 text-sm">
                                {stageIcon(st.status)}
                                <span className="flex-1">{st.label}</span>
                                <span className="text-xs font-mono uppercase tracking-widest text-text-muted">{st.status}</span>
                            </li>
                        ))}
                    </ol>
                </Section>

                <Section title="Live-Sim-Kennzahlen (P4)">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {[['Nachrichten', '42'], ['Orders', '7'], ['Ø Antwort', '310ms'], ['Erfolgsquote', '78%']].map(([l, v]) => (
                            <div key={l} className="rounded-md border border-border bg-surface/40 p-3">
                                <div className="text-[10px] uppercase tracking-widest text-text-secondary">{l}</div>
                                <div className="font-mono text-2xl tabular-nums">{v}</div>
                            </div>
                        ))}
                    </div>
                </Section>

                <Section title="Feedback-Primitives">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-md border border-border p-4"><LoadingState label="Lädt…" /></div>
                        <div className="rounded-md border border-border p-4">
                            <EmptyState title="Leer" description="Keine Daten." />
                        </div>
                        <div className="rounded-md border border-border p-4">
                            <ErrorState message="Etwas ging schief." />
                        </div>
                    </div>
                </Section>
            </div>
        </div>
    );
}
