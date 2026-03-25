/**
 * Login View for Admin Dashboard
 * Premium design with Partsunion branding
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, User, ArrowRight, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

// Partsunion Logo Component
const PartsunionLogo = () => (
    <svg viewBox="0 0 180 50" className="w-48 h-auto">
        <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
        </defs>
        {/* Simplified Partsunion logo representation */}
        <g fill="url(#logoGrad)">
            {/* Interlocking chain/link symbol */}
            <path d="M10 25c0-8.284 6.716-15 15-15 5.523 0 10.345 2.985 12.94 7.425C40.535 12.985 45.356 10 50.88 10c8.284 0 15 6.716 15 15s-6.716 15-15 15c-5.523 0-10.345-2.985-12.94-7.425C35.345 37.015 30.523 40 25 40c-8.284 0-15-6.716-15-15zm15-10c-5.523 0-10 4.477-10 10s4.477 10 10 10c3.518 0 6.612-1.817 8.394-4.563C31.612 33.183 34.706 35 38.224 35c5.523 0 10-4.477 10-10s-4.477-10-10-10c-3.518 0-6.612 1.817-8.394 4.563C31.612 16.817 28.518 15 25 15z" transform="scale(0.6) translate(0, 8)" />
        </g>
        {/* Text */}
        <text x="50" y="32" fontFamily="system-ui, -apple-system, sans-serif" fontSize="20" fontWeight="700" fill="#2563eb">
            Partsunion
        </text>
    </svg>
);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError('Bitte füllen Sie alle Felder aus');
            return;
        }

        setIsLoading(true);
        try {
            await login(username, password);
            toast.success('Erfolgreich angemeldet');
        } catch (err: any) {
            setError(err.message || 'Anmeldung fehlgeschlagen');
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
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-light rounded-full blur-3xl" />
            </div>

            {/* Noise Overlay */}
            <div className="absolute inset-0 opacity-30" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                backgroundSize: '150px',
                mixBlendMode: 'overlay'
            }} />

            {/* Login Card */}
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="relative z-10 w-full max-w-md mx-4"
            >
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="px-8 pt-10 pb-6 text-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="flex justify-center mb-6"
                        >
                            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20">
                                <Lock className="w-8 h-8 text-white" />
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                        >
                            <h1 className="text-2xl font-bold text-white mb-2">Admin Dashboard</h1>
                            <p className="text-white/60 text-sm">Melden Sie sich an, um fortzufahren</p>
                        </motion.div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
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

                        {/* Username Field */}
                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-white/70 uppercase tracking-wider">
                                Benutzername
                            </label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-brand transition-colors" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="z.B. Elias"
                                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-white/70 uppercase tracking-wider">
                                Passwort
                            </label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-brand transition-colors" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                                    autoComplete="current-password"
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



                        {/* Submit Button */}
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
                                <>
                                    Anmelden
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </motion.button>
                    </form>

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

export default LoginView;
