/**
 * ForcePasswordChangeView — Erzwungener Passwortwechsel nach Erst-Login.
 *
 * Das Backend gated JEDEN /api/admin/*-Call mit 403 PASSWORD_CHANGE_REQUIRED,
 * solange must_change_password=1 (Middleware requireAdminPasswordChanged).
 * Diese View ruft ausschließlich /api/admin-auth/change-password auf —
 * dieser Endpoint ist bewusst NICHT gegated.
 *
 * Client-Validierung spiegelt die Backend-Messlatte der Tenant-Anlage:
 * min. 8 Zeichen, Groß-/Kleinbuchstabe, Ziffer, Sonderzeichen.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePassword } from '@/api/auth';
import { isApiError } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { parseError } from '@/utils/error/parseError';

// Backend-Regeln bei Tenant-Anlage — gleiche Messlatte hier im Client.
function validateNewPassword(pw: string): string[] {
    const errors: string[] = [];
    if (pw.length < 8) errors.push('Mindestens 8 Zeichen.');
    if (!/[a-z]/.test(pw)) errors.push('Mindestens ein Kleinbuchstabe.');
    if (!/[A-Z]/.test(pw)) errors.push('Mindestens ein Großbuchstabe.');
    if (!/\d/.test(pw)) errors.push('Mindestens eine Ziffer.');
    if (!/[^A-Za-z0-9]/.test(pw)) errors.push('Mindestens ein Sonderzeichen.');
    return errors;
}

interface PasswordFieldProps {
    id: string;
    label: string;
    value: string;
    autoComplete: string;
    onChange: (value: string) => void;
    invalid?: boolean;
}

function PasswordField({ id, label, value, autoComplete, onChange, invalid }: PasswordFieldProps): JSX.Element {
    const [visible, setVisible] = useState(false);
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="relative">
                <Input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    autoComplete={autoComplete}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-invalid={invalid || undefined}
                    className="pr-10"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary focus-visible:outline-none"
                >
                    {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
            </div>
        </div>
    );
}

export default function ForcePasswordChangeView(): JSX.Element {
    const nav = useNavigate();
    const { markPasswordChanged, logout } = useAuth();

    const [current, setCurrent] = useState('');
    const [pw, setPw] = useState('');
    const [pw2, setPw2] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pwErrors = useMemo(() => validateNewPassword(pw), [pw]);
    const matches = pw === pw2 && pw.length > 0;
    const sameAsCurrent = pw.length > 0 && pw === current;
    const canSubmit =
        current.length > 0 && pwErrors.length === 0 && matches && !sameAsCurrent && !busy;

    async function submit(e: React.FormEvent): Promise<void> {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setError(null);
        try {
            const res = await changePassword(current, pw);
            if (res.success === false) {
                setError(res.message || 'Passwortwechsel fehlgeschlagen.');
                return;
            }
            toast.success('Passwort geändert. Willkommen!');
            // Guard entschärfen, BEVOR wir navigieren — sonst leitet
            // RequirePasswordChanged sofort wieder hierher zurück.
            markPasswordChanged();
            nav('/', { replace: true });
        } catch (err) {
            if (isApiError(err) && (err.status === 401 || err.status === 403)) {
                setError('Aktuelles Passwort falsch.');
            } else {
                setError(parseError(err).message || 'Passwortwechsel fehlgeschlagen.');
            }
        } finally {
            setBusy(false);
        }
    }

    return (
        <main role="main" className="min-h-screen flex items-center justify-center bg-canvas px-4">
            <div className="w-full max-w-md rounded-md border border-border bg-surface/50 p-8">
                <header className="mb-6 text-center">
                    <h1 className="text-xl font-display font-semibold tracking-tight">
                        Passwort ändern erforderlich
                    </h1>
                    <p className="text-sm mt-2 text-text-secondary leading-relaxed">
                        Dein Konto verwendet noch das Initial-Passwort. Aus Sicherheitsgründen
                        musst du es jetzt ändern.
                    </p>
                </header>

                <form onSubmit={submit} className="space-y-4" noValidate>
                    <PasswordField
                        id="fpc-current"
                        label="Aktuelles Passwort"
                        autoComplete="current-password"
                        value={current}
                        onChange={setCurrent}
                    />

                    <div className="space-y-2">
                        <PasswordField
                            id="fpc-new"
                            label="Neues Passwort"
                            autoComplete="new-password"
                            value={pw}
                            onChange={setPw}
                            invalid={pw !== '' && pwErrors.length > 0}
                        />
                        {pw && pwErrors.length > 0 && (
                            <ul className="text-xs text-status-danger space-y-0.5 list-disc list-inside">
                                {pwErrors.map((err, idx) => (
                                    <li key={idx}>{err}</li>
                                ))}
                            </ul>
                        )}
                        {sameAsCurrent && (
                            <p className="text-xs text-status-danger">
                                Das neue Passwort muss sich vom aktuellen unterscheiden.
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <PasswordField
                            id="fpc-repeat"
                            label="Wiederholung"
                            autoComplete="new-password"
                            value={pw2}
                            onChange={setPw2}
                            invalid={pw2 !== '' && !matches}
                        />
                        {pw2 && !matches && (
                            <p className="text-xs text-status-danger">Passwörter stimmen nicht überein.</p>
                        )}
                    </div>

                    {error && (
                        <div role="alert" className="text-sm text-status-danger">
                            {error}
                        </div>
                    )}

                    <Button type="submit" className="w-full" disabled={!canSubmit}>
                        {busy ? 'Ändere Passwort…' : 'Passwort ändern'}
                    </Button>
                </form>

                <div className="mt-6 text-center text-xs">
                    <button
                        type="button"
                        onClick={() => void logout()}
                        className="hover:underline text-text-muted"
                    >
                        Abmelden
                    </button>
                </div>
            </div>
        </main>
    );
}
