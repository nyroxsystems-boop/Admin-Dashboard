/**
 * TenantWizard — Multi-step wizard for creating a new tenant.
 *
 * Steps:
 *   1. Stammdaten (name → live slug)
 *   2. Admin-Account (email, auto-pw with copy)
 *   3. Limits (users, devices)
 *   4. Bestätigung
 *
 * Auto-saves wizard state to localStorage so a closed tab doesn't lose progress.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateTenant } from '@/hooks/useTenants';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';
import { nameToSlug, validateSlug } from '@/utils/validation/slug';
import { validateEmail } from '@/utils/validation/email';
import { generateSecurePassword, validatePassword } from '@/utils/validation/password';
import { copyToClipboard } from '@/utils/clipboard';
import { cn } from '@/lib/utils';

interface WizardState {
    step: number;
    name: string;
    slug: string;
    slugManuallyEdited: boolean;
    adminEmail: string;
    adminPassword: string;
    usersLimit: number;
    devicesLimit: number;
}

const INITIAL: WizardState = {
    step: 0,
    name: '',
    slug: '',
    slugManuallyEdited: false,
    adminEmail: '',
    adminPassword: generateSecurePassword(),
    usersLimit: 25,
    devicesLimit: 50,
};

const STEPS = ['Stammdaten', 'Admin-Account', 'Limits', 'Bestätigung'];

export default function TenantWizard(): JSX.Element {
    const nav = useNavigate();
    const [state, setState] = useLocalStorage<WizardState>('admin.tenantWizard.draft', INITIAL);
    const [submitting, setSubmitting] = useState(false);
    const createMut = useCreateTenant();

    const isDirty = state.name !== '' || state.adminEmail !== '';
    useBeforeUnload(isDirty && state.step < 3);

    // Live-slug
    useEffect(() => {
        if (!state.slugManuallyEdited && state.name) {
            setState((s) => ({ ...s, slug: nameToSlug(s.name) }));
        }
    }, [state.name, state.slugManuallyEdited, setState]);

    const slugCheck = useMemo(() => validateSlug(state.slug), [state.slug]);
    const emailCheck = useMemo(() => validateEmail(state.adminEmail), [state.adminEmail]);
    const pwCheck = useMemo(() => validatePassword(state.adminPassword), [state.adminPassword]);

    function canProceed(): boolean {
        switch (state.step) {
            case 0:
                return state.name.trim().length >= 2 && slugCheck.valid;
            case 1:
                return emailCheck.valid && pwCheck.valid;
            case 2:
                return state.usersLimit > 0 && state.devicesLimit > 0;
            case 3:
                return true;
            default:
                return false;
        }
    }

    async function submit(): Promise<void> {
        setSubmitting(true);
        try {
            await createMut.mutateAsync({
                name: state.name,
                email: state.adminEmail,
                password: state.adminPassword,
            });
            toast.success(
                `Tenant "${state.name}" angelegt. Passwort wurde an die Admin-Email gesendet.`,
                { duration: 8000 },
            );
            setState(() => INITIAL);
            nav('/tenants');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="p-6 md:p-8 max-w-3xl mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">Neuer Tenant</h1>
                <p className="text-sm text-text-secondary">Mehrstufiger Onboarding-Wizard.</p>
            </header>

            {/* Stepper */}
            <ol className="flex items-center gap-2 mb-8" aria-label="Wizard Steps">
                {STEPS.map((label, idx) => (
                    <li
                        key={label}
                        className={cn(
                            'flex-1 flex items-center gap-2 text-xs font-mono uppercase tracking-widest',
                            idx === state.step && 'text-text-primary',
                            idx < state.step && 'text-accent-500',
                            idx > state.step && 'text-text-muted',
                        )}
                    >
                        <span
                            className={cn(
                                'size-5 rounded-full flex items-center justify-center text-[10px] border',
                                idx === state.step && 'border-accent-500 bg-accent-500 text-white',
                                idx < state.step && 'border-accent-500 text-accent-500',
                                idx > state.step && 'border-border',
                            )}
                        >
                            {idx < state.step ? <Check className="size-3" /> : idx + 1}
                        </span>
                        <span>{label}</span>
                    </li>
                ))}
            </ol>

            <div className="rounded-md border border-border bg-surface/40 p-6 space-y-4">
                {state.step === 0 && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="t-name">Tenant-Name</Label>
                            <Input
                                id="t-name"
                                value={state.name}
                                onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                                placeholder="Acme Auto Parts"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="t-slug">
                                Slug{' '}
                                <span className="text-xs text-text-muted font-mono">(automatisch erzeugt)</span>
                            </Label>
                            <Input
                                id="t-slug"
                                value={state.slug}
                                onChange={(e) =>
                                    setState((s) => ({ ...s, slug: e.target.value, slugManuallyEdited: true }))
                                }
                                placeholder="acme-auto-parts"
                            />
                            {state.slug && !slugCheck.valid && (
                                <p className="text-xs text-danger">{slugCheck.errors[0]}</p>
                            )}
                        </div>
                    </>
                )}

                {state.step === 1 && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="t-email">Admin-Email</Label>
                            <Input
                                id="t-email"
                                type="email"
                                value={state.adminEmail}
                                onChange={(e) => setState((s) => ({ ...s, adminEmail: e.target.value }))}
                                placeholder="admin@acme.de"
                                autoFocus
                            />
                            {state.adminEmail && !emailCheck.valid && (
                                <p className="text-xs text-danger">{emailCheck.errors[0]}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="t-pw">Auto-Generiertes Passwort</Label>
                            <div className="flex gap-2">
                                <Input id="t-pw" value={state.adminPassword} readOnly className="font-mono" />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                        const ok = await copyToClipboard(state.adminPassword);
                                        if (ok) toast.success('Passwort kopiert.');
                                    }}
                                >
                                    <Copy className="size-3" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setState((s) => ({ ...s, adminPassword: generateSecurePassword() }))}
                                >
                                    Neu
                                </Button>
                            </div>
                            <p className="text-xs text-text-muted">
                                Speichere das Passwort jetzt — es wird nach diesem Schritt nicht mehr angezeigt.
                            </p>
                        </div>
                    </>
                )}

                {state.step === 2 && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="t-users">User-Limit</Label>
                            <Input
                                id="t-users"
                                type="number"
                                min={1}
                                value={state.usersLimit}
                                onChange={(e) => setState((s) => ({ ...s, usersLimit: parseInt(e.target.value, 10) || 0 }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="t-devices">Device-Limit</Label>
                            <Input
                                id="t-devices"
                                type="number"
                                min={1}
                                value={state.devicesLimit}
                                onChange={(e) =>
                                    setState((s) => ({ ...s, devicesLimit: parseInt(e.target.value, 10) || 0 }))
                                }
                            />
                        </div>
                    </>
                )}

                {state.step === 3 && (
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                        <dt className="text-text-secondary">Name</dt>
                        <dd>{state.name}</dd>
                        <dt className="text-text-secondary">Slug</dt>
                        <dd className="font-mono">{state.slug}</dd>
                        <dt className="text-text-secondary">Admin-Email</dt>
                        <dd>{state.adminEmail}</dd>
                        <dt className="text-text-secondary">User-Limit</dt>
                        <dd className="font-mono">{state.usersLimit}</dd>
                        <dt className="text-text-secondary">Device-Limit</dt>
                        <dd className="font-mono">{state.devicesLimit}</dd>
                    </dl>
                )}
            </div>

            <div className="flex items-center justify-between mt-6">
                <Button
                    variant="outline"
                    onClick={() => {
                        if (state.step === 0) nav('/tenants');
                        else setState((s) => ({ ...s, step: s.step - 1 }));
                    }}
                >
                    <ArrowLeft className="size-4" /> Zurück
                </Button>
                {state.step < STEPS.length - 1 ? (
                    <Button
                        disabled={!canProceed()}
                        onClick={() => setState((s) => ({ ...s, step: s.step + 1 }))}
                    >
                        Weiter <ArrowRight className="size-4" />
                    </Button>
                ) : (
                    <Button disabled={submitting} onClick={() => void submit()}>
                        {submitting ? 'Erstelle…' : 'Tenant erstellen'}
                    </Button>
                )}
            </div>
        </div>
    );
}
