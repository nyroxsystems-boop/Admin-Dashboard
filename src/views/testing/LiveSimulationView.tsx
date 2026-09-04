/**
 * LiveSimulationView (P4) — „Händler-Tag" simulieren: mehrere Personas laufen
 * parallel/zeitversetzt durch die ECHTE Bot-Pipeline, Live-Verlauf über SSE
 * (useSimStream, gefiltert auf runId), Kennzahlen in Echtzeit. Budget/Throttle:
 * maxConcurrent + Demo-Modus (Gemini-Budget 0 = kein echtes Vision/OEM, kein Cost).
 */
import { useMemo, useState } from 'react';
import { Activity, Play, Square } from 'lucide-react';
import { toast } from 'sonner';

import { TenantSelect } from '@/components/TenantSelect';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useRunnerScenarios } from '@/hooks/useE2EFlow';
import { useSimStream, type SimTurnEvent } from '@/hooks/useSimStream';
import { startSimulation, startStressTest, stopSimulation } from '@/api/simulate';
import { cn } from '@/lib/utils';
import { SEITEN_RAND_OHNE_BREITE } from '@/components/ui/seite';

function Kpi({ label, value }: { label: string; value: string | number }): JSX.Element {
    return (
        <div className="rounded-md border border-border bg-surface/40 p-3">
            <div className="text-[10px] uppercase tracking-widest text-text-secondary">{label}</div>
            <div className="font-mono text-2xl tabular-nums">{value}</div>
        </div>
    );
}

