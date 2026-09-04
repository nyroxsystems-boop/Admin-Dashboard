/**
 * SupportConsoleView — In-Dashboard-Support für EINEN Händler (P1.3).
 *
 * Tenant-Picker → Tabs „Orders | Chats | Einstellungen | Probleme". Alles
 * read-only und gegen echte Endpoints:
 *   - Detail/Orders/Settings: GET /api/admin/tenants/:id/detail (useTenant)
 *   - Chats:                  GET /api/admin/tenants/:id/conversations
 *   - Probleme:               GET /api/admin/tenants/:id/issues
 * onboarding_status steht prominent im Kopf („Woran hängt dieser Händler?").
 * Impersonate ohne Tab-Wechsel direkt aus dem Kopf.
 */
import { useState } from 'react';
import {
    AlertTriangle,
    ExternalLink,
    MessageSquare,
    Package,
    Settings as SettingsIcon,
    ShoppingCart,
} from 'lucide-react';
import { toast } from 'sonner';

import { TenantSelect } from '@/components/TenantSelect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import {
    useTenants,
    useTenant,
    useTenantConversations,
    useTenantIssues,
} from '@/hooks/useTenants';
import { useImpersonate } from '@/hooks/useImpersonate';
import { formatDateTime } from '@/utils/format/date';
import { SEITEN_RAND } from '@/components/ui/seite';
import { cn } from '@/lib/utils';

interface DetailOrder {
    id: string;
    status: string;
    oem_number: string | null;
    part_name?: string | null;
    customer?: string | null;
    created_at: string;
    total: string | number | null;
}

const ONBOARDING_META: Record<string, { label: string; cls: string; hint: string }> = {
    active: {
        label: 'Aktiv',
        cls: 'bg-status-success-muted text-status-success',
        hint: 'Voll eingerichtet und live.',
    },
    configured: {
        label: 'Konfiguriert',
        cls: 'bg-accent-500/12 text-accent-500',
        hint: 'Rechnungsfähig — Firmen-/Steuerdaten & IBAN stehen.',
    },
    pending: {
        label: 'Ausstehend',
        cls: 'bg-status-warning-muted text-status-warning',
        hint: 'Provisioning unvollständig — IBAN/Steuerprofil im Kunden-Detail bzw. Wizard ergänzen, damit korrekte Rechnungen erzeugt werden.',
    },
};

