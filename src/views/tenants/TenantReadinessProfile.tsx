import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { getReadinessProfile, parseReadinessProfile, type ReadinessProfile } from '@/api/tenantProfile';

export function TenantReadinessProfile({ tenantId, readOnly = false }: { tenantId: string; readOnly?: boolean }): JSX.Element {
    const query = useQuery({ queryKey: ['admin', 'readiness-profile', tenantId], queryFn: () => getReadinessProfile(tenantId) });
    if (query.isLoading) return <p className="p-5 text-sm text-text-muted">Rechnungs- und Vertragsdaten werden geladen…</p>;
    if (!query.data || query.error) return <div className="rounded-lg border border-border bg-surface p-5"><p className="text-sm text-danger">Rechnungs- und Vertragsdaten konnten nicht geladen werden.</p><Button variant="outline" className="mt-3" onClick={() => void query.refetch()}>Erneut laden</Button></div>;
    return <ProfileEditor key={tenantId} initial={query.data} tenantId={tenantId} readOnly={readOnly} />;
}

function ProfileEditor({ initial, tenantId, readOnly }: { initial: ReadinessProfile; tenantId: string; readOnly: boolean }): JSX.Element {
    const qc = useQueryClient();
    const [baseline, setBaseline] = useState(initial);
    const [billing, setBilling] = useState(initial.billing ?? {});
    const [tax, setTax] = useState(initial.tax ?? { small_business: false });
    const [dpaAccepted, setDpaAccepted] = useState(false);
    const dirty = JSON.stringify(billing) !== JSON.stringify(baseline.billing ?? {}) || JSON.stringify(tax) !== JSON.stringify(baseline.tax ?? { small_business: false }) || dpaAccepted;
    const billingPatch = Object.fromEntries(Object.entries(billing).filter(([key, value]) => value !== baseline.billing?.[key as keyof NonNullable<ReadinessProfile['billing']>]).map(([key, value]) => [key, value ?? '']));
    const taxChanged = JSON.stringify(tax) !== JSON.stringify(baseline.tax ?? { small_business: false });
    const taxPatch = Object.fromEntries(Object.entries(tax).filter(([key, value]) => value != null && (!baseline.tax || value !== baseline.tax[key as keyof NonNullable<ReadinessProfile['tax']>])));
    const save = useMutation({ mutationFn: () => apiFetch<unknown>(`/api/admin/tenants/${encodeURIComponent(tenantId)}/readiness-profile`, { method: 'PATCH', body: JSON.stringify({ ...(Object.keys(billingPatch).length ? { billing: billingPatch } : {}), ...(taxChanged ? { tax: taxPatch } : {}), ...(dpaAccepted ? { dpaAccepted: true } : {}) }) }).then(parseReadinessProfile), onSuccess: result => {
        setBaseline(result);
        setBilling(result.billing ?? {});
        setTax(result.tax ?? { small_business: false });
        setDpaAccepted(false);
        qc.setQueryData(['admin', 'readiness-profile', tenantId], result);
        void qc.invalidateQueries({ queryKey: ['admin', 'provisioning', tenantId] });
        void qc.invalidateQueries({ queryKey: ['admin', 'onboarding-pipeline'] });
    } });
    useUnsavedChanges('Rechnungs- und Vertragsdaten', dirty, save.isPending);
    return <form onSubmit={event => { event.preventDefault(); if (!readOnly && dirty && !save.isPending) save.mutate(); }} className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-base font-semibold">Rechnungs- und Vertragsdaten</h2><p className="mt-1 text-sm leading-relaxed text-text-secondary">Ergänze die bestätigten Angaben des Händlers. Änderungen werden protokolliert.</p>
        {readOnly && <p className="mt-3 text-sm text-text-muted">Lesender Zugriff · Änderungen sind für dieses Konto nicht freigegeben.</p>}
        <fieldset disabled={save.isPending || readOnly} className="mt-5 grid gap-4 md:grid-cols-2">
            {([{ key: 'company_name', label: 'Vollständiger Firmenname' }, { key: 'company_address', label: 'Straße und Hausnummer' }, { key: 'company_zip', label: 'Postleitzahl' }, { key: 'company_city', label: 'Ort' }, { key: 'iban', label: 'IBAN' }] as const).map(field => <div key={field.key} className="space-y-2"><Label htmlFor={`billing-${field.key}`}>{field.label}</Label><Input id={`billing-${field.key}`} maxLength={field.key === 'iban' ? 34 : 200} value={billing[field.key] ?? ''} onChange={event => setBilling({ ...billing, [field.key]: event.target.value })} /></div>)}
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="business-type">Unternehmensform</Label><select id="business-type" value={tax.business_type ?? ''} className="h-10 w-full rounded-md border border-input bg-surface px-2 text-sm" onChange={e => setTax({ ...tax, business_type: (e.target.value || null) as 'company' | 'sole_trader' | null })}><option value="">Noch nicht erfasst</option><option value="company">Gesellschaft</option><option value="sole_trader">Einzelunternehmen</option></select></div>
                <div className="space-y-2"><Label htmlFor="tax-method">Versteuerung</Label><select id="tax-method" value={tax.tax_method ?? ''} className="h-10 w-full rounded-md border border-input bg-surface px-2 text-sm" onChange={e => setTax({ ...tax, tax_method: (e.target.value || null) as 'IST' | 'SOLL' | null })}><option value="">Noch nicht erfasst</option><option value="IST">Ist-Versteuerung</option><option value="SOLL">Soll-Versteuerung</option></select></div>
            </div>
            <div className="space-y-2"><Label htmlFor="tax-period">Voranmeldungszeitraum</Label><select id="tax-period" value={tax.period_type ?? ''} className="h-10 w-full rounded-md border border-input bg-surface px-2 text-sm" onChange={e => setTax({ ...tax, period_type: (e.target.value || null) as 'monthly' | 'quarterly' | null })}><option value="">Noch nicht erfasst</option><option value="monthly">Monatlich</option><option value="quarterly">Vierteljährlich</option></select></div>
            <div className="space-y-2"><Label htmlFor="vat-id">Umsatzsteuer-ID</Label><Input id="vat-id" value={tax.vat_id ?? ''} onChange={e => setTax({ ...tax, vat_id: e.target.value })} maxLength={40} /></div>
            <div className="space-y-2"><Label htmlFor="tax-number">Steuernummer</Label><Input id="tax-number" value={tax.tax_number ?? ''} onChange={e => setTax({ ...tax, tax_number: e.target.value })} maxLength={40} /></div>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={tax.small_business ?? false} onChange={e => setTax({ ...tax, small_business: e.target.checked })} />Kleinunternehmerregelung laut Händlerangabe</label>
            {baseline.dpaAcceptedAt ? <p className="rounded-md border border-success/20 bg-success/5 p-3 text-sm text-success">AVV-Annahme dokumentiert am {new Date(baseline.dpaAcceptedAt).toLocaleDateString('de-DE')}{baseline.dpaVersion ? ` · ${baseline.dpaVersion}` : ''}</p> : <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm"><input type="checkbox" className="mt-1" checked={dpaAccepted} onChange={e => setDpaAccepted(e.target.checked)} /><span>Die Annahme der Auftragsverarbeitung durch den Händler liegt nachweislich vor. Ich dokumentiere diese bereits erfolgte Annahme.</span></label>}
            {save.error && <p role="alert" className="text-sm text-danger">{save.error instanceof Error ? save.error.message : 'Speichern fehlgeschlagen.'}</p>}
            <Button type="submit" disabled={!dirty || save.isPending}>{save.isPending ? 'Speichert…' : 'Angaben speichern'}</Button>
        </fieldset>
    </form>;
}
