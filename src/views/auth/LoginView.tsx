/**
 * LoginView — Admin login (public, no AdminLayout).
 *
 * The backend `/admin/login` endpoint accepts the same identifier field
 * (`username` in the JSON payload) for both an admin username AND an
 * email address — pick whichever the operator stored. We therefore do
 * NOT enforce email-only validation; only "non-empty, trimmed, ≥3 chars".
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { resetAuthExpired } from '@/api/client';
import { parseError } from '@/utils/error/parseError';

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
            setError(parseError(err).message || 'Anmeldung fehlgeschlagen.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <main
            role="main"
            className="min-h-screen flex items-center justify-center bg-canvas px-4"
        >
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-md rounded-md border border-border bg-surface/50 p-8"
            >
                <header className="mb-6 text-center">
                    <h1 className="text-xl font-display font-semibold tracking-tight">Partsunion · Admin</h1>
                    <p className="text-sm text-text-secondary">Bitte melde dich an.</p>
                </header>

                <form onSubmit={submit} className="space-y-4" noValidate>
                    <div className="space-y-2">
                        <Label htmlFor="login-id">Benutzername oder E-Mail</Label>
                        <div className="relative">
                            <User className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <Input
                                id="login-id"
                                type="text"
                                autoComplete="username"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                className="pl-9 focus-visible:ring-2 focus-visible:ring-accent-500/40"
                                placeholder="admin oder admin@partsunion.de"
                                autoCapitalize="off"
                                autoCorrect="off"
                                spellCheck={false}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="login-pw">Passwort</Label>
                        <div className="relative">
                            <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <Input
                                id="login-pw"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-9 focus-visible:ring-2 focus-visible:ring-accent-500/40"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div role="alert" className="text-sm text-danger">
                            {error}
                        </div>
                    )}

                    <Button type="submit" className="w-full" disabled={!canSubmit}>
                        {busy ? 'Anmelden…' : 'Anmelden'}
                    </Button>
                </form>

                <div className="mt-6 text-center text-xs text-text-muted">
                    <a href="/reset-password" className="hover:underline">
                        Passwort vergessen?
                    </a>
                </div>
            </motion.div>
        </main>
    );
}
