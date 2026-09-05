import { useEffect, useRef, useState } from 'react';
import { registerStepUpHandler } from '@/lib/stepUp';
import { apiFetch } from '@/api/client';
import { parseError } from '@/utils/error/parseError';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function StepUpDialog(): JSX.Element {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [needsMfa, setNeedsMfa] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const resolution = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);
    useEffect(() => {
        const unregister = registerStepUpHandler(() => new Promise<void>((resolve, reject) => {
            resolution.current = { resolve, reject }; setError(''); setPassword(''); setCode(''); setOpen(true);
        }));
        return () => { unregister(); resolution.current?.reject(new Error('Sicherheitsbestätigung abgebrochen.')); resolution.current = null; };
    }, []);
    const mfa = needsMfa || user?.mfa_enabled;
    function cancel(): void { if (busy) return; resolution.current?.reject(new Error('Aktion abgebrochen. Es wurde nichts geändert.')); resolution.current = null; setOpen(false); setPassword(''); setCode(''); }
    return <Dialog open={open} onOpenChange={value => { if (!value) cancel(); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Aktion sicher bestätigen</DialogTitle><DialogDescription>Für diese Änderung ist eine erneute Bestätigung deiner Identität erforderlich. Danach wird die angeforderte Aktion ausgeführt.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try {
            await apiFetch('/api/admin-auth/step-up', { method: 'POST', body: JSON.stringify({ password, ...(code.trim() ? { totp_code: code.trim() } : {}) }), silentAuth: true });
            resolution.current?.resolve(); resolution.current = null; setOpen(false); setPassword(''); setCode('');
        } catch (err) { const parsed = parseError(err); if (parsed.code === 'MFA_REQUIRED' || parsed.code === 'MFA_INVALID') { setNeedsMfa(true); setError(parsed.code === 'MFA_INVALID' ? 'Der Sicherheitscode ist ungültig oder bereits verwendet.' : 'Bitte bestätige zusätzlich deinen Sicherheitscode.'); } else setError(parsed.message); } finally { setBusy(false); } }}>
            <div className="space-y-2"><Label htmlFor="stepup-password">Aktuelles Passwort</Label><Input id="stepup-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus disabled={busy} /></div>
            {mfa && <div className="space-y-2"><Label htmlFor="stepup-code">Sicherheits- oder Wiederherstellungscode</Label><Input id="stepup-code" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} required disabled={busy} /></div>}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={cancel} disabled={busy}>Abbrechen</Button><Button type="submit" disabled={busy || !password || Boolean(mfa && !code.trim())}>{busy ? 'Wird geprüft…' : 'Bestätigen und fortsetzen'}</Button></div>
        </form>
    </DialogContent></Dialog>;
}
