/**
 * BatchTestView — paste a list of OEM/VIN numbers, run batch lookup, see live progress.
 */
import { useState } from 'react';

import { useOemBatch } from '@/hooks/useOemBatch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LoadingState } from '@/components/feedback/LoadingState';

export default function BatchTestView(): JSX.Element {
    const { progress, items, runBatch, cancel, reset } = useOemBatch();
    const [input, setInput] = useState('');

    const lines = input
        .split(/[\n,;]/)
        .map((l) => l.trim())
        .filter(Boolean);

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">OEM Batch Test</h1>
                <p className="text-sm text-text-secondary">
                    Mehrere OEM-Nummern auf einmal testen — eine pro Zeile, Komma oder Semikolon.
                </p>
            </header>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <Textarea
                        rows={10}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="OEM-1001\nOEM-1002\nOEM-1003"
                    />
                    <div className="text-xs text-text-muted">{lines.length} Einträge</div>
                    <div className="flex gap-2">
                        <Button
                            disabled={progress.isRunning || lines.length === 0}
                            onClick={() => void runBatch({ items: lines })}
                        >
                            {progress.isRunning ? 'Läuft…' : 'Batch starten'}
                        </Button>
                        {progress.isRunning && (
                            <Button variant="outline" onClick={cancel}>
                                Abbrechen
                            </Button>
                        )}
                        <Button variant="ghost" onClick={reset}>
                            Reset
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="rounded-md border border-border bg-surface/40 p-4">
                        <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-3">
                            Fortschritt
                        </h3>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                            <div>
                                <div className="text-xs text-text-muted">Total</div>
                                <div className="font-mono text-lg">{progress.total}</div>
                            </div>
                            <div>
                                <div className="text-xs text-text-muted">OK</div>
                                <div className="font-mono text-lg text-success">{progress.succeeded}</div>
                            </div>
                            <div>
                                <div className="text-xs text-text-muted">Fehler</div>
                                <div className="font-mono text-lg text-danger">{progress.failed}</div>
                            </div>
                        </div>
                        {progress.total > 0 && (
                            <div className="mt-3 h-1.5 w-full bg-elevated rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-accent-500 transition-all"
                                    style={{
                                        width: `${(progress.processed / progress.total) * 100}%`,
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {progress.isRunning && <LoadingState label="Verarbeite…" />}

                    {items.length > 0 && (
                        <ul className="space-y-1 max-h-64 overflow-y-auto rounded-md border border-border p-2 text-xs font-mono">
                            {items.map((it, idx) => (
                                <li key={`${it.oem}-${idx}`} className="flex justify-between">
                                    <span>{it.oem}</span>
                                    <span
                                        className={
                                            it.status === 'ok'
                                                ? 'text-text-muted'
                                                : 'text-danger'
                                        }
                                    >
                                        {it.status === 'ok' && it.result
                                            ? `${(it.result.aiResult.confidence * 100).toFixed(0)}%`
                                            : it.error ?? 'error'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
