/**
 * MaintenanceView — Toggle the global maintenance flag.
 *
 * The backend persists ONLY a boolean (merchant_settings 'admin' →
 * maintenanceMode). When enabled, tenant users see a non-blocking banner
 * at the top of the User-Dashboard (MaintenanceBanner) — the app itself
 * stays usable. There is no free-text message and no scheduled end time,
 * so this view exposes only the on/off switch.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useMaintenance, useSetMaintenance } from '@/hooks/useMaintenance';
import { usePermissions } from '@/auth/usePermissions';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { LoadingState } from '@/components/feedback/LoadingState';
import { SEITEN_RAND_OHNE_BREITE } from '@/components/ui/seite';
import { cn } from '@/lib/utils';

export default function MaintenanceView(): JSX.Element {
    const { state, isLoading } = useMaintenance();
    const setMut = useSetMaintenance();
    const { isReadOnly } = usePermissions();
    const [enabled, setEnabled] = useState(false);

    // Sync server state into the editable switch when the data first loads or refreshes.
    // This is the canonical "sync external state to controlled inputs" pattern; the rule is opt-out.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (state) {
            setEnabled(state.enabled);
        }
    }, [state]);
    /* eslint-enable react-hooks/set-state-in-effect */

    if (isLoading) return <LoadingState label="Lade Maintenance-Status…" />;

    const dirty = state ? enabled !== state.enabled : enabled;
    const canEdit = !isReadOnly;

    async function save(): Promise<void> {
        try {
            await setMut.mutateAsync({ enabled });
            toast.success('Maintenance-Status aktualisiert.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
        }
    }

    return (
        <div className={cn(SEITEN_RAND_OHNE_BREITE, 'mx-auto max-w-2xl')}>
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">Maintenance Mode</h1>
                <p className="text-sm text-text-secondary">
                    Wenn aktiv, sehen alle Tenant-User ein Wartungs-Banner oben im
                    User-Dashboard. Die App bleibt bedienbar — das Banner ist ein
                    Hinweis, keine Sperre.
                </p>
            </header>

            <div
                className={cn(
                    'rounded-md border p-6 transition-colors',
                    enabled ? 'border-danger/60 bg-danger/5' : 'border-border bg-surface/40',
                )}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <div className="font-medium">
                            {enabled ? 'Wartungsmodus AKTIV' : 'Wartungsmodus inaktiv'}
                        </div>
                        <p className="text-xs text-text-secondary mt-1">
                            {enabled
                                ? 'Die Nutzer der Kunden sehen aktuell das Wartungs-Banner.'
                                : 'Es wird kein Banner angezeigt.'}
                        </p>
                    </div>
                    <Switch
                        checked={enabled}
                        onCheckedChange={setEnabled}
                        disabled={!canEdit}
                        aria-label="Maintenance-Mode"
                    />
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                    {!canEdit && (
                        <span className="text-xs text-text-secondary">
                            Nur lesend — keine Berechtigung zum Ändern.
                        </span>
                    )}
                    <Button
                        onClick={() => void save()}
                        disabled={!canEdit || !dirty || setMut.isPending}
                    >
                        {setMut.isPending ? 'Speichere…' : 'Speichern'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
