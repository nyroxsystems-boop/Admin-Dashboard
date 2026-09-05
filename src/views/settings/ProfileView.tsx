/**
 * ProfileView — Admin-Profil + persönliche E-Mail-Signatur.
 *
 * Die Signatur wird unter jede vom Admin ausgelöste Mail gesetzt — insbesondere
 * unter Zugangs-Anfragen an Großhändler (siehe „Zugänge beantragen").
 * Jeder Admin-Account pflegt seine eigene Signatur.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingState } from '@/components/feedback/LoadingState';
import { getAdminProfile, updateSignature, type AdminProfile } from '@/api/auth';
import { parseError } from '@/api/client';
import { AccountSecurity } from './AccountSecurity';

const SIGNATURE_PLACEHOLDER = `Max Mustermann
Partsunion UG
max.mustermann@partsunion.de
+49 …`;
const PROFILE_QUERY_KEY = ['admin', 'profile'] as const;

export default function ProfileView(): JSX.Element {
    const queryClient = useQueryClient();
    const [signatureDraft, setSignatureDraft] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const profileQ = useQuery({
        queryKey: PROFILE_QUERY_KEY,
        queryFn: getAdminProfile,
        staleTime: 60_000,
    });

    const serverSignature = profileQ.data?.signature ?? '';
    const signature = signatureDraft ?? serverSignature;
    const dirty = signatureDraft !== null && signatureDraft !== serverSignature;

    async function handleSave(): Promise<void> {
        setSaving(true);
        try {
            await updateSignature(signature);
            queryClient.setQueryData<AdminProfile>(PROFILE_QUERY_KEY, (profile) =>
                profile ? { ...profile, signature } : profile,
            );
            setSignatureDraft(null);
            toast.success('Signatur gespeichert');
        } catch (err) {
            toast.error('Speichern fehlgeschlagen', { description: parseError(err).message });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="min-w-0">
            <AccountSecurity />
            {/* Signatur */}
            <section className="rounded-lg border border-border bg-surface/40 p-4 md:p-5">
                <div className="mb-3">
                    <h2 className="text-sm font-medium">E-Mail-Signatur</h2>
                    <p className="text-xs text-text-muted max-w-xl">
                        Wird unter deine versendeten Mails gesetzt — z.&nbsp;B. unter Zugangs-Anfragen
                        an Großhändler. Reiner Text, Zeilenumbrüche bleiben erhalten.
                    </p>
                </div>

                {profileQ.isLoading ? (
                    <LoadingState label="Lade Profil…" />
                ) : (
                    <>
                        <Label htmlFor="signature" className="sr-only">
                            Signatur
                        </Label>
                        <Textarea
                            id="signature"
                            value={signature}
                            onChange={(e) => setSignatureDraft(e.target.value)}
                            rows={8}
                            placeholder={SIGNATURE_PLACEHOLDER}
                            className="text-sm leading-relaxed"
                        />
                        <div className="mt-3 flex items-center justify-end gap-2">
                            {dirty && <span className="text-xs text-text-muted">Ungespeicherte Änderungen</span>}
                            <Button onClick={() => void handleSave()} disabled={!dirty || saving}>
                                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                {saving ? 'Speichere…' : 'Signatur speichern'}
                            </Button>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
