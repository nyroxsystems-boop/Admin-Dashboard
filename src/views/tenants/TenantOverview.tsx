import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Copy, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import type { Tenant, TenantDetail } from '@/api/types';
import { getReadinessProfile } from '@/api/tenantProfile';
import { getProvisioningCase } from '@/api/onboarding';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/utils/clipboard';
import { presentTenantPaymentStatus } from './tenantStatus';
import { setupLabel } from './tenantDirectory';

const date = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('de-DE') : 'Nicht erfasst';

function Field({ label, children }: { label: string; children: ReactNode }) {
    return <div className="grid gap-1 border-b border-border-subtle py-3 last:border-0 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-5"><dt className="text-sm text-text-muted">{label}</dt><dd className="min-w-0 whitespace-pre-line break-words text-sm text-text-primary">{children || <span className="text-text-muted">Nicht hinterlegt</span>}</dd></div>;
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
    return <section className="min-w-0 rounded-lg border border-border bg-surface"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4"><div><h2 className="text-sm font-semibold">{title}</h2>{subtitle && <p className="mt-1 text-xs text-text-muted">{subtitle}</p>}</div>{action}</header><div className="px-5 py-2">{children}</div></section>;
}

function CopyValue({ value, label }: { value: string; label: string }) {
    return <button type="button" className="inline-flex max-w-full items-center gap-2 text-left hover:text-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500" aria-label={`${label} kopieren`} onClick={async () => {
        if (await copyToClipboard(value)) toast.success(`${label} kopiert.`); else toast.error('Kopieren nicht möglich. Bitte den Text manuell markieren.');
    }}><span className="min-w-0 break-all">{value}</span><Copy size={13} className="shrink-0 text-text-muted" /></button>;
}

