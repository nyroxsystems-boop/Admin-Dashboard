import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validatePassword } from '@/utils/validation/password';
import { parseError } from '@/utils/error/parseError';
import { requestPasswordReset, resetPassword } from '@/api/auth';

const TOKEN_RE = /^[A-Za-z0-9_-]{32,}$/;

export default function PasswordResetView(): JSX.Element {
    const location = useLocation();
    const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token')
        ?? new URLSearchParams(location.search).get('token') ?? '');
    const [identifier, setIdentifier] = useState('');
    const [pw, setPw] = useState('');
    const [pw2, setPw2] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const pwCheck = useMemo(() => validatePassword(pw), [pw]);
    const completing = token.length > 0;
    const invalidToken = completing && !TOKEN_RE.test(token);
    const canSubmit = !busy && (completing
        ? !invalidToken && pwCheck.valid && pw === pw2
        : identifier.trim().length >= 3);

    async function submit(event: React.FormEvent): Promise<void> {
        event.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setError(null);
        try {
            if (completing) await resetPassword(token, pw);
            else await requestPasswordReset(identifier.trim());
            setSuccess(true);
            setPw('');
            setPw2('');
        } catch (err) {
            setError(parseError(err).message || 'Die Anfrage konnte nicht abgeschlossen werden.');
        } finally { setBusy(false); }
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-canvas px-4 py-12">
            <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8 shadow-sm">
                <p className="mb-6 text-sm font-semibold text-accent-500">Partsunion Admin</p>
                <h1 className="text-2xl font-semibold">{completing ? 'Neues Passwort festlegen' : 'Passwort vergessen?'}</h1>
                <p className="mt-2 mb-6 text-sm leading-relaxed text-text-secondary">
                    {completing ? 'Nach der Änderung werden bestehende Sitzungen abgemeldet.'
                        : 'Gib deine E-Mail-Adresse oder deinen Benutzernamen ein. Du erhältst einen Link zum Zurücksetzen.'}
                </p>
                {success ? (
                    <div role="status" className="rounded-md border border-success/30 bg-success/5 p-4 text-sm">
                        {completing ? 'Dein Passwort wurde geändert. Du kannst dich jetzt neu anmelden.'
                            : 'Wenn ein passendes Konto existiert, erhältst du eine E-Mail. Prüfe auch deinen Spam-Ordner.'}
                    </div>
                ) : invalidToken ? (
                    <div role="alert" className="text-sm text-danger">Dieser Link ist ungültig. <Link to="/reset-password" reloadDocument className="underline">Neuen Link anfordern</Link></div>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        {completing ? <>
                            <div className="space-y-2">
                                <Label htmlFor="reset-password">Neues Passwort</Label>
                                <Input id="reset-password" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} required aria-describedby="password-requirements" />
                                <p id="password-requirements" className="text-xs text-text-muted">Verwende ein langes, einzigartiges Passwort.</p>
                                {pw && !pwCheck.valid && <ul className="list-disc pl-4 text-xs text-danger">{pwCheck.errors.map(message => <li key={message}>{message}</li>)}</ul>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reset-password-confirm">Passwort wiederholen</Label>
                                <Input id="reset-password-confirm" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} required aria-invalid={pw2 !== '' && pw !== pw2} />
                                {pw2 && pw !== pw2 && <p className="text-xs text-danger">Die Passwörter stimmen nicht überein.</p>}
                            </div>
                        </> : <div className="space-y-2">
                            <Label htmlFor="reset-identifier">E-Mail oder Benutzername</Label>
                            <Input id="reset-identifier" autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} required autoFocus />
                        </div>}
                        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                        <Button className="w-full" type="submit" disabled={!canSubmit}>{busy ? 'Bitte warten…' : completing ? 'Passwort speichern' : 'Link anfordern'}</Button>
                    </form>
                )}
                <Link to="/login" className="mt-6 inline-block text-sm font-medium text-accent-500 hover:underline">Zur Anmeldung</Link>
            </div>
        </main>
    );
}
