/**
 * AdminCreateDialog — modal to create a new admin user.
 *
 * Email-Templates: feature deferred (no API surface yet).
 */
import { useMemo, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateAdmin } from '@/hooks/useAdmins';
import { validateEmail } from '@/utils/validation/email';
import { generateSecurePassword, validatePassword } from '@/utils/validation/password';
import { copyToClipboard } from '@/utils/clipboard';
import type { AdminRole } from '@/api/types';

interface AdminCreateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function AdminCreateDialog({
    open,
    onOpenChange,
}: AdminCreateDialogProps): JSX.Element {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<AdminRole>('SUPPORT_ADMIN');
    const [generatedPw, setGeneratedPw] = useState(() => generateSecurePassword());
    const [busy, setBusy] = useState(false);
    const submittingRef = useRef(false);
    const createMut = useCreateAdmin();

    const emailCheck = useMemo(() => validateEmail(email), [email]);
    const pwCheck = useMemo(() => validatePassword(generatedPw), [generatedPw]);
    const canSubmit = username.trim().length > 0 && emailCheck.valid && pwCheck.valid;

    async function submit(): Promise<void> {
        if (submittingRef.current) return; // double-click / double-fire guard
        submittingRef.current = true;
        setBusy(true);
        try {
            await createMut.mutateAsync({
                username: username.trim(),
                email,
                password: generatedPw,
                role,
            });
            toast.success(`Admin "${username}" angelegt.`, { duration: 8000 });
            const ok = await copyToClipboard(generatedPw);
            if (ok) toast.message('Passwort in Zwischenablage kopiert.');
            setUsername('');
            setEmail('');
            setGeneratedPw(generateSecurePassword());
            onOpenChange(false);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen.');
        } finally {
            submittingRef.current = false;
            setBusy(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Neuer Admin</DialogTitle>
                    <DialogDescription>
                        Der Admin erhält eine Einladungs-Email mit dem auto-generierten Passwort.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="a-username">Username</Label>
                        <Input
                            id="a-username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="a-email">Email</Label>
                        <Input
                            id="a-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        {email && !emailCheck.valid && (
                            <p className="text-xs text-danger">{emailCheck.errors[0]}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="a-role">Rolle</Label>
                        <select
                            id="a-role"
                            value={role}
                            onChange={(e) => setRole(e.target.value as AdminRole)}
                            className="h-10 w-full px-3 rounded-md border border-border bg-surface text-sm"
                        >
                            <option value="SUPPORT_ADMIN">Support Admin</option>
                            <option value="SUPER_ADMIN">Super Admin</option>
                            <option value="READ_ONLY">Read-Only</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label>Auto-generiertes Passwort</Label>
                        <div className="flex gap-2">
                            <Input value={generatedPw} readOnly className="font-mono" />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    const ok = await copyToClipboard(generatedPw);
                                    if (ok) toast.success('Kopiert.');
                                }}
                            >
                                <Copy className="size-3" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setGeneratedPw(generateSecurePassword())}
                            >
                                Neu
                            </Button>
                        </div>
                        {!pwCheck.valid && pwCheck.errors.length > 0 && (
                            <ul
                                className="text-xs text-danger mt-1 space-y-0.5"
                                role="alert"
                            >
                                {pwCheck.errors.map((e, i) => (
                                    <li key={i}>{e}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        Abbrechen
                    </Button>
                    <Button onClick={() => void submit()} disabled={!canSubmit || busy}>
                        {busy ? 'Erstelle…' : 'Admin anlegen'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