export default function LiveSimulationView(): JSX.Element {
    const [merchantId, setMerchantId] = useState<string | null>(null);
    const scenariosQ = useRunnerScenarios();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [maxConcurrent, setMaxConcurrent] = useState(2);
    const [demoStub, setDemoStub] = useState(true);
    const [speed, setSpeed] = useState(800);
    const [count, setCount] = useState(0); // 0 = Fix-Personas; >0 = N synthetische Kunden (Lasttest)
    const [useLocalAi, setUseLocalAi] = useState(false);
    const [runId, setRunId] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);

    // Stresstest (Queue-getrieben, multi-tenant)
    const [mode, setMode] = useState<'sim' | 'stress'>('sim');
    const [tenantsCsv, setTenantsCsv] = useState('');
    const [perTenant, setPerTenant] = useState(100);
    const [stressConcurrency, setStressConcurrency] = useState(50);
    const [thinkTimeMs, setThinkTimeMs] = useState(300);

    const { turns, metrics, done, connected } = useSimStream(runId);

    const allIds = useMemo(() => (scenariosQ.data ?? []).map((s) => s.id), [scenariosQ.data]);
    const isChecked = (id: string): boolean => (selected.size > 0 ? selected.has(id) : true);
    const personaIds = selected.size > 0 ? Array.from(selected) : allIds;

    function toggle(id: string): void {
        setSelected((prev) => {
            const base = prev.size > 0 ? new Set(prev) : new Set(allIds);
            if (base.has(id)) base.delete(id);
            else base.add(id);
            return base;
        });
    }

    // Bei lokaler KI ist der Demo-Modus (Gemini-Budget 0) bedeutungslos — die
    // Local-Weiche umgeht das Budget ohnehin. Dann real gegen die eigene KI fahren.
    const effectiveDemoStub = useLocalAi ? false : demoStub;

    async function start(): Promise<void> {
        setStarting(true);
        try {
            const res = await startSimulation({
                ...(merchantId ? { merchantId } : {}),
                ...(count > 0 ? { count } : { personaIds }),
                maxConcurrent,
                demoStubMode: effectiveDemoStub,
                speed,
                useLocalAi,
            });
            setRunId(res.runId);
            const aiNote = res.useLocalAi
                ? res.aiHealth?.ok
                    ? ', lokale KI'
                    : ', lokale KI ⚠ nicht erreichbar'
                : res.demoStub
                  ? ', Demo-Modus'
                  : '';
            toast.success(`Simulation gestartet (${res.personas} Personas${aiNote}).`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Start fehlgeschlagen.');
        } finally {
            setStarting(false);
        }
    }

    const tenantIds = tenantsCsv.split(',').map((s) => s.trim()).filter(Boolean);
    const stressTotal = (tenantIds.length || (merchantId ? 1 : 0)) * perTenant;

    async function startStress(): Promise<void> {
        setStarting(true);
        try {
            const merchantIds = tenantIds.length ? tenantIds : merchantId ? [merchantId] : [];
            const res = await startStressTest({
                merchantIds,
                perTenant,
                maxConcurrent: stressConcurrency,
                thinkTimeMs,
                useLocalAi,
            });
            setRunId(res.runId);
            const aiNote = res.useLocalAi ? (res.aiHealth?.ok ? ', lokale KI' : ', lokale KI ⚠ nicht erreichbar') : '';
            toast.success(`Stresstest gestartet: ${res.total} Gespräche über ${res.tenants} Mandanten${aiNote}.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Start fehlgeschlagen.');
        } finally {
            setStarting(false);
        }
    }

    async function stop(): Promise<void> {
        if (!runId) return;
        try {
            await stopSimulation(runId);
            toast.success('Stop angefordert — läuft am nächsten Turn aus.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Stop fehlgeschlagen.');
        }
    }

    const columns = useMemo(() => {
        const m = new Map<string, SimTurnEvent[]>();
        for (const t of turns) {
            const arr = m.get(t.personaId) ?? [];
            arr.push(t);
            m.set(t.personaId, arr);
        }
        return Array.from(m.entries());
    }, [turns]);

    const isRunning = Boolean(runId) && !done;

    return (
        <div className={cn(SEITEN_RAND_OHNE_BREITE, 'mx-auto max-w-content')}>
            <header className="mb-6 flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-display font-semibold tracking-tight">Live-Simulation</h1>
                    <p className="text-sm text-text-secondary">
                        Händler-Tag gegen die echte Bot-Pipeline — Live-Verlauf + Kennzahlen.
                    </p>
                </div>
                {runId && (
                    <span
                        className={`flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest ${connected ? 'text-status-success' : 'text-text-muted'}`}
                    >
                        <Activity className="size-3.5" />
                        {connected ? 'live' : 'offline'}
                    </span>
                )}
            </header>

            {/* Steuerung */}
            <section className="mb-6 space-y-4 rounded-md border border-border bg-surface/40 p-4">
                {/* Modus: In-Process-Sim vs. Queue-getriebener Stresstest */}
                <div className="flex flex-wrap gap-2">
                    {(['sim', 'stress'] as const).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setMode(m)}
                            disabled={isRunning}
                            className={`rounded-md border px-3 py-1.5 text-xs ${
                                mode === m ? 'border-accent-500 bg-accent-500/12 text-accent-500' : 'border-border text-text-muted'
                            }`}
                        >
                            {m === 'sim' ? 'Live-Sim (in-process)' : 'Stresstest (Queue · multi-tenant)'}
                        </button>
                    ))}
                </div>

                {mode === 'sim' && (
                <>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Als Händler</Label>
                        <TenantSelect value={merchantId} onChange={setMerchantId} placeholder="Händler wählen (sonst Default)…" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="ls-conc">Parallel</Label>
                            <Input
                                id="ls-conc"
                                type="number"
                                min={1}
                                max={100}
                                value={maxConcurrent}
                                onChange={(e) => setMaxConcurrent(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                                disabled={isRunning}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ls-speed">Tempo (ms)</Label>
                            <Input
                                id="ls-speed"
                                type="number"
                                min={0}
                                max={5000}
                                step={100}
                                value={speed}
                                onChange={(e) => setSpeed(Math.max(0, Math.min(5000, Number(e.target.value) || 0)))}
                                disabled={isRunning}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Demo-Modus</Label>
                            <label className="flex h-10 items-center gap-2 text-xs">
                                <input
                                    type="checkbox"
                                    checked={effectiveDemoStub}
                                    onChange={(e) => setDemoStub(e.target.checked)}
                                    disabled={isRunning || useLocalAi}
                                    className="size-4 rounded border-border"
                                />
                                kein echtes AI
                            </label>
                        </div>
                    </div>
                </div>

                {/* Lasttest: synthetische Kunden + lokale KI */}
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="ls-count">Anzahl Kunden</Label>
                            <Input
                                id="ls-count"
                                type="number"
                                min={0}
                                max={1000}
                                step={10}
                                value={count}
                                onChange={(e) => setCount(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
                                disabled={isRunning}
                                placeholder="0 = Fix-Personas"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Lokale KI</Label>
                            <label className="flex h-10 items-center gap-2 text-xs">
                                <input
                                    type="checkbox"
                                    checked={useLocalAi}
                                    onChange={(e) => setUseLocalAi(e.target.checked)}
                                    disabled={isRunning}
                                    className="size-4 rounded border-border"
                                />
                                Qwen statt Gemini
                            </label>
                        </div>
                    </div>
                    <p className="self-end text-xs text-text-muted">
                        {count > 0
                            ? `Lasttest: ${count} synthetische Kunden (Fahrzeug-/Teile-Mix) durch die echte Pipeline.`
                            : 'Anzahl > 0 erzeugt synthetische Kunden für den Lasttest (sonst die Fix-Personas unten).'}
                    </p>
                </div>

                <div className="space-y-2">
                    <Label>Personas</Label>
                    <div className="flex flex-wrap gap-2">
                        {(scenariosQ.data ?? []).map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => toggle(s.id)}
                                disabled={isRunning}
                                className={`rounded-full border px-3 py-1 text-xs ${
                                    isChecked(s.id)
                                        ? 'border-accent-500 bg-accent-500/12 text-accent-500'
                                        : 'border-border text-text-muted'
                                }`}
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                    {demoStub && (
                        <p className="text-xs text-text-muted">
                            Demo-Modus: läuft mit Gemini-Budget 0 — testet das Plumbing ohne echte
                            Vision/OEM-Calls und ohne Kosten.
                        </p>
                    )}
                </div>
                </>
                )}

                {mode === 'stress' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="st-tenants">Mandanten-IDs (kommagetrennt)</Label>
                            <Input
                                id="st-tenants"
                                value={tenantsCsv}
                                onChange={(e) => setTenantsCsv(e.target.value)}
                                disabled={isRunning}
                                placeholder="z.B. haendler-a, haendler-b, haendler-c  (leer = oben gewählter)"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="space-y-2">
                                <Label htmlFor="st-per">Kunden / Mandant</Label>
                                <Input id="st-per" type="number" min={1} max={1000} value={perTenant}
                                    onChange={(e) => setPerTenant(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} disabled={isRunning} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="st-conc">Gleichzeitig aktiv</Label>
                                <Input id="st-conc" type="number" min={1} max={500} value={stressConcurrency}
                                    onChange={(e) => setStressConcurrency(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} disabled={isRunning} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="st-think">Think-Time (ms)</Label>
                                <Input id="st-think" type="number" min={0} max={10000} step={100} value={thinkTimeMs}
                                    onChange={(e) => setThinkTimeMs(Math.max(0, Math.min(10000, Number(e.target.value) || 0)))} disabled={isRunning} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Lokale KI</Label>
                                <label className="flex h-10 items-center gap-2 text-xs">
                                    <input type="checkbox" checked={useLocalAi} onChange={(e) => setUseLocalAi(e.target.checked)}
                                        disabled={isRunning} className="size-4 rounded border-border" />
                                    Qwen statt Gemini
                                </label>
                            </div>
                        </div>
                        <p className="text-xs text-text-muted">
                            Treibt die ECHTE Queue (BullMQ → Worker) — testet Worker-Concurrency, Redis,
                            Idempotenz, Retries, DB-Pool. <span className="font-mono">{(tenantIds.length || (merchantId ? 1 : 0))} Mandanten × {perTenant} = {stressTotal} Gespräche</span>.
                            Braucht Redis + gesetztes <span className="font-mono">LOCAL_AI_*</span> bei „Lokale KI".
                        </p>
                    </div>
                )}

                <div className="flex gap-2">
                    {!isRunning ? (
                        mode === 'stress' ? (
                            <Button onClick={() => void startStress()} disabled={starting || stressTotal === 0}>
                                <Play className="size-4" /> {starting ? 'Starte…' : `Stresstest starten (${stressTotal})`}
                            </Button>
                        ) : (
                            <Button onClick={() => void start()} disabled={starting || (count === 0 && personaIds.length === 0)}>
                                <Play className="size-4" /> {starting ? 'Starte…' : count > 0 ? `${count} Kunden starten` : 'Tag starten'}
                            </Button>
                        )
                    ) : (
                        <Button variant="outline" onClick={() => void stop()}>
                            <Square className="size-4" /> Stoppen
                        </Button>
                    )}
                    {runId && done && (
                        <span className="self-center text-xs font-mono text-text-muted">
                            Lauf {done.status}
                        </span>
                    )}
                </div>
            </section>

            {/* Kennzahlen */}
            {runId && (
                <section className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Kpi label="Nachrichten" value={metrics?.messages ?? 0} />
                    <Kpi label="Orders" value={metrics?.orders ?? 0} />
                    <Kpi label="Ø Antwort" value={`${metrics?.avgResponseMs ?? 0}ms`} />
                    <Kpi label="Erfolgsquote" value={`${metrics?.successRate ?? 0}%`} />
                    <Kpi label="Personas" value={`${metrics?.personasDone ?? 0}/${metrics?.personasTotal ?? personaIds.length}`} />
                </section>
            )}

            {/* Last-/KI-Kennzahlen — beantworten „verträgt die (lokale) KI 100 Kunden?" */}
            {runId && (metrics?.throughputMsgPerSec != null || metrics?.aiCalls != null) && (
                <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Kpi label="Durchsatz" value={`${metrics?.throughputMsgPerSec ?? 0}/s`} />
                    <Kpi label="p95 Antwort" value={`${metrics?.p95ResponseMs ?? 0}ms`} />
                    <Kpi label="KI-Calls" value={metrics?.aiCalls ?? 0} />
                    <Kpi label="KI p95" value={`${metrics?.aiP95Ms ?? 0}ms`} />
                    <Kpi label="KI max parallel" value={metrics?.aiMaxConcurrent ?? 0} />
                </section>
            )}

            {/* Queue-Tiefe (Stresstest) — Backpressure: wächst „Wartend", hängen die Worker hinterher */}
            {runId && metrics?.queueWaiting != null && (
                <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Kpi label="Queue wartend" value={metrics?.queueWaiting ?? 0} />
                    <Kpi label="Queue aktiv" value={metrics?.queueActive ?? 0} />
                    <Kpi label="Queue verzögert" value={metrics?.queueDelayed ?? 0} />
                    <Kpi label="Queue Fehler" value={metrics?.queueFailed ?? 0} />
                    <Kpi label="Queue fertig" value={metrics?.queueCompleted ?? 0} />
                </section>
            )}

            {/* Live-Konversations-Spalten */}
            {!runId ? (
                <EmptyState
                    icon={Activity}
                    title="Noch kein Lauf"
                    description="Personas wählen, dann den Tag starten — der Verlauf erscheint hier live."
                />
            ) : columns.length === 0 ? (
                <p className="text-sm text-text-muted">Warte auf erste Nachrichten…</p>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {columns.length > 30 && (
                        <p className="col-span-full text-xs text-text-muted">
                            {columns.length} Personas aktiv — zeige die ersten 30 (Kennzahlen oben aggregieren alle).
                        </p>
                    )}
                    {columns.slice(0, 30).map(([personaId, ts]) => (
                        <div key={personaId} className="rounded-md border border-border bg-surface/40 p-3">
                            <div className="mb-2 flex items-center justify-between text-xs">
                                <span className="font-mono text-text-secondary">{personaId}</span>
                                <span className="text-text-muted">{ts.length} Turns</span>
                            </div>
                            <div className="space-y-1.5 max-h-72 overflow-y-auto">
                                {ts.map((t, i) => (
                                    <div key={i} className="text-xs">
                                        {t.request && <div className="text-text-secondary">→ {t.request}</div>}
                                        {t.error ? (
                                            <div className="text-status-danger">✗ {t.error}</div>
                                        ) : (
                                            t.reply && (
                                                <div className="rounded bg-elevated/50 px-2 py-1 text-text-primary">
                                                    ← {t.reply.slice(0, 240)}
                                                </div>
                                            )
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
