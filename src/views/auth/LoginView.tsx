/**
 * LoginView — Admin login (public, no AdminLayout).
 *
 * Cleanups vs. legacy:
 *   - login-input class replaced by Tailwind utilities with proper focus rings
 *   - Real-time email validation
 *   - Inline errors (not toast-only)
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { validateEmail } from '@/utils/validation/email';
import { parseError } from '@/utils/error/parseError';

export default function LoginView(): JSX.Element {
    const nav = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const emailCheck = useMemo(() => validateEmail(email), [email]);
    const canSubmit = emailCheck.valid && password.length > 0 && !busy;

    async function submit(e: React.FormEvent): Promise<void> {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setError(null);
        try {
            await login(email, password);
            nav('/');
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
                        <Label htmlFor="login-email">Email</Label>
                        <div className="relative">
                            <Mail className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <Input
                                id="login-email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-9 focus-visible:ring-2 focus-visible:ring-accent-500/40"
                                aria-invalid={email !== '' && !emailCheck.valid}
                                aria-describedby="login-email-err"
                                required
                            />
                        </div>
                        {email && !emailCheck.valid && (
                            <p id="login-email-err" className="text-xs text-danger">
                                {emailCheck.errors[0]}
                            </p>
                        )}
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