export default function SupportConsoleView(): JSX.Element {
    const [tenantId, setTenantId] = useState<string | null>(null);
    const { tenants } = useTenants();
    const tenant = tenants.find((t) => String(t.id) === tenantId);

    const detailQ = useTenant(tenantId);
    const convQ = useTenantConversations(tenantId);
    const issuesQ = useTenantIssues(tenantId);
    const impersonate = useImpersonate();

    const detail = detailQ.data;
    const orders = (detail?.orders ?? []) as DetailOrder[];
    const onboarding =
        tenant?.onboarding_status ?? detail?.settings.onboarding_status ?? 'pending';
    const ob = ONBOARDING_META[onboarding] ?? ONBOARDING_META.pending;

    function handleImpersonate(): void {
        if (!tenantId) return;
        const owner =
            detail?.users.find((u) => u.role === 'merchant') ?? detail?.users[0];
        impersonate.mutate(
            { tenantId, userId: owner?.id, tenantName: tenant?.name },
            {
                onSuccess: () => toast.success('Impersonation gestartet (neuer Tab).'),
                onError: (err) =>
                    toast.error(err instanceof Error ? err.message : 'Impersonation fehlgeschlagen.'),
            },
        );
    }

    return (
        <div className={cn(SEITEN_RAND)}>
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">Support-Konsole</h1>
                <p className="text-sm text-text-secondary">
                    Einblick in Orders, Chats, Einstellungen und Probleme eines Händlers — ohne
                    Impersonation.
                </p>
            </header>

            <div className="mb-6 max-w-md">
                <TenantSelect value={tenantId} onChange={setTenantId} />
            </div>

            {!tenantId ? (
                <EmptyState
                    icon={MessageSquare}
                    title="Händler wählen"
                    description="Wähle oben einen Händler, um seine Daten zu inspizieren."
                />
            ) : (
                <>
                    {/* Onboarding-Status + Impersonate */}
                    <section className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-md border border-border bg-surface/40 p-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{tenant?.name ?? tenantId}</span>
                                <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${ob.cls}`}
                                >
                                    <span className="inline-block size-1.5 rounded-full bg-current" aria-hidden />
                                    Onboarding: {ob.label}
                                </span>
                                {tenant?.payment_status === 'suspended' && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-status-danger-muted px-2 py-0.5 text-xs font-medium text-status-danger">
                                        gesperrt
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-text-muted max-w-xl">{ob.hint}</p>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleImpersonate}
                            disabled={impersonate.isPending || !detail}
                        >
                            <ExternalLink className="size-3" />
                            {impersonate.isPending ? 'Öffne…' : 'Als Händler ansehen'}
                        </Button>
                    </section>

                    <Tabs defaultValue="orders">
                        <TabsList>
                            <TabsTrigger value="orders">
                                <ShoppingCart className="size-3.5" /> Orders
                            </TabsTrigger>
                            <TabsTrigger value="chats">
                                <MessageSquare className="size-3.5" /> Chats
                            </TabsTrigger>
                            <TabsTrigger value="settings">
                                <SettingsIcon className="size-3.5" /> Einstellungen
                            </TabsTrigger>
                            <TabsTrigger value="issues">
                                <AlertTriangle className="size-3.5" /> Probleme
                                {issuesQ.data && issuesQ.data.total > 0 && (
                                    <span className="ml-1 rounded-full bg-status-danger-muted px-1.5 text-[10px] font-mono text-status-danger">
                                        {issuesQ.data.total}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        {/* ── Orders ── */}
                        <TabsContent value="orders" className="mt-4">
                            {detailQ.isLoading ? (
                                <LoadingState label="Lade Orders…" />
                            ) : detailQ.error ? (
                                <ErrorState message="Detail konnte nicht geladen werden." onRetry={() => void detailQ.refetch()} />
                            ) : orders.length === 0 ? (
                                <EmptyState icon={Package} title="Keine Orders" description="Dieser Händler hat noch keine Bestellungen." />
                            ) : (
                                <div className="overflow-x-auto rounded-md border border-border">
                                    <table className="w-full text-sm">
                                        <thead className="text-left text-xs text-text-secondary">
                                            <tr className="border-b border-border">
                                                <th className="px-3 py-2 font-medium">Status</th>
                                                <th className="px-3 py-2 font-medium">Teil</th>
                                                <th className="px-3 py-2 font-medium">OEM</th>
                                                <th className="px-3 py-2 font-medium">Kunde</th>
                                                <th className="px-3 py-2 font-medium text-right">Summe</th>
                                                <th className="px-3 py-2 font-medium">Datum</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orders.map((o) => (
                                                <tr key={o.id} className="border-b border-border/60 last:border-0">
                                                    <td className="px-3 py-2 font-mono text-xs">{o.status}</td>
                                                    <td className="px-3 py-2">{o.part_name || '—'}</td>
                                                    <td className="px-3 py-2 font-mono text-xs">{o.oem_number || '—'}</td>
                                                    <td className="px-3 py-2 font-mono text-xs">{o.customer || '—'}</td>
                                                    <td className="px-3 py-2 text-right font-mono">
                                                        {o.total != null ? Number(o.total).toFixed(2).replace('.', ',') : '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-text-muted">{formatDateTime(o.created_at)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </TabsContent>

                        {/* ── Chats ── */}
                        <TabsContent value="chats" className="mt-4">
                            {convQ.isLoading ? (
                                <LoadingState label="Lade Chats…" />
                            ) : convQ.error ? (
                                <ErrorState message="Chats konnten nicht geladen werden." onRetry={() => void convQ.refetch()} />
                            ) : !convQ.data || convQ.data.length === 0 ? (
                                <EmptyState
                                    icon={MessageSquare}
                                    title="Keine WhatsApp-Chats"
                                    description="Für diesen Händler liegen keine Bot-Konversationen vor."
                                />
                            ) : (
                                <div className="space-y-3">
                                    {convQ.data.map((c) => (
                                        <details key={c.phone} className="rounded-md border border-border bg-surface/40">
                                            <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm">
                                                <span className="font-mono">{c.phone}</span>
                                                <span className="flex items-center gap-3 text-xs text-text-muted">
                                                    <span className="truncate max-w-[40ch]">{c.last_message || ''}</span>
                                                    <span>{c.message_count} Nachr.</span>
                                                    <span>{formatDateTime(c.last_message_at)}</span>
                                                </span>
                                            </summary>
                                            <div className="space-y-1.5 border-t border-border px-3 py-3">
                                                {c.messages.map((m, i) => (
                                                    <div
                                                        key={i}
                                                        className={`max-w-[80%] rounded-md px-3 py-1.5 text-sm ${
                                                            m.direction === 'OUT'
                                                                ? 'ml-auto bg-accent-500/12 text-text-primary'
                                                                : 'bg-elevated/60 text-text-secondary'
                                                        }`}
                                                    >
                                                        <div className="whitespace-pre-wrap break-words">{m.content || '—'}</div>
                                                        <div className="mt-0.5 text-[10px] text-text-muted">{formatDateTime(m.created_at)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        {/* ── Einstellungen ── */}
                        <TabsContent value="settings" className="mt-4">
                            {detailQ.isLoading ? (
                                <LoadingState label="Lade Einstellungen…" />
                            ) : !detail ? (
                                <EmptyState icon={SettingsIcon} title="Keine Daten" />
                            ) : (
                                <dl className="grid max-w-xl grid-cols-2 gap-2 text-sm">
                                    <dt className="text-text-secondary">Onboarding</dt>
                                    <dd>{ob.label}</dd>
                                    <dt className="text-text-secondary">Payment-Status</dt>
                                    <dd>{detail.settings.payment_status ?? '—'}</dd>
                                    <dt className="text-text-secondary">WhatsApp-Nummer</dt>
                                    <dd className="font-mono">{detail.settings.whatsapp_number || '—'}</dd>
                                    <dt className="text-text-secondary">User</dt>
                                    <dd className="font-mono">{detail.stats.user_count}/{detail.settings.max_users}</dd>
                                    <dt className="text-text-secondary">Devices</dt>
                                    <dd className="font-mono">{detail.stats.device_count}/{detail.settings.max_devices}</dd>
                                    <dt className="text-text-secondary">Orders gesamt</dt>
                                    <dd className="font-mono">{detail.stats.total_orders}</dd>
                                    <dt className="text-text-secondary">OEM-Trefferquote</dt>
                                    <dd className="font-mono">{detail.stats.oem_rate}%</dd>
                                    <dt className="text-text-secondary">Umsatz</dt>
                                    <dd className="font-mono">{Number(detail.stats.revenue || 0).toFixed(2).replace('.', ',')} €</dd>
                                </dl>
                            )}
                        </TabsContent>

                        {/* ── Probleme ── */}
                        <TabsContent value="issues" className="mt-4">
                            {issuesQ.isLoading ? (
                                <LoadingState label="Lade Probleme…" />
                            ) : issuesQ.error ? (
                                <ErrorState message="Probleme konnten nicht geladen werden." onRetry={() => void issuesQ.refetch()} />
                            ) : !issuesQ.data || issuesQ.data.total === 0 ? (
                                <EmptyState
                                    icon={AlertTriangle}
                                    title="Keine offenen Probleme"
                                    description="Keine hängengebliebenen Orders, unerfüllten Teile-Lookups oder fehlgeschlagenen KI-Jobs."
                                />
                            ) : (
                                <div className="space-y-5">
                                    {issuesQ.data.stalledOrders.length > 0 && (
                                        <section>
                                            <h3 className="mb-2 text-xs font-mono uppercase tracking-widest text-text-secondary">
                                                Hängende/abgebrochene Orders ({issuesQ.data.stalledOrders.length})
                                            </h3>
                                            <ul className="space-y-1.5 text-sm">
                                                {issuesQ.data.stalledOrders.map((o) => (
                                                    <li key={o.id} className="rounded-md border border-border bg-surface/40 px-3 py-2">
                                                        <span className="font-mono text-xs text-status-warning">{o.status}</span>
                                                        {' · '}
                                                        {o.requested_part_name || 'Teil unbekannt'}
                                                        {' · '}
                                                        <span className="font-mono text-xs">{o.customer_contact || '—'}</span>
                                                        <span className="ml-2 text-xs text-text-muted">{formatDateTime(o.created_at)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    )}
                                    {issuesQ.data.unmetLookups.length > 0 && (
                                        <section>
                                            <h3 className="mb-2 text-xs font-mono uppercase tracking-widest text-text-secondary">
                                                Unerfüllte Teile-Lookups ({issuesQ.data.unmetLookups.length})
                                            </h3>
                                            <ul className="space-y-1.5 text-sm">
                                                {issuesQ.data.unmetLookups.map((l) => (
                                                    <li key={l.id} className="rounded-md border border-border bg-surface/40 px-3 py-2">
                                                        {l.query_text || '—'}
                                                        <span className="ml-2 text-xs text-text-muted">{formatDateTime(l.created_at)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    )}
                                    {issuesQ.data.failedJobs.length > 0 && (
                                        <section>
                                            <h3 className="mb-2 text-xs font-mono uppercase tracking-widest text-text-secondary">
                                                Fehlgeschlagene KI-Jobs ({issuesQ.data.failedJobs.length})
                                            </h3>
                                            <ul className="space-y-1.5 text-sm">
                                                {issuesQ.data.failedJobs.map((j) => (
                                                    <li key={j.id} className="rounded-md border border-border bg-surface/40 px-3 py-2">
                                                        <span className="font-mono text-xs">{j.job_type || 'job'}</span>
                                                        {' · '}
                                                        <span className="text-status-danger">{j.error_message || 'Fehler'}</span>
                                                        <span className="ml-2 text-xs text-text-muted">{formatDateTime(j.created_at)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    )}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    );
}
