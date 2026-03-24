/**
 * AdminUI — Premium Shared Components
 * Aesthetic: Luxury automotive-industrial dark theme
 * Typography: DM Sans + JetBrains Mono
 */
import React from 'react';
import { motion } from 'motion/react';
import {
    X, ChevronRight, Smartphone, LogOut, Loader2
} from 'lucide-react';

// ── Sidebar Item ──
export const SidebarItem = ({ icon, label, active, onClick, badge }: any) => (
    <button
        onClick={onClick}
        className={`sidebar-item w-full ${active ? 'active' : 'text-muted-foreground'}`}
    >
        <span className={`transition-colors ${active ? 'text-[hsl(178,70%,48%)]' : ''}`}>{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        {badge && (
            <span className="badge badge-info text-[9px] px-1.5 py-0.5">{badge}</span>
        )}
        {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />}
    </button>
);

// ── Stats Card ──
export const StatsCard = ({ title, value, icon, trend, color, delay = 0 }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: delay * 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="stat-card group"
    >
        <div className={`absolute top-0 right-0 w-28 h-28 rounded-bl-[80%] bg-gradient-to-bl ${color} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500`} />
        <div className="flex justify-between items-start mb-3 relative z-10">
            <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.08em] font-mono">{title}</p>
                <h3 className="text-3xl font-extrabold mt-1.5 tracking-tight">{value}</h3>
            </div>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                {icon}
            </div>
        </div>
        <div className="flex items-center gap-2 text-xs relative z-10">
            <span className="badge badge-success">{trend}</span>
        </div>
    </motion.div>
);

// ── Limit Bar ──
export const LimitBar = ({ current, max, label }: any) => {
    const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    const isCritical = percentage > 80;

    return (
        <div className="w-full">
            <div className="flex justify-between text-[10px] uppercase font-mono font-semibold text-muted-foreground mb-2 tracking-wider">
                <span>{label}</span>
                <span className={isCritical ? 'text-red-400' : 'text-foreground/80'}>{current} / {max}</span>
            </div>
            <div className="progress-track">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className={`progress-fill ${isCritical
                        ? 'bg-gradient-to-r from-red-500 to-orange-400'
                        : 'bg-gradient-to-r from-[hsl(178,70%,48%)] to-[hsl(178,60%,60%)]'
                    }`}
                />
            </div>
        </div>
    );
};

// ── Status Badge ──
export const StatusBadge = ({ status, type }: any) => {
    const isGood = status === 'completed' || status === 'paid';
    const isWarn = status === 'trial' || status === 'pending';

    const badgeClass = isGood ? 'badge-success' : isWarn ? 'badge-warn' : 'badge-danger';

    const label = status === 'completed' ? 'Onboarding Fertig' : status === 'paid' ? 'Bezahlt'
        : status === 'trial' ? 'Testphase' : status === 'pending' ? 'Ausstehend' : status;

    return (
        <span className={`badge ${badgeClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
                isGood ? 'bg-[hsl(160,84%,45%)]' : isWarn ? 'bg-[hsl(36,92%,55%)]' : 'bg-[hsl(0,72%,51%)]'
            }`} />
            {label}
        </span>
    );
};

// ── Action Button ──
export const ActionButton = ({ icon, onClick, tooltip, variant }: any) => (
    <button
        onClick={onClick}
        title={tooltip}
        className={`action-btn ${variant === 'danger' ? 'hover:!bg-red-500/10 hover:!text-red-400 hover:!border-red-500/15' : ''}`}
    >
        {icon}
    </button>
);

// ── Modal ──
export const Modal = ({ children, onClose, title }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        {/* Backdrop */}
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
        {/* Content */}
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={{
                background: 'hsl(225, 18%, 9%)',
                border: '1px solid hsla(225, 12%, 20%, 0.4)',
                boxShadow: '0 24px 64px -16px rgba(0,0,0,0.5), inset 0 1px 0 hsla(0,0%,100%,0.03)',
            }}
        >
            <div className="px-6 py-4 border-b border-border/50 flex justify-between items-center">
                <h3 className="font-bold text-lg tracking-tight">{title}</h3>
                <button onClick={onClose} className="action-btn">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="p-6">{children}</div>
        </motion.div>
    </div>
);

// ── Device Drawer ──
export const DeviceDrawer = ({ tenant, devices, onClose, onRemove }: any) => (
    <div className="fixed inset-0 z-50 flex justify-end">
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
        />
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative w-full max-w-md h-full flex flex-col"
            style={{
                background: 'hsl(225, 18%, 7%)',
                borderLeft: '1px solid hsla(225, 12%, 20%, 0.3)',
                boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
            }}
        >
            <div className="p-6 border-b border-border/30 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg tracking-tight">Geräteverwaltung</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">für {tenant.name}</p>
                </div>
                <button onClick={onClose} className="action-btn"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {devices.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground border border-dashed border-border/50 rounded-xl">
                        <Smartphone className="w-8 h-8 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Keine aktiven Geräte</p>
                    </div>
                ) : (
                    devices.map((device: any) => (
                        <motion.div
                            key={device.id}
                            initial={{ opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-4 rounded-xl border border-border/30 flex justify-between items-center group hover:border-[hsla(178,70%,48%,0.15)] transition-colors"
                            style={{ background: 'hsla(225, 18%, 11%, 0.6)' }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(178,70%,48%)] to-[hsl(178,60%,35%)] flex items-center justify-center">
                                    <Smartphone className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{device.user}</p>
                                    <p className="text-xs text-muted-foreground font-mono opacity-60">{device.device_id}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => onRemove(device.device_id)}
                                className="action-btn opacity-0 group-hover:opacity-100 hover:!bg-red-500/10 hover:!text-red-400"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ))
                )}
            </div>
        </motion.div>
    </div>
);

// ── Input ──
export const Input = ({ label, onChange, ...props }: any) => (
    <div>
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-1.5 ml-0.5 font-mono">{label}</label>
        <input
            className="premium-input"
            onChange={(e) => onChange?.(e.target.value)}
            {...props}
        />
    </div>
);

// ── Button ──
export const Button = ({ children, variant = 'primary', disabled, ...props }: any) => (
    <button
        disabled={disabled}
        className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${
            variant === 'primary'
                ? 'bg-gradient-to-r from-[hsl(178,70%,42%)] to-[hsl(178,60%,48%)] text-white shadow-lg shadow-[hsla(178,70%,48%,0.2)] hover:shadow-[hsla(178,70%,48%,0.35)] disabled:opacity-50 disabled:cursor-not-allowed'
                : variant === 'ghost'
                    ? 'bg-transparent hover:bg-muted/50 text-foreground disabled:opacity-50'
                    : 'bg-transparent hover:bg-muted/50 text-foreground disabled:opacity-50'
        }`}
        {...props}
    >
        {children}
    </button>
);