export function TenantOverview({ tenant, detail, detailLoading, detailError, retryDetail, onSection }: {
    tenant: Tenant; detail?: TenantDetail; detailLoading: boolean; detailError: boolean; retryDetail: () => void; onSection: (section: string) => void;
}) {
    const profileQ = useQuery({ queryKey: ['admin', 'readiness-profile', tenant.id], queryFn: () => getReadinessProfile(tenant.id), staleTime: 30_000 });
    const caseQ = useQuery({ queryKey: ['admin', 'provisioning', tenant.id], queryFn: () => getProvisioningCase(tenant.id), staleTime: 30_000 });
    const profile = profileQ.data;
    // An active staff user is not automatically the customer's owner/contact.
    const owner = detail?.users.find(user => ['merchant', 'owner'].includes(user.role.toLowerCase()));
    const payment = presentTenantPaymentStatus(tenant.payment_status);
    const action = (label: string, section: string) => <Button variant="ghost" size="sm" onClick={() => onSection(section)}>{label}<ArrowUpRight size={14} className="ml-1" /></Button>;
    const contactState = detailLoading ? 'Kontaktdaten werden geladen…' : detailError ? 'Kontaktdaten nicht verfügbar.' : null;
    return <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]" aria-label="Kundenakte">
        <div className="min-w-0 space-y-5">
            <Panel title="Firma & Kontakt" subtitle="Firmenidentität und hinterlegter Kontoinhaber" action={action('Firmendaten öffnen', 'profile')}>
                <div className="flex items-center gap-3 border-b border-border-subtle py-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-canvas text-text-secondary"><Building2 size={20} /></span><div className="min-w-0"><p className="break-words text-base font-semibold">{tenant.name}</p><p className="mt-1 text-xs text-text-muted">{tenant.is_demo ? 'Demozugang' : 'Händlerkonto'} · {tenant.slug}</p></div></div>
                {profileQ.isLoading ? <p role="status" className="py-4 text-sm text-text-muted">Firmendaten werden geladen…</p> : profileQ.isError ? <div role="alert" className="py-4 text-sm"><p>Firmendaten konnten nicht geladen werden.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => void profileQ.refetch()}>Firmendaten erneut laden</Button></div> : <dl>
                    <Field label="Rechnungsname">{profile?.billing?.company_name}</Field>
                    <Field label="Firmenanschrift">{[profile?.billing?.company_address, [profile?.billing?.company_zip, profile?.billing?.company_city].filter(Boolean).join(' ')].filter(Boolean).join('\n')}</Field>
                    <Field label="Unternehmensform">{profile?.tax?.business_type === 'company' ? 'Gesellschaft' : profile?.tax?.business_type === 'sole_trader' ? 'Einzelunternehmen' : null}</Field>
                    <Field label="Umsatzsteuer-ID">{profile?.tax?.vat_id}</Field>
                </dl>}
                {contactState ? <div className="py-4 text-sm text-text-muted" role={detailError ? 'alert' : 'status'}>{contactState}{detailError && <Button variant="outline" size="sm" className="mt-2 block" onClick={retryDetail}>Kontaktdaten erneut laden</Button>}</div> : <dl>
                    <Field label="Kontoinhaber">{owner ? <>{owner.name || owner.username || 'Name nicht hinterlegt'}{!owner.is_active && <span className="ml-2 text-status-warning">Zugang inaktiv</span>}</> : 'Kein Kontoinhaber zugeordnet'}</Field>
                    <Field label="E-Mail des Inhabers">{owner?.email ? <CopyValue value={owner.email} label="E-Mail-Adresse" /> : null}</Field>
                </dl>}
                <dl><Field label="WhatsApp des Bots">{tenant.whatsapp_number ? <CopyValue value={tenant.whatsapp_number} label="WhatsApp-Nummer" /> : null}</Field></dl>
            </Panel>
            <Panel title="Nutzung & Zugänge" subtitle="Aktueller Stand der verfügbaren Kontodaten" action={action('Zugänge öffnen', 'access')}>
                <dl className="grid grid-cols-2 gap-4 py-3"><div><dt className="text-xs text-text-muted">Nutzer / freigegeben</dt><dd className="mt-2 text-lg font-semibold tabular-nums">{tenant.user_count} <span className="text-sm font-normal text-text-muted">/ {detail?.settings.max_users ?? tenant.max_users}</span></dd></div><div><dt className="text-xs text-text-muted">Geräte / freigegeben</dt><dd className="mt-2 text-lg font-semibold tabular-nums">{tenant.device_count} <span className="text-sm font-normal text-text-muted">/ {detail?.settings.max_devices ?? tenant.max_devices}</span></dd></div></dl>
            </Panel>
        </div>
        <div className="min-w-0 space-y-5">
            <Panel title="Betreuung & Einrichtung" action={action('Einrichtung öffnen', 'onboarding')}>
                {caseQ.isLoading ? <p className="py-4 text-sm text-text-muted" role="status">Bearbeitungsstand wird geladen…</p> : caseQ.isError || !caseQ.data ? <div className="py-4 text-sm" role="alert"><p>Bearbeitungsstand nicht verfügbar.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => void caseQ.refetch()}>Bearbeitungsstand erneut laden</Button></div> : <>
                    <dl><Field label="Verantwortlich">{caseQ.data.ownerName || 'Noch nicht zugewiesen'}</Field><Field label="Geplante Übergabe">{date(caseQ.data.dueAt)}</Field><Field label="Bearbeitungsphase">{{ draft: 'Vorbereitung', provisioning: 'Einrichtung', integration: 'Anbindung', review: 'Prüfung & Freigabe', live: 'Live-Betrieb' }[caseQ.data.stage] ?? caseQ.data.stage}</Field></dl>
                    {caseQ.data.readiness.blockers.length > 0 && <div className="my-3 rounded-md border border-status-warning/20 bg-status-warning/5 p-3"><p className="text-sm font-medium">Vor der Freigabe offen</p><ul className="mt-2 space-y-2 text-sm text-text-secondary">{caseQ.data.readiness.blockers.slice(0, 3).map(blocker => <li key={blocker}>• {blocker}</li>)}</ul>{caseQ.data.readiness.blockers.length > 3 && <p className="mt-2 text-xs text-text-muted">{caseQ.data.readiness.blockers.length - 3} weitere Punkte in der Einrichtung</p>}</div>}
                    <p className="py-3 text-xs text-text-muted">Bearbeitungsstand: {date(caseQ.data.updatedAt)}</p>
                </>}
            </Panel>
            <Panel title="Konto & Vereinbarungen">
                <dl><Field label="Kontostatus">{tenant.is_active ? 'Aktiv' : 'Inaktiv'}</Field><Field label="Zahlung">{payment.label}</Field><Field label="Einrichtung">{setupLabel(tenant.onboarding_status)}</Field><Field label="Kunde seit">{date(tenant.created_at)}</Field><Field label="AVV-Annahme">{profileQ.isError ? 'Nicht verfügbar' : profileQ.isLoading ? 'Wird geladen…' : profile?.dpaAcceptedAt ? `Dokumentiert · ${date(profile.dpaAcceptedAt)}` : 'Nicht dokumentiert'}</Field><Field label="Konto-ID"><CopyValue value={tenant.id} label="Konto-ID" /></Field></dl>
            </Panel>
            <Button variant="outline" className="w-full justify-between" onClick={() => onSection('operations')}>Bestellungen & ERP öffnen<ArrowUpRight size={15} /></Button>
        </div>
    </div>;
}
