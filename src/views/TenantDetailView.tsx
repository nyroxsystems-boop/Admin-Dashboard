/**
 * TenantDetailView — Full Tenant Profile
 * ALL colors via CSS variables — zero hardcoded HSL
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowLeft, Users, Package, Smartphone, Settings, Loader2,
    Shield, CheckCircle, XCircle, Clock,
    BarChart2, RefreshCcw, Plus, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import {
    getTenantDetail, TenantDetail, createTenantUser,
    removeActiveDevice, updateTenantLimits,
    deactivateTenant, activateTenant, Tenant
} from '../api/wws';

interface TenantDetailViewProps {
    tenant: Tenant;
    onBack: () => void;
    onRefresh: () => void;
}

type DetailTab = 'overview' | 'users' | 'orders' | 'devices' | 'settings';

const StatMini = ({ label, value, colorClass, delay = 0 }: { label: string; value: string | number; colorClass: string; delay?: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: delay * 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="stat-card group"
    >
        <div className="text-[10px] text-muted-foreground font-mono font-semibold uppercase tracking-[0.1em]">{label}</div>
        <div className={`text-2xl font-extrabold mt-1.5 tracking-tight ${colorClass}`}>{value}</div>
    </motion.div>
);

export function TenantDetailView({ tenant, onBack, onRefresh }: TenantDetailViewProps) {
    const [detail, setDetail] = useState<TenantDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<DetailTab>('overview');

    const [showAddUser, setShowAddUser] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState<'TENANT_ADMIN' | 'TENANT_USER'>('TENANT_ADMIN');
    const [addingUser, setAddingUser] = useState(false);

    const [editMaxUsers, setEditMaxUsers] = useState(10);
    const [editMaxDevices, setEditMaxDevices] = useState(5);
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => { loadDetail(); }, [tenant.id]);

    const loadDetail = async () => {
        try {
            setLoading(true);
            const res = await getTenantDetail(tenant.id);
            setDetail(res.tenant);
            setEditMaxUsers(res.tenant.settings?.max_users || 10);
            setEditMaxDevices(res.tenant.settings?.max_devices || 5);
        } catch { toast.error('Fehler beim Laden'); }
        finally { setLoading(false); }
    };

    const handleAddUser = async () => {
        if (!newEmail || !newPassword) { toast.error('E-Mail und Passwort erforderlich'); return; }
        setAddingUser(true);
        try {
            await createTenantUser(tenant.id, { email: newEmail, username: newUsername || newEmail.split('@')[0], password: newPassword, role: newUserRole || 'TENANT_ADMIN' });
            toast.success('Benutzer erstellt');
            setShowAddUser(false); setNewEmail(''); setNewUsername(''); setNewPassword('');
            loadDetail();
        } catch (err: unknown) { toast.error(err.message); }
        finally { setAddingUser(false); }
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            await updateTenantLimits(tenant.id, { max_users: editMaxUsers, max_devices: editMaxDevices });
            toast.success('Einstellungen gespeichert'); loadDetail();
        } catch (err: unknown) { toast.error(err.message); }
        finally { setSavingSettings(false); }
    };

    const handleToggleActive = async () => {
        if (tenant.is_active) {
            if (!confirm(`"${tenant.name}" wirklich deaktivieren?`)) return;
            try { await deactivateTenant(tenant.id); toast.success('Deaktiviert'); onRefresh(); }
            catch (err: unknown) { toast.error(err.message); }
        } else {
            try { await activateTenant(tenant.id); toast.success('Aktiviert'); onRefresh(); }
            catch (err: unknown) { toast.error(err.message); }
        }
    };

    const statusBadge = (s: string) => {
        const m: Record<string, string> = {
            'done': 'badge-success', 'completed': 'badge-success',
            'OEM_RESOLVED': 'badge-info', 'COLLECTING_INFO': 'badge-warn',
            'OFFER_PRESENTED': 'badge-info',
        };
        return m[s] || 'badge-muted';
    };

    const tabs: { key: DetailTab; label: string; icon: unknown; count?: number }[] = [
        { key: 'overview', label: 'Übersicht', icon: BarChart2 },
        { key: 'users', label: 'Benutzer', icon: Users, count: detail?.users.length },
        { key: 'orders', label: 'Bestellungen', icon: Package, count: detail?.orders.length },
        { key: 'devices', label: 'Geräte', icon: Smartphone, count: detail?.devices.length },
        { key: 'settings', label: 'Einstellungen', icon: Settings },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
        >
            {/* ═══ HEADER ═══ */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="action-btn !w-10 !h-10">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-4">
                        {tenant.logo_url ? (
                            <img src={tenant.logo_url} alt={tenant.name} className="w-14 h-14 rounded-2xl object-cover shadow-lg border border-border/30" />
                        ) : (
                            <div className="icon-box w-14 h-14 font-extrabold text-xl glow-primary">
                                {tenant.name.charAt(0)}
                            </div>
                        )}
                        <div>
                            <h2 className="text-2xl font-extrabold tracking-tight">{tenant.name}</h2>
                            <div className="flex items-center gap-2.5 mt-1">
                                <code className="text-[11px] bg-muted/50 px-2.5 py-0.5 rounded-md font-mono text-muted-foreground">{tenant.slug}</code>
                                <span className={`badge ${tenant.is_active ? 'badge-success' : 'badge-danger'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${tenant.is_active ? 'bg-success' : 'bg-danger'}`} />
                                    {tenant.is_active ? 'Aktiv' : 'Gesperrt'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadDetail} className="action-btn !w-10 !h-10">
                        <RefreshCcw className="w-4 h-4" />
                    </button>
                    <button onClick={handleToggleActive}
                        className={tenant.is_active ? 'btn-danger-outline text-sm' : 'btn-success-outline text-sm'}>
                        {tenant.is_active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                </div>
            </div>

            {/* ═══ QUICK STATS ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatMini label="Bestellungen" value={detail?.stats.total_orders || 0} colorClass="text-stat-1" delay={0} />
                <StatMini label="OEM Aufgelöst" value={`${detail?.stats.oem_rate || 0}%`} colorClass="text-stat-2" delay={1} />
                <StatMini label="Umsatz" value={`€${(detail?.stats.revenue || 0).toLocaleString('de-DE', { minimumFractionDigits: 0 })}`} colorClass="text-stat-3" delay={2} />
                <StatMini label="Nachrichten" value={detail?.stats.total_messages || 0} colorClass="text-stat-4" delay={3} />
                <StatMini label="Benutzer" value={`${detail?.stats.user_count || 0} / ${tenant.max_users}`} colorClass="text-stat-5" delay={4} />
            </div>

            {/* ═══ TAB BAR ═══ */}
            <div className="tab-bar">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)}
                        className={`tab-item ${activeTab === t.key ? 'active' : ''}`}>
                        <t.icon className="w-4 h-4" />
                        <span>{t.label}</span>
                        {t.count !== undefined && (
                            <span className="text-[10px] font-mono font-semibold bg-muted/50 px-1.5 py-0.5 rounded-md">{t.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ═══ TAB CONTENT ═══ */}
            <AnimatePresence mode='wait'>
                {/* OVERVIEW */}
                {activeTab === 'overview' && (
                    <motion.div key="ov" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        <div className="glass-card rounded-2xl p-6">
                            <h3 className="font-bold text-base tracking-tight mb-4">Letzte Bestellungen</h3>
                            {(detail?.orders || []).length === 0 ? (
                                <p className="text-muted-foreground text-sm py-6 text-center">Noch keine Bestellungen</p>
                            ) : (
                                <div className="space-y-2">
                                    {(detail?.orders || []).slice(0, 6).map((o, i) => (
                                        <motion.div key={o.id}
                                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors group">
                                            <span className={`badge ${statusBadge(o.status)}`}>{o.status}</span>
                                            <span className="text-sm font-medium flex-1 truncate">{o.part_name}</span>
                                            {o.oem_number && <code className="badge badge-info">{o.oem_number}</code>}
                                            {o.vehicle_brand && <span className="text-xs text-muted-foreground hidden md:inline">{o.vehicle_brand} {o.vehicle_model}</span>}
                                            <span className="text-[11px] text-muted-foreground font-mono">
                                                {new Date(o.created_at).toLocaleDateString('de-DE')}
                                            </span>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {(detail?.audit || []).length > 0 && (
                            <div className="glass-card rounded-2xl p-6">
                                <h3 className="font-bold text-base tracking-tight mb-4">Admin-Aktivitäten</h3>
                                <div className="space-y-2">
                                    {detail!.audit.slice(0, 5).map(a => (
                                        <div key={a.id} className="flex items-center gap-3 text-sm py-1.5">
                                            <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                            <span className="text-muted-foreground font-mono text-[11px] w-24 flex-shrink-0">
                                                {new Date(a.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className="font-medium text-sm">{a.admin_user}</span>
                                            <span className="badge badge-muted">{a.action.replace(/_/g, ' ')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* USERS */}
                {activeTab === 'users' && (
                    <motion.div key="us" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold tracking-tight">Benutzer <span className="text-muted-foreground font-normal">({detail?.users.length || 0}/{tenant.max_users})</span></h3>
                            <button onClick={() => setShowAddUser(true)} className="btn-brand text-sm">
                                <Plus className="w-4 h-4" /> Hinzufügen
                            </button>
                        </div>

                        <AnimatePresence>
                            {showAddUser && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="glass-card rounded-xl p-5 space-y-3 border-brand">
                                    <h4 className="font-semibold text-sm">Neuen Benutzer erstellen</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="E-Mail *" className="premium-input" />
                                        <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Username" className="premium-input" />
                                        <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Passwort *" type="password" className="premium-input" />
                                    </div>
                                    <div className="flex gap-2 justify-end pt-1">
                                        <button onClick={() => setShowAddUser(false)} className="btn-ghost text-sm">Abbrechen</button>
                                        <button onClick={handleAddUser} disabled={addingUser} className="btn-brand text-sm">
                                            {addingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Erstellen'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="glass-card rounded-2xl overflow-hidden">
                            <table className="premium-table">
                                <thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th>Erstellt</th></tr></thead>
                                <tbody>
                                    {(detail?.users || []).map((u, i) => (
                                        <motion.tr key={u.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="icon-box w-8 h-8 text-xs font-bold">
                                                        {(u.name || u.username || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold">{u.name || u.username}</div>
                                                        <div className="text-[11px] text-muted-foreground font-mono opacity-60">@{u.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-sm">{u.email}</td>
                                            <td><span className="badge badge-info">{u.role}</span></td>
                                            <td>
                                                {u.is_active ? (
                                                    <span className="badge badge-success"><CheckCircle className="w-3 h-3" /> Aktiv</span>
                                                ) : (
                                                    <span className="badge badge-danger"><XCircle className="w-3 h-3" /> Inaktiv</span>
                                                )}
                                            </td>
                                            <td className="text-[12px] text-muted-foreground font-mono">
                                                {new Date(u.created_at).toLocaleDateString('de-DE')}
                                            </td>
                                        </motion.tr>
                                    ))}
                                    {(detail?.users || []).length === 0 && (
                                        <tr><td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">Keine Benutzer</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* ORDERS */}
                {activeTab === 'orders' && (
                    <motion.div key="or" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        <h3 className="font-bold tracking-tight">Bestellungen <span className="text-muted-foreground font-normal">({detail?.orders.length || 0})</span></h3>
                        <div className="glass-card rounded-2xl overflow-hidden">
                            <table className="premium-table">
                                <thead><tr><th>Status</th><th>Teil</th><th>OEM</th><th>Fahrzeug</th><th>Kunde</th><th>Betrag</th><th>Datum</th></tr></thead>
                                <tbody>
                                    {(detail?.orders || []).map((o, i) => (
                                        <motion.tr key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                                            <td><span className={`badge ${statusBadge(o.status)}`}>{o.status}</span></td>
                                            <td className="text-sm font-medium max-w-[180px] truncate">{o.part_name}</td>
                                            <td>
                                                {o.oem_number ? <code className="badge badge-info">{o.oem_number}</code>
                                                    : <span className="text-muted-foreground text-xs">—</span>}
                                            </td>
                                            <td className="text-sm text-muted-foreground">
                                                {o.vehicle_brand ? `${o.vehicle_brand} ${o.vehicle_model || ''}`.trim() : '—'}
                                            </td>
                                            <td className="text-xs text-muted-foreground font-mono">{o.customer || '—'}</td>
                                            <td className="text-sm font-semibold">{o.total ? `€${Number(o.total).toFixed(2)}` : '—'}</td>
                                            <td className="text-[11px] text-muted-foreground font-mono">{new Date(o.created_at).toLocaleDateString('de-DE')}</td>
                                        </motion.tr>
                                    ))}
                                    {(detail?.orders || []).length === 0 && (
                                        <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">Keine Bestellungen</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* DEVICES */}
                {activeTab === 'devices' && (
                    <motion.div key="dv" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        <h3 className="font-bold tracking-tight">Aktive Geräte <span className="text-muted-foreground font-normal">({detail?.devices.length || 0}/{tenant.max_devices})</span></h3>
                        <div className="glass-card rounded-2xl overflow-hidden">
                            {(detail?.devices || []).length === 0 ? (
                                <div className="p-12 text-center">
                                    <Smartphone className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-25" />
                                    <p className="text-muted-foreground text-sm">Keine aktiven Geräte</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/20">
                                    {(detail?.devices || []).map((d, i) => (
                                        <motion.div key={d.device_id || i}
                                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="icon-box-muted w-10 h-10">
                                                    <Smartphone className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold font-mono">{d.device_id?.substring(0, 16) || 'Unbekannt'}...</div>
                                                    <div className="text-[11px] text-muted-foreground truncate max-w-[300px]">{d.user_agent?.substring(0, 50) || 'N/A'}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-[11px] text-muted-foreground font-mono">IP: {d.ip_address || 'N/A'}</div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                    </div>
                                                </div>
                                                <button onClick={async () => {
                                                    try { await removeActiveDevice(tenant.id, d.device_id); toast.success('Gerät entfernt'); loadDetail(); }
                                                    catch (err: unknown) { toast.error(err.message); }
                                                }} className="action-btn opacity-0 group-hover:opacity-100 hover:!bg-danger-light hover:!text-danger">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* SETTINGS */}
                {activeTab === 'settings' && (
                    <motion.div key="st" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-2xl">
                        <h3 className="font-bold tracking-tight">Händler-Einstellungen</h3>

                        <div className="glass-card rounded-2xl p-6 space-y-4">
                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em] font-mono">Limits</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-1.5 font-mono">Max. Benutzer</label>
                                    <input type="number" value={editMaxUsers} onChange={e => setEditMaxUsers(Number(e.target.value))} className="premium-input" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-1.5 font-mono">Max. Geräte</label>
                                    <input type="number" value={editMaxDevices} onChange={e => setEditMaxDevices(Number(e.target.value))} className="premium-input" />
                                </div>
                            </div>
                            <button onClick={handleSaveSettings} disabled={savingSettings} className="btn-brand text-sm">
                                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}
                            </button>
                        </div>

                        <div className="glass-card rounded-2xl p-6 space-y-4">
                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em] font-mono">Kontoinformationen</h4>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                {[
                                    { label: 'WhatsApp', value: detail?.settings?.whatsapp_number || tenant.whatsapp_number || 'Nicht konfiguriert' },
                                    { label: 'Onboarding', value: detail?.settings?.onboarding_status || tenant.onboarding_status || 'pending' },
                                    { label: 'Payment', value: detail?.settings?.payment_status || tenant.payment_status || 'trial' },
                                    { label: 'Tenant ID', value: String(tenant.id), mono: true },
                                ].map((item, i) => (
                                    <div key={i}>
                                        <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1">{item.label}</div>
                                        <div className={`font-medium ${item.mono ? 'font-mono text-[13px]' : 'capitalize'}`}>{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass-card rounded-2xl p-6 space-y-3 !border-destructive/15 bg-danger-light">
                            <h4 className="text-[10px] font-semibold text-danger uppercase tracking-[0.1em] font-mono">Gefahrenzone</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Deaktivierte Händler können sich nicht mehr einloggen und haben keinen Zugriff auf das System.
                            </p>
                            <button onClick={handleToggleActive}
                                className={tenant.is_active ? 'btn-danger-outline text-sm' : 'btn-success-outline text-sm'}>
                                <Shield className="w-4 h-4" />
                                {tenant.is_active ? 'Händler deaktivieren' : 'Händler aktivieren'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default TenantDetailView;
