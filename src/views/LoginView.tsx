/**
 * Login View for Admin Dashboard
 * Premium design with Partsunion branding
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, User, ArrowRight, Loader2, Eye, EyeOff, AlertCircle, Shield, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface Props {
    onForgotPassword?: () => void;
}

export function LoginView({ onForgotPassword }: Props) {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Track mouse for subtle gradient follow
    useEffect(() => {
        const handleMouse = (e: MouseEvent) => {
            setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
        };
        window.addEventListener('mousemove', handleMouse);
        return () => window.removeEventListener('mousemove', handleMouse);
    }, []);

    const getErrorMessage = (err: any): string => {
        const raw = err?.message || '';
        if (raw.includes('401') || raw.includes('Unauthorized') || raw.includes('Invalid')) {
            return 'Ungültige Anmeldedaten. Bitte überprüfen Sie Benutzername und Passwort.';
        }
        if (raw.includes('403') || raw.includes('Forbidden')) {
            return 'Zugriff verweigert. Ihr Konto ist möglicherweise gesperrt.';
        }
        if (raw.includes('429') || raw.includes('Too Many')) {
            return 'Zu viele Anmeldeversuche. Bitte warten Sie einen Moment.';
        }
        if (raw.includes('500') || raw.includes('Server')) {
            return 'Serverfehler. Bitte versuchen Sie es später erneut.';
        }
        if (raw.includes('network') || raw.includes('fetch') || raw.includes('Failed')) {
            return 'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.';
        }
        return 'Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError('Bitte füllen Sie alle Felder aus.');
            return;
        }

        setIsLoading(true);
        try {
            await login(username, password);
            toast.success('Willkommen zurück!');
        } catch (err: any) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{
                background: `
                    radial-gradient(ellipse at ${mousePos.x * 100}% ${mousePos.y * 100}%, hsla(221, 83%, 53%, 0.08) 0%, transparent 50%),
                    linear-gradient(135deg, hsl(225, 15%, 6%) 0%, hsl(225, 18%, 10%) 50%, hsl(225, 15%, 7%) 100%)
                `
            }}
        >
            {/* Animated Orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0], scale: [1, 1.1, 0.95, 1] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -top-32 -right-32 w-96 h-96 rounded-full"
                    style={{ background: 'radial-gradient(circle, hsla(221, 83%, 53%, 0.12) 0%, transparent 70%)' }}
                />
                <motion.div
                    animate={{ x: [0, -20, 30, 0], y: [0, 30, -20, 0], scale: [1, 0.95, 1.1, 1] }}
                    transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full"
                    style={{ background: 'radial-gradient(circle, hsla(260, 60%, 50%, 0.08) 0%, transparent 70%)' }}
                />
                <motion.div
                    animate={{ x: [0, 15, -15, 0], y: [0, -15, 15, 0] }}
                    transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute top-1/3 left-1/4 w-64 h-64 rounded-full"
                    style={{ background: 'radial-gradient(circle, hsla(221, 83%, 53%, 0.05) 0%, transparent 70%)' }}
                />
            </div>

            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `
                    linear-gradient(hsla(221, 83%, 53%, 0.3) 1px, transparent 1px),
                    linear-gradient(90deg, hsla(221, 83%, 53%, 0.3) 1px, transparent 1px)
                `,
                backgroundSize: '60px 60px'
            }} />

            {/* Login Container */}
            <div className="relative z-10 w-full max-w-[460px] mx-4">
                {/* Logo & Branding */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-8"
                >
                    <div className="flex items-center justify-center gap-3 mb-3">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                style={{
                                    background: 'linear-gradient(135deg, hsl(221, 83%, 53%), hsl(221, 83%, 40%))',
                                    boxShadow: '0 8px 32px -8px hsla(221, 83%, 53%, 0.4)'
                                }}>
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <motion.div
                                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                                transition={{ duration: 3, repeat: Infinity }}
                                className="absolute inset-0 rounded-2xl"
                                style={{ background: 'hsl(221, 83%, 53%)', filter: 'blur(12px)' }}
                            />
                        </div>
                        <div className="text-left">
                            <h1 className="text-xl font-bold text-white tracking-tight">Partsunion</h1>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Admin Console</span>
                        </div>
                    </div>
                </motion.div>

                {/* Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    <div className="rounded-3xl overflow-hidden"
                        style={{
                            background: 'hsla(225, 14%, 10%, 0.8)',
                            backdropFilter: 'blur(40px)',
                            border: '1px solid hsla(225, 10%, 20%, 0.5)',
                            boxShadow: '0 32px 64px -16px rgba(0,0,0,0.5), inset 0 1px 0 hsla(225, 10%, 30%, 0.2)'
                        }}
                    >
                        {/* Top accent line */}
                        <div className="h-[2px]" style={{
                            background: 'linear-gradient(90deg, transparent, hsl(221, 83%, 53%), hsl(260, 60%, 50%), hsl(221, 83%, 53%), transparent)'
                        }} />

                        {/* Header */}
                        <div className="px-8 pt-8 pb-2">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <h2 className="text-2xl font-bold text-white mb-1">Willkommen zurück</h2>
                                <p className="text-white/40 text-sm">Melden Sie sich an, um auf das Admin-Portal zuzugreifen.</p>
                            </motion.div>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="px-8 pb-8 pt-4 space-y-5">
                            {/* Error Banner */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10, height: 0 }}
                                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                                        exit={{ opacity: 0, y: -10, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="flex items-start gap-3 p-4 rounded-xl"
                                            style={{
                                                background: 'hsla(0, 72%, 51%, 0.08)',
                                                border: '1px solid hsla(0, 72%, 51%, 0.15)'
                                            }}>
                                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-red-300 leading-relaxed">{error}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Username */}
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.35 }}
                                className="space-y-2"
                            >
                                <label className="block text-[11px] font-bold text-white/50 uppercase tracking-[0.12em]">
                                    Benutzername
                                </label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/25 group-focus-within:text-blue-400 transition-colors duration-300" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Ihr Benutzername"
                                        className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder:text-white/20 outline-none transition-all duration-300"
                                        style={{
                                            background: 'hsla(225, 12%, 14%, 0.6)',
                                            border: '1px solid hsla(225, 10%, 22%, 0.5)',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = 'hsla(221, 83%, 53%, 0.4)';
                                            e.target.style.background = 'hsla(225, 12%, 14%, 0.8)';
                                            e.target.style.boxShadow = '0 0 0 3px hsla(221, 83%, 53%, 0.08)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = 'hsla(225, 10%, 22%, 0.5)';
                                            e.target.style.background = 'hsla(225, 12%, 14%, 0.6)';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                        autoComplete="username"
                                    />
                                </div>
                            </motion.div>

                            {/* Password */}
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                                className="space-y-2"
                            >
                                <label className="block text-[11px] font-bold text-white/50 uppercase tracking-[0.12em]">
                                    Passwort
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/25 group-focus-within:text-blue-400 transition-colors duration-300" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-12 pr-12 py-3.5 rounded-xl text-white placeholder:text-white/20 outline-none transition-all duration-300"
                                        style={{
                                            background: 'hsla(225, 12%, 14%, 0.6)',
                                            border: '1px solid hsla(225, 10%, 22%, 0.5)',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = 'hsla(221, 83%, 53%, 0.4)';
                                            e.target.style.background = 'hsla(225, 12%, 14%, 0.8)';
                                            e.target.style.boxShadow = '0 0 0 3px hsla(221, 83%, 53%, 0.08)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = 'hsla(225, 10%, 22%, 0.5)';
                                            e.target.style.background = 'hsla(225, 12%, 14%, 0.6)';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                                    </button>
                                </div>
                            </motion.div>

                            {/* Forgot Password */}
                            {onForgotPassword && (
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={onForgotPassword}
                                        className="text-xs text-white/30 hover:text-blue-400 transition-colors"
                                    >
                                        Passwort vergessen?
                                    </button>
                                </div>
                            )}

                            {/* Submit */}
                            <motion.button
                                type="submit"
                                disabled={isLoading}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.45 }}
                                className="w-full py-4 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                                style={{
                                    background: 'linear-gradient(135deg, hsl(221, 83%, 53%), hsl(221, 83%, 45%))',
                                    boxShadow: '0 8px 32px -8px hsla(221, 83%, 53%, 0.35), inset 0 1px 0 hsla(0, 0%, 100%, 0.08)'
                                }}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Anmelden
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </motion.button>
                        </form>

                        {/* Footer */}
                        <div className="px-8 py-4 text-center" style={{
                            borderTop: '1px solid hsla(225, 10%, 20%, 0.3)',
                            background: 'hsla(225, 14%, 8%, 0.4)'
                        }}>
                            <div className="flex items-center justify-center gap-2">
                                <Zap className="w-3 h-3 text-white/20" />
                                <span className="text-[11px] text-white/20">Partsunion Admin v2.0</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Security Badge */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="flex items-center justify-center gap-2 mt-6"
                >
                    <Lock className="w-3 h-3 text-white/15" />
                    <span className="text-[10px] text-white/15 tracking-wider">256-BIT TLS VERSCHLÜSSELT</span>
                </motion.div>
            </div>
        </div>
    );
}

export default LoginView;
