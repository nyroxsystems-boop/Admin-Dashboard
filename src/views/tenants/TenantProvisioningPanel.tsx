import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, AlertTriangle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getProvisioningCase, saveProvisioningCase, type ProvisioningCase, type ProvisioningStage } from '@/api/onboarding';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { parseError } from '@/utils/error/parseError';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { TenantReadinessProfile } from './TenantReadinessProfile';
import { TenantProvisioningHistory } from './TenantProvisioningHistory';

const STAGES: { value: ProvisioningStage; label: string }[] = [
    { value: 'draft', label: 'Entwurf' }, { value: 'provisioning', label: 'Einrichtung' },
    { value: 'integration', label: 'Integrationen' }, { value: 'review', label: 'Freigabeprüfung' },
    { value: 'live', label: 'Go-live freigegeben' },
];
const CHECKS = [
    { key: 'contract', title: 'Vertrag und Tarif geprüft', description: 'Leistungsumfang, Konditionen und Ansprechpartner sind dokumentiert.' },
    { key: 'dataImport', title: 'Stammdaten und Import geprüft', description: 'Produkte, Bestand und Firmendaten wurden geprüft oder als nicht erforderlich dokumentiert.' },
    { key: 'training', title: 'Einweisung abgeschlossen', description: 'Der Händler kennt Bestellablauf, Nutzerverwaltung und Supportwege.' },
    { key: 'handover', title: 'Übergabe dokumentiert', description: 'Testauftrag, offene Punkte und zuständige Betreuung sind festgehalten.' },
];

