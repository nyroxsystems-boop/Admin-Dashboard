/**
 * MaintenanceView — Toggle Maintenance-Mode for the entire platform.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useMaintenance, useSetMaintenance } from '@/hooks/useMaintenance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { LoadingState } from '@/components/feedback/LoadingState';
import { cn } from '@/lib/utils';

export default function MaintenanceView(): JSX.Element {
    const { state, isLoading } = useMaintenance();
    const setMut = useSetMaintenance();
    const [enabled, setEnabled] = useState(false);
    const [message, setMessage] = useState('');
    const [scheduledUntil, setScheduledUntil] = useState('');

    // Sync server state into the editable form fields when the data first loads or refreshes.
    // This is the canonical "sync external state to controlled inputs" pattern; the rule is opt-out.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (state) {
            setEnabled(state.enabled);
            setMessage(state.message ?? '');
            setScheduledUntil(state.scheduled_until ?? '');
        }
    }, [state]);
    /* eslint-enable react-hooks/set-state-in-effect */

    if (isLoading) return <LoadingState label="Lade Maintenance-Status…" />;

    async function save(): Promise<void> {
        try {
            await setMut.mutateAsync({
                enabled,
                message,
                scheduled_until: scheduledUntil || null,
            });
            toast.success('Maintenance-Status aktualisiert.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
        }
    }

    return (
        <div className="p-6 md:p-8 max-w-2xl mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">Maintenance Mode</h1>
                <p className="text-sm text-text-secondary">
                    Wenn aktiv, sehen alle Tenant-User die Wartungsmeldung statt der App.
                </p>
            </header>

            <div
                className={cn(
                    'rounded-md border p-6 transition-colors',
                    enabled ? 'border-danger/60 bg-danger/5' : 'border-border bg-surface/40',
                )}
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="font-medium">
                            {enabled ? 'Wartungsmodus AKTIV' : 'Wartungsmodus inaktiv'}
                        </div>
                    </div>
                    <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Maintenance-Mode" />
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="m-msg">Nachricht (sichtbar für User)</Label>
                        <Textarea
                            id="m-msg"
                            rows={4}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Wir aktualisieren das System. Voraussichtliche Dauer: 30 Minuten."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="m-end">Geplantes Ende (ISO Datum)</Label>
                        <Input
                            id="m-end"
                            type="datetime-local"
                            value={scheduledUntil ? scheduledUntil.slice(0, 16) : ''}
                            onChange={(e) =>
                                setScheduledUntil(
                                    e.target.value ? new Date(e.target.value).toISOString() : '',
                                )
                            }
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <Button onClick={() => void save()} disabled={setMut.isPending}>
                        {setMut.isPending ? 'Speichere…' : 'Speichern'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
