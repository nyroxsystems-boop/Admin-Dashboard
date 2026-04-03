/**
 * AdminUI — Premium Shared Components
 * ALL colors via CSS variables — no hardcoded HSL values
 */
import React from 'react';
import { motion } from 'motion/react';
import { X, ChevronRight, Smartphone, LogOut, Loader2 } from 'lucide-react';

// ── Prop Interfaces ──
interface SidebarItemProps {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
    badge?: string | number;
    collapsed?: boolean;
}

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: string;
    color: string;
    delay?: number;
}

interface LimitBarProps {
    current: number;
    max: number;
    label: string;
}

interface StatusBadgeProps {
    status: string;
    type?: 'onboarding' | 'payment';
}

interface ActionButtonProps {
    icon: React.ReactNode;
    onClick?: () => void;
    tooltip?: string;
    variant?: 'default' | 'danger';
}

interface ModalProps {
    children: React.ReactNode;
    onClose: () => void;
    title: string;
}

interface DeviceInfo {
    id: string;
    device_id: string;
    user: string;
}

interface DeviceDrawerProps {
    tenant: { name: string };
    devices: DeviceInfo[];
    onClose: () => void;
    onRemove: (deviceId: string) => void;
}

interface InputProps {
    label: string;
    onChange?: (value: string) => void;
    [key: string]: unknown;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'ghost';
    loading?: boolean;
}

// ── Sidebar Item ──
export const SidebarItem = ({ icon, label, active, onClick, badge, collapsed }: SidebarItemProps) => (
    <button onClick={onClick} title={collapsed ? label : undefined}
        className={`sidebar-item w-full ${active ? 'active' : ''} ${collapsed ? '!px-0 !justify-center !gap-0' : ''}`}>
        <span className={`transition-colors flex-shrink-0 ${active ? 'text-brand' : ''}`}>{icon}</span>
        {!collapsed && <span className="flex-1 text-left">{label}</span>}
        {!collapsed && badge && <span className="badge badge-info text-[9px] px-1.5 py-0.5">{badge}</span>}
        {!collapsed && active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />}
    </button>
);

// ── Stats Card ──
export const StatsCard = ({ title, value, icon, trend, color, delay = 0 }: StatsCardProps) => (
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
export const LimitBar = ({ current, max, label }: LimitBarProps) => {
    const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    const isCritical = percentage > 80;
    return (
        <div className="w-full">
            <div className="flex justify-between text-[10px] uppercase font-mono font-semibold text-muted-foreground mb-2 tracking-wider">
                <span>{label}</span>
                <span className={isCritical ? 'text-danger' : 'text-foreground/80'}>{current} / {max}</span>
            </div>
            <div className="progress-track">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className={`progress-fill ${isCritical ? 'bg-danger' : 'bg-brand'}`}
                />
            </div>
        </div>
    );
};

// ── Status Badge ──
export const StatusBadge = ({ status, type }: StatusBadgeProps) => {
    const isGood = status === 'completed' || status === 'paid';
    const isWarn = status === 'trial' || status === 'pending';
    const badgeClass = isGood ? 'badge-success' : isWarn ? 'badge-warn' : 'badge-danger';
    const dotClass = isGood ? 'bg-success' : isWarn ? 'bg-warn' : 'bg-danger';

    const labelMap: Record<string, string> = {
        completed: 'Onboarding Fertig',
        paid: 'Bezahlt',
        trial: 'Testphase',
        pending: 'Ausstehend',
        overdue: 'Überfällig',
    };
    const label = labelMap[status] || status;

    return (
        <span className={`badge ${badgeClass}`} title={type ? `${type === 'onboarding' ? 'Onboarding' : 'Zahlung'}: ${label}` : undefined}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
            {label}
        </span>
    );
};

// ── Action Button ──
export const ActionButton = ({ icon, onClick, tooltip, variant }: ActionButtonProps) => (
    <button onClick={onClick} title={tooltip}
        className={`action-btn ${variant === 'danger' ? 'hover:!bg-danger-light hover:!text-danger hover:!border-transparent' : ''}`}>
        {icon}
    </button>
);

// ── Modal ──
export const Modal = ({ children, onClose, title }: ModalProps) => {
    React.useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 modal-overlay" />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                className="relative w-full max-w-md rounded-2xl overflow-hidden modal-card"
            >
                <div className="px-6 py-4 border-b border-border/50 flex justify-between items-center">
                    <h3 className="font-bold text-lg tracking-tight">{title}</h3>
                    <button onClick={onClose} className="action-btn"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-6">{children}</div>
            </motion.div>
        </div>
    );
};

// ── Device Drawer ──
export const DeviceDrawer = ({ tenant, devices, onClose, onRemove }: DeviceDrawerProps) => (
    <div className="fixed inset-0 z-50 flex justify-end">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 modal-overlay" onClick={onClose} />
        <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative w-full max-w-md h-full flex flex-col drawer-card"
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
                    devices.map((device: DeviceInfo) => (
                        <motion.div key={device.id}
                            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                            className="p-4 rounded-xl border border-border/30 bg-card flex justify-between items-center group hover:border-brand transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="icon-box w-10 h-10">
                                    <Smartphone className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{device.user}</p>
                                    <p className="text-xs text-muted-foreground font-mono opacity-60">{device.device_id}</p>
                                </div>
                            </div>
                            <button onClick={() => onRemove(device.device_id)}
                                className="action-btn opacity-0 group-hover:opacity-100 hover:!bg-danger-light hover:!text-danger">
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
export const Input = ({ label, onChange, ...props }: InputProps) => (
    <div>
        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-1.5 ml-0.5 font-mono">{label}</label>
        <input className="premium-input" onChange={(e) => onChange?.(e.target.value)} {...props} />
    </div>
);

// ── Button ──
export const Button = ({ children, variant = 'primary', disabled, loading, ...props }: ButtonProps) => (
    <button disabled={disabled || loading}
        className={`${variant === 'primary' ? 'btn-brand' : 'btn-ghost'} ${loading ? 'opacity-70 cursor-wait' : ''}`}
        {...props}>
        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />}
        {children}
    </button>
);
