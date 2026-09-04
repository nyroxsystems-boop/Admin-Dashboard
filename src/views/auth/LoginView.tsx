/**
 * LoginView — Admin login (public, no AdminLayout).
 *
 * Visuell 1:1 identisch zum CRM-Login (CRM-System/src/app/components/Login.tsx).
 * Gleiche Tailwind-Klassen, gleiche Inline-Styles, gleiche shadcn-Inputs.
 * Einziger inhaltlicher Unterschied: Titel „Partsunion · Admin" statt „· CRM".
 *
 * The backend `/admin/login` endpoint accepts the same identifier field
 * (`username` in the JSON payload) for both an admin username AND an
 * email address — pick whichever the operator stored.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, User } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { resetAuthExpired } from '@/api/client';
import { parseError } from '@/utils/error/parseError';

/**
 * Fehlermeldung der Anmeldung — nach Ursache getrennt.
 *
 * ─── Warum das nötig ist ───────────────────────────────────────────────────
 *
 * Vorher stand hier `parseError(err).message || 'Anmeldung fehlgeschlagen.'`.
 * Damit sahen drei völlig verschiedene Lagen gleich aus:
 *
 *   falsches Kennwort      → man versucht es nochmal, richtig so
 *   Sperre nach 15 Fehlversuchen → nochmal versuchen ist ZWECKLOS und
 *                            verlängert nichts, aber man weiss es nicht
 *   Server nicht erreichbar → am Kennwort liegt es gar nicht
 *
 * Der zweite Fall ist der bösartige: die Bremse greift pro IP für 15 Minuten,
 * und dann scheitert AUCH das richtige Kennwort. Wer das nicht weiss, hält
 * seine Zugangsdaten für falsch und probiert weiter — was die Sperre bei
 * jedem Versuch aufs Neue bestätigt.
 *
 * Genau das ist hier passiert: der Zähler stand bei 11 von 15 Versuchen, und
 * die Meldung sagte die ganze Zeit "Ungültige Anmeldedaten".
 */
function anmeldeFehler(err: unknown): string {
    const { message, status } = parseError(err);

    if (status === 429) {
        return 'Zu viele Anmeldeversuche. Aus Sicherheitsgründen ist die Anmeldung '
            + 'für 15 Minuten gesperrt — auch mit dem richtigen Kennwort. Bitte warten.';
    }
    if (status === 401) {
        return 'Benutzername oder Kennwort stimmt nicht.';
    }
    if (status === 403) {
        return 'Die Anmeldung wurde abgewiesen. Falls das bestehen bleibt, ist es kein '
            + 'Kennwortproblem — bitte melden.';
    }
    if (status && status >= 500) {
        return 'Der Server antwortet gerade nicht. Am Kennwort liegt es nicht.';
    }
    /**
     * Ohne Status: Netzfehler oder eine Antwort, die nicht zum erwarteten
     * Aufbau passt. Der Rohtext wird MITGEGEBEN statt verschluckt — genau so
     * eine Meldung ("API response validation failed: access: Required") hat
     * die Ursache des Anmeldefehlers am 2026-08-02 sichtbar gemacht. Ohne sie
     * hätte "Ungültige Anmeldedaten" weiter auf das Kennwort gezeigt.
     */
    return message
        ? `Anmeldung fehlgeschlagen: ${message}`
        : 'Anmeldung fehlgeschlagen.';
}

