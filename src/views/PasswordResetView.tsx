/**
 * Password Reset View for Admin Dashboard
 * Handles both request and confirmation flows
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowLeft, Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { requestPasswordReset, resetPassword } from '../api/wws';
import { toast } from 'sonner';

interface Props {
    onBack: () => void;
    resetToken?: string;
}

export function PasswordResetView({ onBack, resetToken }: Props) {
    const [mode, setMode] = useState<'request' | 'reset'>(resetToken ? 'reset' : 'request');
    const [username, setUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (resetToken) {
            setMode('reset');
        }
    }, [resetToken]);

    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username) {
            setError('Bitte geben Sie Ihren Benutzernamen ein');
            return;
        }

        setIsLoading(true);
        try {
            await requestPasswordReset(username);
            setSuccess(true);
            toast.success('Reset-Link wurde versendet');
        } catch (err: any) {
            setError(err.message || 'Anfrage fehlgeschlagen');
        } finally {
            setIsLoading(false);
        }
    };

    // Password complexity validation
    const validatePassword = (password: string): string | null => {
        if (password.length < 12) return 'Passwort muss mindestens 12 Zeichen haben';
        if (!/[A-Z]/.test(password)) return 'Mindestens ein Großbuchstabe erforderlich';
        if (!/[a-z]/.test(password)) return 'Mindestens ein Kleinbuchstabe erforderlich';
        if (!/[0-9]/.test(password)) return 'Mindestens eine Zahl erforderlich';
        if (!/[^A-Za-z0-9]/.test(password)) return 'Mindestens ein Sonderzeichen erforderlich';
        return null;
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!newPassword || !confirmPassword) {
            setError('Bitte füllen Sie alle Felder aus');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwörter stimmen nicht überein');
            return;
        }

        const pwError = validatePassword(newPassword);
        if (pwError) {
            setError(pwError);
            return;
        }

        if (!resetToken) {
            setError('Kein Reset-Token vorhanden. Bitte fordern Sie einen neuen Link an.');
            return;
        }
        setIsLoading(true);
        try {
            await resetPassword(resetToken, newPassword);
            setSuccess(true);
            toast.success('Passwort erfolgreich geändert');
            setTimeout(() => onBack(), 2000);
        } catch (err: any) {
            setError(err.message || 'Zurücksetzen fehlgeschlagen');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-light rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            {/* Card */}
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="relative z-10 w-full max-w-md mx-4"
            >
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="px-8 pt-8 pb-4">
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm mb-6"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Zurück zum Login
                        </button>

                        <div className="flex justify-center mb-6">
                            <div className={`w-16 h-16 ${success ? 'bg-success' : 'bg-gradient-to-br from-primary to-primary/70'} rounded-2xl flex items-center justify-center shadow-xl`}>
                                {success ? (
                                    <CheckCircle className="w-8 h-8 text-white" />
                                ) : mode === 'request' ? (
                                    <Mail className="w-8 h-8 text-white" />
                                ) : (
                                    <Lock className="w-8 h-8 text-white" />
                                )}
                            </div>
                        </div>

                        <h1 className="text-2xl font-bold text-white text-center mb-2">
                            {success
                                ? mode === 'request' ? 'E-Mail gesendet!' : 'Passwort geändert!'
                                : mode === 'request' ? 'Passwort vergessen?' : 'Neues Passwort setzen'
                            }
                        </h1>
                        <p className="text-white/60 text-sm text-center">
                            {success
                                ? mode === 'request'
                                    ? 'Prüfen Sie Ihre E-Mails für den Reset-Link.'
                                    : 'Sie werden zum Login weitergeleitet...'
                                : mode === 'request'
                                    ? 'Geben Sie Ihren Benutzernamen ein.'
                                    : 'Wählen Sie ein sicheres neues Passwort.'
                            }
                        </p>
                    </div>

                    {/* Form */}
                    {!success && (
                        <form onSubmit={mode === 'request' ? handleRequestReset : handleResetPassword} className="px-8 pb-8 space-y-5">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-2 p-3 bg-danger-light border border-destructive/20 rounded-xl text-danger text-sm"
                                >
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </motion.div>
                            )}

                            {mode === 'request' ? (
                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-white/70 uppercase tracking-wider">
                                        Benutzername
                                    </label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-brand transition-colors" />
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="z.B. Elias"
                                            className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="block text-xs font-medium text-white/70 uppercase tracking-wider">
                                            Neues Passwort
                                        </label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-brand transition-colors" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="Min. 12 Zeichen, Groß-/Kleinbuchstaben, Zahl, Sonderzeichen"
                                                className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-xs font-medium text-white/70 uppercase tracking-wider">
                                            Passwort bestätigen
                                        </label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-brand transition-colors" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Passwort wiederholen"
                                                className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <motion.button
                                type="submit"
                                disabled={isLoading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-4 bg-gradient-to-r from-primary to-primary/80 hover:brightness-110 text-white font-semibold rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    mode === 'request' ? 'Reset-Link anfordern' : 'Passwort ändern'
                                )}
                            </motion.button>
                        </form>
                    )}

                    {/* Success Actions */}
                    {success && mode === 'request' && (
                        <div className="px-8 pb-8">
                            <button
                                onClick={onBack}
                                className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all"
                            >
                                Zurück zum Login
                            </button>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="px-8 py-5 bg-white/5 border-t border-white/10 text-center">
                        <div className="flex items-center justify-center gap-2 text-white/40 text-xs">
                            <span>Powered by</span>
                            <span className="text-brand font-semibold">Partsunion</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default PasswordResetView;
