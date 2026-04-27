/**
 * PasswordResetView — Token-based password reset.
 *
 * Improvements vs. legacy:
 *   - Token format validated client-side before submit
 *   - Real-time password validation with strength indicator
 *   - Inline errors instead of toast-only
 */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validatePassword } from '@/utils/validation/password';
import { parseError } from '@/utils/error/parseError';
import { resetPassword } from '@/api/auth';

const TOKEN_RE = /^[A-Za-z0-9_-]{32,}$/;

export default function PasswordResetView(): JSX.Element {
    const nav = useNavigate();
    const [params] = useSearchParams();
    const tokenFromUrl = params.get('token') ?? '';

    const [token, setToken] = useState(tokenFromUrl);
    const [pw, setPw] = useState('');
    const [pw2, setPw2] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const tokenValid = TOKEN_RE.test(token);
    const pwCheck = useMemo(() => validatePassword(pw), [pw]);
    const matches = pw === pw2 && pw.length > 0;
    const canSubmit = tokenValid && pwCheck.valid && matches && !busy;

    async function submit(e: React.FormEvent): Promise<void> {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setError(null);
        try {
            await resetPassword(token, pw);
            setSuccess(true);
            setTimeout(() => nav('/login'), 1500);
        } catch (err) {
            setError(parseError(err).message || 'Reset fehlgeschlagen.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <main role="main" className="min-h-screen flex items-center justify-center bg-canvas px-4">
            <div className="w-full max-w-md rounded-md border border-border bg-surface/50 p-8">
                <header className="mb-6 text-center">
                    <h1 className="text-xl font-display font-semibold tracking-tight">Passwort zurücksetzen</h1>
                </header>

                {success ? (
                    <p className="text-sm text-success text-center">
                        Passwort gesetzt. Du wirst zum Login weitergeleitet…
                    </p>
                ) : (
                    <form onSubmit={submit} className="space-y-4" noValidate>
                        <div className="space-y-2">
                            <Label htmlFor="r-token">Token</Label>
                            <Input
                                id="r-token"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                aria-invalid={token !== '' && !tokenValid}
                            />
                            {token && !tokenValid && (
                                <p className="text-xs text-danger">Token-Format ungültig.</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="r-pw">Neues Passwort</Label>
                            <Input id="r-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
                            {pw && !pwCheck.valid && (
                                <ul className="text-xs text-danger space-y-0.5 list-disc list-inside">
                                    {pwCheck.errors.map((err, idx) => (
                                        <li key={idx}>{err}</li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="r-pw2">Wiederholung</Label>
                            <Input id="r-pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
                            {pw2 && !matches && <p className="text-xs text-danger">Passwörter stimmen nicht überein.</p>}
                        </div>

                        {error && (
                            <div role="alert" className="text-sm text-danger">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={!canSubmit}>
                            {busy ? 'Setze Passwort…' : 'Passwort speichern'}
                        </Button>
                    </form>
                )}
            </div>
        </main>
    );
}
