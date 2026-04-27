/**
 * TenantDetailView — slide-in Drawer for tenant detail.
 *
 * Implementation uses Radix Sheet (right side) — closes on ESC, click-outside,
 * and on route change. Wires:
 *   - Active devices via useTenantDevices + useRemoveDevice
 *   - Impersonation via useImpersonate (toast fallback)
 *   - Password reset trigger via requestPasswordReset() from @/api/auth
 */
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import {
    useTenants,
    useTenantDevices,
    useRemoveDevice,
} from '@/hooks/useTenants';
import { useImpersonate } from '@/hooks/useImpersonate';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/utils/clipboard';
import { formatDateTime, formatRelative } from '@/utils/format/date';
import { requestPasswordReset } from '@/api/auth';

export default function TenantDetailView(): JSX.Element {
    const { id } = useParams<{ id: string }>();
    const nav = useNavigate();
    const numericId = id != null ? Number(id) : null;
    const { tenants, isLoading } = useTenants();
    const tenant = tenants.find((t) => t.id === numericId);
    const { devices, isLoading: devicesLoading } = useTenantDevices(numericId);
    const removeDeviceMut = useRemoveDevice();
    const impersonateMut = useImpersonate();

    function handleImpersonate(): void {
        if (numericId == null) return;
        impersonateMut.mutate(
            { tenantId: numericId },
            {
                onSuccess: () => toast.success('Impersonation gestartet.'),
                onError: () => toast.message('Impersonation noch nicht verfügbar.'),
            }
        );
    }

    async function handlePasswordReset(): Promise<void> {
        if (!tenant) return;
        try {
            await requestPasswordReset(tenant.slug);
            toast.success('Passwort-Reset an Admin-Email gesendet.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Reset-Anfrage fehlgeschlagen.');
        }
    }

    return (
        <Sheet open onOpenChange={(open) => !open && nav('/tenants')}>
            <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
                <SheetHeader className="px-6 py-4 border-b border-border">
                    <SheetTitle>{tenant?.name ?? 'Tenant'}</SheetTitle>
                    <SheetDescription>
                        {tenant ? <span className="font-mono text-xs">{tenant.slug}</span> : 'Lade…'}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {isLoading && <LoadingState label="Lade Tenant…" />}
                    {!isLoading && !tenant && (
                        <p className="text-sm text-text-muted">Tenant nicht gefunden.</p>
                    )}
                    {tenant && (
                        <>
                            <section>
                                <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-2">
                                    Stammdaten
                                </h3>
                                <dl className="grid grid-cols-2 gap-2 text-sm">
                                    <dt className="text-text-secondary">Status</dt>
                                    <dd>{tenant.is_active ? 'Aktiv' : 'Inaktiv'}</dd>
                                    <dt className="text-text-secondary">Payment</dt>
                                    <dd>{tenant.payment_status ?? '—'}</dd>
                                    <dt className="text-text-secondary">Onboarding</dt>
                                    <dd>{tenant.onboarding_status ?? '—'}</dd>
                                    <dt className="text-text-secondary">User</dt>
                                    <dd className="font-mono">
                                        {tenant.user_count}/{tenant.max_users}
                                    </dd>
                                    <dt className="text-text-secondary">Devices</dt>
                                    <dd className="font-mono">
                                        {tenant.device_count}/{tenant.max_devices}
                                    </dd>
                                    <dt className="text-text-secondary">Erstellt</dt>
                                    <dd>{tenant.created_at ? formatDateTime(tenant.created_at) : '—'}</dd>
                                </dl>
                            </section>

                            <section>
                                <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-2">
                                    Aktive Geräte
                                </h3>
                                {devicesLoading ? (
                                    <div className="text-xs text-text-muted">Lade…</div>
                                ) : devices.length === 0 ? (
                                    <p className="text-xs text-text-muted">Keine aktiven Geräte.</p>
                                ) : (
                                    <ul className="space-y-1">
                                        {devices.map((d) => (
                                            <li
                                                key={d.id}
                                                className="flex items-center justify-between rounded-md border border-border bg-surface/30 px-3 py-2 text-xs"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-mono truncate">{d.user}</div>
                                                    <div className="text-text-muted">
                                                        {d.last_seen ? formatRelative(d.last_seen) : '—'} · {d.ip}
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        if (numericId == null) return;
                                                        removeDeviceMut.mutate(
                                                            { tenantId: numericId, deviceId: d.device_id },
                                                            {
                                                                onSuccess: () => toast.success('Gerät entfernt.'),
                                                                onError: (e) =>
                                                                    toast.error(
                                                                        e instanceof Error
                                                                            ? e.message
                                                                            : 'Entfernen fehlgeschlagen.',
                                                                    ),
                                                            },
                                                        );
                                                    }}
                                                >
                                                    Entfernen
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>

                            <section>
                                <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-2">
                                    Aktionen
                                </h3>
                                <div className="flex gap-2 flex-wrap">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void copyToClipboard(tenant.slug)}
                                    >
                                        Slug kopieren
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => nav(`/audit?tenant=${tenant.id}`)}
                                    >
                                        Audit anzeigen
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void handlePasswordReset()}
                                    >
                                        Passwort zurücksetzen
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleImpersonate}>
                                        Impersonate
                                    </Button>
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