export default function LoginView(): JSX.Element {
    const nav = useNavigate();
    const [params] = useSearchParams();
    const { login } = useAuth();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const trimmed = identifier.trim();
    const canSubmit = trimmed.length >= 3 && password.length > 0 && !busy;

    useEffect(() => {
        // Re-arm the auth-expired latch when user reaches the login page,
        // so future 401s after re-auth can fire navigate exactly once.
        resetAuthExpired();
    }, []);

    async function submit(e: React.FormEvent): Promise<void> {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setError(null);
        try {
            await login(trimmed, password);
            const redirectParam = params.get('redirect');
            let redirect = '/';
            if (redirectParam) {
                try {
                    const decoded = decodeURIComponent(redirectParam);
                    // Sicherheits-Check: nur same-origin path, kein vollständiger URL
                    if (decoded.startsWith('/') && !decoded.startsWith('//')) {
                        redirect = decoded;
                    }
                } catch {
                    // malformed → fallback /
                }
            }
            nav(redirect, { replace: true });
        } catch (err) {
            setError(anmeldeFehler(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <main
            role="main"
            className="min-h-screen flex items-center justify-center px-4"
            style={{ background: 'hsl(var(--bg-canvas))' }}
        >
            <div
                className="w-full max-w-md rounded-md p-8"
                style={{
                    background: 'hsl(var(--bg-surface) / 0.5)',
                    border: '1px solid hsl(var(--text-primary) / 0.12)',
                }}
            >
                <header className="mb-6 text-center">
                    <h1
                        className="text-xl font-semibold tracking-tight"
                        style={{
                            color: 'hsl(var(--text-primary))',
                            fontFamily: '"Inter Display", "Inter", system-ui, sans-serif',
                            letterSpacing: '-0.01em',
                        }}
                    >
                        Partsunion · Admin
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'hsl(var(--text-secondary))' }}>
                        Bitte melde dich an.
                    </p>
                </header>

                <form onSubmit={submit} className="space-y-4" noValidate>
                    <div className="space-y-2">
                        <Label htmlFor="login-id" style={{ color: 'hsl(var(--text-primary))' }}>
                            Benutzername oder E-Mail
                        </Label>
                        <div className="relative">
                            <User
                                className="size-4 absolute left-3 top-1/2 -translate-y-1/2 z-10"
                                style={{ color: 'hsl(var(--text-muted))' }}
                            />
                            <Input
                                id="login-id"
                                type="text"
                                autoComplete="username"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                className="pl-9 focus-visible:ring-2"
                                placeholder="admin oder admin@partsunion.de"
                                autoCapitalize="off"
                                autoCorrect="off"
                                spellCheck={false}
                                required
                                style={{
                                    background: 'hsl(var(--bg-canvas))',
                                    border: '1px solid hsl(var(--text-primary) / 0.12)',
                                    color: 'hsl(var(--text-primary))',
                                    height: '40px',
                                    borderRadius: '8px',
                                }}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="login-pw" style={{ color: 'hsl(var(--text-primary))' }}>
                            Passwort
                        </Label>
                        <div className="relative">
                            <Lock
                                className="size-4 absolute left-3 top-1/2 -translate-y-1/2 z-10"
                                style={{ color: 'hsl(var(--text-muted))' }}
                            />
                            <Input
                                id="login-pw"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="pl-9 focus-visible:ring-2"
                                style={{
                                    background: 'hsl(var(--bg-canvas))',
                                    border: '1px solid hsl(var(--text-primary) / 0.12)',
                                    color: 'hsl(var(--text-primary))',
                                    height: '40px',
                                    borderRadius: '8px',
                                }}
                            />
                        </div>
                    </div>

                    {error && (
                        <div role="alert" className="text-sm" style={{ color: 'hsl(var(--danger))' }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{
                            background: 'hsl(var(--accent-500))',
                            color: 'hsl(0 0% 100%)',
                            height: '40px',
                            paddingLeft: '16px',
                            paddingRight: '16px',
                        }}
                    >
                        {busy ? 'Anmelden…' : 'Anmelden'}
                    </button>
                </form>

                <div className="mt-6 text-center text-xs" style={{ color: 'hsl(var(--text-muted))' }}>
                    <a
                        href="/reset-password"
                        className="hover:underline"
                        style={{ color: 'hsl(var(--text-muted))' }}
                    >
                        Passwort vergessen?
                    </a>
                </div>
            </div>
        </main>
    );
}
