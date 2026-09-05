import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Copy } from 'lucide-react';
import { apiFetch } from '@/api/client';
import { changePassword } from '@/api/auth';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validatePassword } from '@/utils/validation/password';
import { copyToClipboard } from '@/utils/clipboard';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';

export function AccountSecurity(): JSX.Element {
    const { logout } = useAuth();
    const qc = useQueryClient();
    const status = useQuery({ queryKey: ['admin', 'mfa'], queryFn: () => apiFetch<{ enabled: boolean }>('/api/admin-auth/mfa') });
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [repeat, setRepeat] = useState('');
    const [enrollPassword, setEnrollPassword] = useState('');
    const [enrollment, setEnrollment] = useState<{ secret: string; otpauth_url: string } | null>(null);
    const [code, setCode] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [backupsSaved, setBackupsSaved] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<{ area: string; message: string } | null>(null);
    const [notice, setNotice] = useState('');
    useBeforeUnload(backupCodes.length > 0 && !backupsSaved);

    async function run(area: string, action: () => Promise<void>): Promise<void> {
        setBusy(area); setError(null);
        try { await action(); } catch (err) { setError({ area, message: err instanceof Error ? err.message : 'Die Änderung konnte nicht gespeichert werden.' }); }
        finally { setBusy(null); }
    }
    const passwordCheck = validatePassword(next);
    return <div className="mb-8 grid items-start gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-5"><h2 className="flex items-center gap-2 text-base font-semibold"><ShieldCheck size={18} />Zwei-Faktor-Anmeldung</h2><p className="mt-2 text-sm leading-relaxed text-text-secondary">Schütze deinen internen Zugang mit einer Authenticator-App. Die Einstellung gilt für alle für dich freigegebenen Partsunion-Anwendungen.</p>
            {status.isLoading ? <p className="mt-4 text-sm text-text-muted">Sicherheitsstatus wird geladen…</p> : status.error ? <div role="alert" className="mt-4 text-sm text-danger">Status konnte nicht geladen werden. <button type="button" onClick={() => void status.refetch()} className="underline">Erneut prüfen</button></div> : <>
                {status.data?.enabled && <p className="mt-4 rounded-md border border-success/20 bg-success/5 p-3 text-sm text-success">Zwei-Faktor-Anmeldung ist aktiviert.</p>}
                {!status.data?.enabled && !enrollment && <form className="mt-5 space-y-3" onSubmit={event => { event.preventDefault(); void run('mfa', async () => { const result = await apiFetch<{ secret: string; otpauth_url: string }>('/api/admin-auth/mfa/enroll', { method: 'POST', body: JSON.stringify({ password: enrollPassword }), silentAuth: true }); setEnrollment(result); setEnrollPassword(''); }); }}><Label htmlFor="enroll-password">Aktuelles Passwort bestätigen</Label><Input id="enroll-password" type="password" autoComplete="current-password" value={enrollPassword} onChange={e => setEnrollPassword(e.target.value)} required /><Button type="submit" disabled={busy !== null || !enrollPassword}>{busy === 'mfa' ? 'Wird vorbereitet…' : 'Authenticator einrichten'}</Button></form>}
                {enrollment && !status.data?.enabled && <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); void run('mfa', async () => { const result = await apiFetch<{ enabled: boolean; backup_codes: string[] }>('/api/admin-auth/mfa/confirm', { method: 'POST', body: JSON.stringify({ code }), silentAuth: true }); setBackupCodes(result.backup_codes); setEnrollment(null); setCode(''); qc.setQueryData(['admin', 'mfa'], { enabled: result.enabled }); }); }}><p className="text-sm text-text-secondary">Füge in deiner Authenticator-App ein zeitbasiertes Konto mit diesem Einrichtungsschlüssel hinzu:</p><code className="block break-all rounded-md border border-border bg-elevated p-3 text-sm">{enrollment.secret}</code><Button variant="outline" type="button" onClick={async () => { if (await copyToClipboard(enrollment.secret)) setNotice('Einrichtungsschlüssel kopiert.'); }}><Copy size={14} className="mr-2" />Schlüssel kopieren</Button><div className="space-y-2"><Label htmlFor="mfa-confirm">Sechsstelliger Code aus der App</Label><Input id="mfa-confirm" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required /></div><Button type="submit" disabled={busy !== null || code.length !== 6}>Aktivierung bestätigen</Button></form>}
            </>}
            {backupCodes.length > 0 && <div className="mt-5 space-y-3"><p className="text-sm font-semibold">Wiederherstellungscodes sicher aufbewahren</p><p className="text-xs leading-relaxed text-text-secondary">Jeder Code ist einmal verwendbar, wenn die Authenticator-App nicht verfügbar ist. Diese Codes werden nur jetzt angezeigt.</p><code className="grid grid-cols-2 gap-2 rounded-md border border-border bg-elevated p-3 text-sm">{backupCodes.map(value => <span key={value}>{value}</span>)}</code><Button type="button" variant="outline" onClick={async () => { if (await copyToClipboard(backupCodes.join('\n'))) setNotice('Wiederherstellungscodes kopiert.'); }}>Codes kopieren</Button><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={backupsSaved} onChange={e => setBackupsSaved(e.target.checked)} className="mt-1" />Ich habe die Codes sicher gespeichert.</label>{backupsSaved && <Button type="button" variant="outline" onClick={() => setBackupCodes([])}>Codes ausblenden</Button>}</div>}
            {notice && <p role="status" className="mt-3 text-xs text-text-muted">{notice}</p>}
            {error?.area === 'mfa' && <p role="alert" className="mt-4 text-sm text-danger">{error.message}</p>}
        </section>
        <section className="rounded-lg border border-border bg-surface p-5"><h2 className="text-base font-semibold">Passwort ändern</h2><p className="mt-2 text-sm leading-relaxed text-text-secondary">Nach der Änderung meldest du dich mit deinem neuen Passwort erneut an.</p><form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); void run('password', async () => { await changePassword(current, next); setCurrent(''); setNext(''); setRepeat(''); await logout(); }); }}>
            <div className="space-y-2"><Label htmlFor="security-current">Aktuelles Passwort</Label><Input id="security-current" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="security-next">Neues Passwort</Label><Input id="security-next" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} required />{next && !passwordCheck.valid && <p className="text-xs text-danger">{passwordCheck.errors.join(' ')}</p>}</div>
            <div className="space-y-2"><Label htmlFor="security-repeat">Neues Passwort wiederholen</Label><Input id="security-repeat" type="password" autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} required />{repeat && repeat !== next && <p className="text-xs text-danger">Die Passwörter stimmen nicht überein.</p>}</div>
            {error?.area === 'password' && <p role="alert" className="text-sm text-danger">{error.message}</p>}
            <Button type="submit" disabled={busy !== null || !current || !passwordCheck.valid || next !== repeat}>{busy === 'password' ? 'Wird geändert…' : 'Passwort ändern'}</Button>
        </form></section>
    </div>;
}
