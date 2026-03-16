/**
 * Shared UI Components for Admin Dashboard
 * Extracted from AdminDashboardView.tsx for reusability and maintainability.
 */
import React from 'react';
import { motion } from 'motion/react';
import {
    X, ChevronRight, Smartphone, LogOut, Loader2
} from 'lucide-react';

// ── Sidebar Item ──
export const SidebarItem = ({ icon, label, active, onClick }: any) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${active
            ? 'bg-primary text-white shadow-lg shadow-primary/25 font-medium'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
    >
        {icon}
        <span>{label}</span>
        {active && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
    </button>
);

// ── Stats Card ──
export const StatsCard = ({ title, value, icon, trend, color }: any) => (
    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
        <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity bg-gradient-to-bl ${color} w-32 h-32 rounded-bl-full`} />
        <div className="flex justify-between items-start mb-4">
            <div>
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <h3 className="text-3xl font-bold mt-1 tracking-tight">{value}</h3>
            </div>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                {icon}
            </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
            <span className="text-green-500 font-bold bg-green-500/10 px-2 py-0.5 rounded-full">{trend}</span>
            <span className="text-muted-foreground">vs. Vormonat</span>
        </div>
    </div>
);

// ── Limit Bar ──
export const LimitBar = ({ current, max, label }: any) => {
    const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    const isCritical = percentage > 80;

    return (
        <div className="w-full">
            <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground mb-1.5">
                <span>{label}</span>
                <span className={isCritical ? 'text-red-500' : 'text-foreground'}>{current} / {max}</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${isCritical ? 'bg-red-500' : 'bg-primary'}`}
                />
            </div>
        </div>
    );
};

// ── Status Badge ──
export const StatusBadge = ({ status, type }: any) => {
    const isGood = status === 'completed' || status === 'paid';
    const isWarn = status === 'trial' || status === 'pending';

    let colorClass = isGood ? 'bg-green-500/10 text-green-600 border-green-500/20'
        : isWarn ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
            : 'bg-red-500/10 text-red-600 border-red-500/20';

    let label = status === 'completed' ? 'Onboarding Fertig' : status === 'paid' ? 'Bezahlt'
        : status === 'trial' ? 'Testphase' : status === 'pending' ? 'Wartet' : status;

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border w-fit ${colorClass}`}>
            {label}
        </span>
    );
};

// ── Action Button ──
export const ActionButton = ({ icon, onClick, tooltip }: any) => (
    <button
        onClick={onClick}
        title={tooltip}
        className="p-2 hover:bg-primary hover:text-white rounded-lg transition-all text-muted-foreground active:scale-95"
    >
        {icon}
    </button>
);

// ── Modal ──
export const Modal = ({ children, onClose, title }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
        >
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/20">
                <h3 className="font-bold text-lg">{title}</h3>
                <button onClick={onClose} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
                {children}
            </div>
        </motion.div>
    </div>
);

// ── Device Drawer ──
export const DeviceDrawer = ({ tenant, devices, onClose, onRemove }: any) => (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[2px]">
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="w-full max-w-md bg-background border-l border-border shadow-2xl h-full flex flex-col"
        >
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/10">
                <div>
                    <h3 className="font-bold text-lg">Geräteverwaltung</h3>
                    <p className="text-sm text-muted-foreground">für {tenant.name}</p>
                </div>
                <button onClick={onClose}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {devices.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-xl">Keine Geräte aktiv</div>
                ) : (
                    devices.map((device: any) => (
                        <div key={device.id} className="p-4 rounded-xl border border-border bg-card flex justify-between items-center group hover:border-primary/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Smartphone className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">{device.user}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{device.device_id}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => onRemove(device.device_id)}
                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </motion.div>
    </div>
);

// ── Input ──
export const Input = ({ label, onChange, ...props }: any) => (
    <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">{label}</label>
        <input
            className="w-full px-4 py-2.5 bg-muted/50 border border-transparent focus:border-primary/50 focus:bg-background rounded-xl outline-none transition-all placeholder:text-muted-foreground/50"
            onChange={(e) => onChange?.(e.target.value)}
            {...props}
        />
    </div>
);

// ── Button ──
export const Button = ({ children, variant = 'primary', disabled, ...props }: any) => (
    <button
        disabled={disabled}
        className={`px-5 py-2.5 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center ${variant === 'primary'
            ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed'
            : 'bg-transparent hover:bg-muted text-foreground disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
        {...props}
    >
        {children}
    </button>
);