export function TenantProvisioning({ tenantId }: { tenantId: string }): JSX.Element {
    const query = useQuery({ queryKey: ['admin', 'provisioning', tenantId], queryFn: () => getProvisioningCase(tenantId) });
    if (query.isLoading) return <LoadingState label="Einrichtung wird geladen…" />;
    if (query.error || !query.data) return <ErrorState title="Einrichtung nicht verfügbar" message="Der aktuelle Bearbeitungsstand konnte nicht geladen werden." detail={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />;
    return <ProvisioningEditor key={tenantId} tenantId={tenantId} initial={query.data} reload={async () => {
        const result = await query.refetch();
        if (!result.data || result.error) throw result.error ?? new Error('Der aktuelle Stand konnte nicht geladen werden.');
        return result.data;
    }} />;
}

function ProvisioningEditor({ tenantId, initial, reload }: { tenantId: string; initial: ProvisioningCase; reload: () => Promise<ProvisioningCase> }): JSX.Element {
    const qc = useQueryClient();
    const [baseline, setBaseline] = useState(initial);
    const [draft, setDraft] = useState(initial);
    const [saved, setSaved] = useState(false);
    const [reloadError, setReloadError] = useState<string | null>(null);
    const mutation = useMutation({
        mutationFn: () => saveProvisioningCase(tenantId, {
            ownerName: draft.ownerName?.trim() || null, dueAt: draft.dueAt,
            stage: draft.stage, checks: draft.checks, notes: draft.notes, version: baseline.version,
        }),
        onSuccess: result => {
            setSaved(true);
            setBaseline(result);
            setDraft(result);
            qc.setQueryData(['admin', 'provisioning', tenantId], result);
            void qc.invalidateQueries({ queryKey: ['admin', 'onboarding-pipeline'] });
        },
    });
    const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
    useUnsavedChanges('Händler-Einrichtung', dirty, mutation.isPending);
    const completed = CHECKS.filter(check => draft.checks[check.key]).length;
    const stageIndex = Math.max(0, STAGES.findIndex(stage => stage.value === draft.stage));
    const error = mutation.error ? parseError(mutation.error) : null;
    async function loadCurrent(): Promise<void> {
        setReloadError(null);
        try {
            const result = await reload();
            setBaseline(result);
            setDraft(result);
            setSaved(false);
            mutation.reset();
        } catch (cause) {
            setReloadError(cause instanceof Error ? cause.message : 'Laden fehlgeschlagen.');
        }
    }
    return (
        <div className="mb-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
            <form onSubmit={event => { event.preventDefault(); mutation.mutate(); }} className="rounded-lg border border-border bg-surface">
                <div className="border-b border-border px-5 py-4"><h2 className="text-base font-semibold">Einrichtung steuern</h2><p className="mt-1 text-sm text-text-secondary">Verantwortung, Nachweise und Go-live-Freigabe.</p></div>
                <fieldset disabled={mutation.isPending} className="space-y-5 p-5">
                    {initial.version !== baseline.version && <div role="status" className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">Ein neuerer Serverstand ist verfügbar. Deine noch nicht gespeicherten Eingaben bleiben erhalten.<Button type="button" variant="outline" className="mt-3" onClick={() => void loadCurrent()}>Eingaben verwerfen und aktuellen Stand laden</Button></div>}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2"><Label htmlFor="provision-owner">Verantwortlich</Label><Input id="provision-owner" maxLength={160} value={draft.ownerName ?? ''} onChange={e => setDraft({ ...draft, ownerName: e.target.value })} placeholder="Vor- und Nachname" required={draft.stage !== 'draft'} /></div>
                        <div className="space-y-2"><Label htmlFor="provision-due">Geplante Übergabe</Label><Input id="provision-due" type="date" value={draft.dueAt?.slice(0, 10) ?? ''} onChange={e => setDraft({ ...draft, dueAt: e.target.value ? `${e.target.value}T12:00:00.000Z` : null })} required={draft.stage !== 'draft'} /></div>
                    </div>
                    <section aria-label="Fortschritt der Händler-Einrichtung" className="rounded-xl border border-border-subtle bg-canvas/50 p-3"><ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">{STAGES.map((stage, index) => <li key={stage.value} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs ${index === stageIndex ? 'bg-accent-500/10 font-semibold text-accent-500 ring-1 ring-accent-500/30' : index < stageIndex ? 'text-success' : 'text-text-muted'}`}><span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${index <= stageIndex ? 'bg-accent-500 text-auf-ton' : 'bg-elevated text-text-muted'}`}>{index < stageIndex ? <CheckCircle2 className="size-3" /> : index + 1}</span><span className="min-w-0 break-words">{stage.label}</span></li>)}</ol></section>
                    <div className="space-y-2"><Label htmlFor="provision-stage">Bearbeitungsphase</Label><select id="provision-stage" className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm" value={draft.stage} onChange={e => setDraft({ ...draft, stage: e.target.value as ProvisioningStage })}>{STAGES.map(stage => <option key={stage.value} value={stage.value}>{stage.label}</option>)}</select><p className="text-xs text-text-muted">Phasenwechsel werden erst mit „Stand speichern“ wirksam und serverseitig geprüft.</p></div>
                    <div><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold">Abnahmecheckliste · {completed}/{CHECKS.length}</p><p className="mt-1 text-xs text-text-muted">Dokumentierte fachliche und technische Übergabe</p></div><span className="text-sm font-semibold tabular-nums text-accent-500">{Math.round(completed / CHECKS.length * 100)}%</span></div><div className="mb-3 h-1.5 overflow-hidden rounded-full bg-elevated"><span className="block h-full rounded-full bg-accent-500 transition-[width]" style={{ width: `${completed / CHECKS.length * 100}%` }} /></div><div className="divide-y divide-border rounded-xl border border-border">{CHECKS.map(check => <label key={check.key} className="flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-elevated/40"><input type="checkbox" className="mt-1 size-4 accent-accent-500" checked={draft.checks[check.key] ?? false} onChange={e => setDraft({ ...draft, checks: { ...draft.checks, [check.key]: e.target.checked } })} /><span><span className="block text-sm font-medium">{check.title}</span><span className="mt-1 block text-xs leading-relaxed text-text-muted">{check.description}</span></span></label>)}</div></div>
                    <div className="space-y-2"><Label htmlFor="provision-notes">Übergabenotizen und offene Punkte</Label><textarea id="provision-notes" rows={5} maxLength={12000} className="w-full rounded-md border border-input bg-surface p-3 text-sm" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Nachweise, Links zu Dokumenten und nächste Schritte…" /></div>
                    {error && <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error.message}{error.status === 409 && <Button type="button" variant="outline" className="mt-3" onClick={() => void loadCurrent()}>Eingaben verwerfen und aktuellen Stand laden</Button>}</div>}
                    {reloadError && <p role="alert" className="text-sm text-danger">{reloadError}</p>}
                    {saved && !dirty && <p role="status" className="text-sm text-success">Bearbeitungsstand gespeichert.</p>}
                    <div className="flex items-center justify-between gap-3"><p className="text-xs text-text-muted">{baseline.updatedAt ? `Zuletzt gespeichert: ${new Date(baseline.updatedAt).toLocaleString('de-DE')}` : 'Noch kein Bearbeitungsstand gespeichert'}</p><Button type="submit" disabled={!dirty || mutation.isPending}><Save size={15} className="mr-2" />{mutation.isPending ? 'Speichert…' : 'Stand speichern'}</Button></div>
                </fieldset>
            </form>
            <aside className="space-y-5">
                <div className="rounded-xl border border-border bg-surface p-5 shadow-sm"><h2 className="flex items-center gap-2 text-base font-semibold">{baseline.readiness.ready ? <CheckCircle2 size={18} className="text-success" /> : <AlertTriangle size={18} className="text-warning" />}Freigabereife</h2><p className="mt-2 text-sm leading-relaxed text-text-secondary">Die Voraussetzungen werden beim Speichern serverseitig geprüft. Für Prüfung und Go-live müssen alle Nachweise vollständig sein.</p>
                    {baseline.readiness.blockers.length ? <ul className="mt-4 space-y-3">{baseline.readiness.blockers.map((blocker, index) => <li key={`${index}:${blocker}`} className="flex items-start gap-2 text-sm text-text-secondary"><Circle size={14} className="mt-1 shrink-0 text-warning" />{blocker}</li>)}</ul> : <p className="mt-4 text-sm text-success">Alle technischen und fachlichen Voraussetzungen sind erfüllt.</p>}
                </div>
                <div className="rounded-lg border border-border bg-surface p-5"><h2 className="text-sm font-semibold">Gespeicherter Stand</h2><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><dt className="text-text-muted">Phase</dt><dd>{STAGES.find(stage => stage.value === baseline.stage)?.label}</dd><dt className="text-text-muted">Verantwortlich</dt><dd>{baseline.ownerName || 'Noch nicht zugeteilt'}</dd><dt className="text-text-muted">Version</dt><dd className="tabular-nums">{baseline.version}</dd></dl>{dirty && <p className="mt-3 text-xs text-warning">Die Eingaben im Formular sind noch nicht gespeichert.</p>}</div>
                <details className="rounded-lg border border-border bg-surface p-4"><summary className="cursor-pointer text-sm font-semibold">Rechnungs- und Vertragsdaten bearbeiten</summary><div className="mt-4"><TenantReadinessProfile tenantId={tenantId} /></div></details>
                <TenantProvisioningHistory tenantId={tenantId} version={baseline.version} />
            </aside>
        </div>
    );
}
