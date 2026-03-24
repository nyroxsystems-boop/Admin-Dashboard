/**
 * TenantDetailView — Full Tenant Profile with Users, Orders, Devices, Settings
 * 
 * Displayed when clicking a tenant row in the Mandantenverwaltung table.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowLeft, Users, Package, Smartphone, Settings, Loader2,
    Hash, Mail, Shield, CheckCircle, XCircle, Clock,
    BarChart2, MessageSquare, Euro, RefreshCcw, Plus, Trash2, Eye
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

export function TenantDetailView({ tenant, onBack, onRefresh }: TenantDetailViewProps) {
    const [detail, setDetail] = useState<TenantDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<DetailTab>('overview');

    // Add User Modal
    const [showAddUser, setShowAddUser] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [addingUser, setAddingUser] = useState(false);

    // Settings
    const [editMaxUsers, setEditMaxUsers] = useState(10);
    const [editMaxDevices, setEditMaxDevices] = useState(5);
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => {
        loadDetail();
    }, [tenant.id]);

    const loadDetail = async () => {
        try {
            setLoading(true);
            const res = await getTenantDetail(tenant.id);
            setDetail(res.tenant);
            setEditMaxUsers(res.tenant.settings?.max_users || 10);
            setEditMaxDevices(res.tenant.settings?.max_devices || 5);
        } catch (err: any) {
            toast.error('Fehler beim Laden der Händlerdetails');
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async () => {
        if (!newEmail || !newPassword) { toast.error('E-Mail und Passwort erforderlich'); return; }
        setAddingUser(true);
        try {
            await createTenantUser(tenant.id, {
                email: newEmail, username: newUsername || newEmail.split('@')[0],
                password: newPassword, role: 'TENANT_ADMIN'
            });
            toast.success('Benutzer erstellt');
            setShowAddUser(false);
            setNewEmail(''); setNewUsername(''); setNewPassword('');
            loadDetail();
        } catch (err: any) { toast.error(err.message); }
        finally { setAddingUser(false); }
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            await updateTenantLimits(tenant.id, { max_users: editMaxUsers, max_devices: editMaxDevices });
            toast.success('Einstellungen gespeichert');
            loadDetail();
        } catch (err: any) { toast.error(err.message); }
        finally { setSavingSettings(false); }
    };

    const handleToggleActive = async () => {
        if (tenant.is_active) {
            if (!confirm(`"${tenant.name}" wirklich deaktivieren?`)) return;
            try { await deactivateTenant(tenant.id); toast.success('Deaktiviert'); onRefresh(); }
            catch (err: any) { toast.error(err.message); }
        } else {
            try { await activateTenant(tenant.id); toast.success('Aktiviert'); onRefresh(); }
            catch (err: any) { toast.error(err.message); }
        }
    };

    const statusColor = (s: string) => {
        const m: Record<string, string> = {
            'done': 'bg-green-500/10 text-green-500', 'completed': 'bg-green-500/10 text-green-500',
            'OEM_RESOLVED': 'bg-blue-500/10 text-blue-500',
            'COLLECTING_INFO': 'bg-amber-500/10 text-amber-500',
            'OFFER_PRESENTED': 'bg-purple-500/10 text-purple-500',
        };
        return m[s] || 'bg-muted text-muted-foreground';
    };

    const tabs: { key: DetailTab; label: string; icon: any }[] = [
        { key: 'overview', label: 'Übersicht', icon: BarChart2 },
        { key: 'users', label: 'Benutzer', icon: Users },
        { key: 'orders', label: 'Bestellungen', icon: Package },
        { key: 'devices', label: 'Geräte', icon: Smartphone },
        { key: 'settings', label: 'Einstellungen', icon: Settings },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onBack}
                        className="p-2 hover:bg-muted rounded-xl transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        {tenant.logo_url ? (
                            <img src={tenant.logo_url} alt={tenant.name} className="w-12 h-12 rounded-xl object-cover shadow-md bg-white" />
                        ) : (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-md">
                                {tenant.name.charAt(0)}
                            </div>
                        )}
                        <div>
                            <h2 className="text-2xl font-bold">{tenant.name}</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{tenant.slug}</code>
                                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${tenant.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${tenant.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                                    {tenant.is_active ? 'Aktiv' : 'Gesperrt'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadDetail} className="p-2 hover:bg-muted rounded-xl">
                        <RefreshCcw className="w-5 h-5 text-muted-foreground" />
                    </button>
                    <button onClick={handleToggleActive}
                        className={`px-4 py-2 rounded-xl text-sm font-medium ${tenant.is_active
                            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                            : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'}`}>
                        {tenant.is_active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: 'Bestellungen', value: detail?.stats.total_orders || 0, color: 'text-blue-500' },
                    { label: 'OEM Aufgelöst', value: `${detail?.stats.oem_rate || 0}%`, color: 'text-green-500' },
                    { label: 'Umsatz', value: `€${(detail?.stats.revenue || 0).toLocaleString('de-DE', { minimumFractionDigits: 0 })}`, color: 'text-amber-500' },
                    { label: 'Nachrichten', value: detail?.stats.total_messages || 0, color: 'text-purple-500' },
                    { label: 'Benutzer', value: `${detail?.stats.user_count || 0}/${tenant.max_users}`, color: 'text-cyan-500' },
                ].map((s, i) => (
                    <div key={i} className="glass-card rounded-xl p-4 border border-border/50">
                        <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{s.label}</div>
                        <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-border/30">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.key
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'}`}>
                        <t.icon className="w-4 h-4" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode='wait'>
                {/* ───── OVERVIEW ───── */}
                {activeTab === 'overview' && (
                    <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        {/* Recent Orders */}
                        <div className="glass-card rounded-2xl border border-border/50 p-6">
                            <h3 className="font-bold text-lg mb-4">Letzte Bestellungen</h3>
                            {(detail?.orders || []).length === 0 ? (
                                <p className="text-muted-foreground text-sm">Keine Bestellungen</p>
                            ) : (
                                <div className="space-y-2">
                                    {(detail?.orders || []).slice(0, 5).map(o => (
                                        <div key={o.id} className="flex items-center gap-4 p-3 bg-muted/20 rounded-xl">
                                            <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-bold ${statusColor(o.status)}`}>
                                                {o.status}
                                            </span>
                                            <span className="text-sm font-medium flex-1">{o.part_name}</span>
                                            {o.oem_number && <code className="text-xs font-mono bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded">{o.oem_number}</code>}
                                            {o.vehicle_brand && <span className="text-xs text-muted-foreground">{o.vehicle_brand} {o.vehicle_model}</span>}
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(o.created_at).toLocaleDateString('de-DE')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Recent Activity */}
                        {(detail?.audit || []).length > 0 && (
                            <div className="glass-card rounded-2xl border border-border/50 p-6">
                                <h3 className="font-bold text-lg mb-4">Admin-Aktivitäten</h3>
                                <div className="space-y-2">
                                    {detail!.audit.slice(0, 5).map(a => (
                                        <div key={a.id} className="flex items-center gap-3 text-sm">
                                            <Clock className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-muted-foreground">
                                                {new Date(a.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className="font-medium">{a.admin_user}</span>
                                            <span className="text-muted-foreground">—</span>
                                            <span>{a.action.replace(/_/g, ' ')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ───── USERS ───── */}
                {activeTab === 'users' && (
                    <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-lg">Benutzer ({detail?.users.length || 0}/{tenant.max_users})</h3>
                            <button onClick={() => setShowAddUser(true)}
                                className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Benutzer hinzufügen
                            </button>
                        </div>

                        {/* Add User Form */}
                        <AnimatePresence>
                            {showAddUser && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="glass-card rounded-xl border border-primary/20 p-4 space-y-3">
                                    <h4 className="font-bold text-sm">Neuen Benutzer erstellen</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="E-Mail *"
                                            className="px-3 py-2 bg-muted/50 border border-border/50 rounded-lg text-sm" />
                                        <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Username"
                                            className="px-3 py-2 bg-muted/50 border border-border/50 rounded-lg text-sm" />
                                        <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Passwort *" type="password"
                                            className="px-3 py-2 bg-muted/50 border border-border/50 rounded-lg text-sm" />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setShowAddUser(false)} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Abbrechen</button>
                                        <button onClick={handleAddUser} disabled={addingUser}
                                            className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50">
                                            {addingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Erstellen'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="glass-card rounded-2xl overflow-hidden border border-border/50">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-muted/40 border-b border-border/50">
                                        <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase">Name</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase">E-Mail</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase">Rolle</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase">Status</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase">Erstellt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {(detail?.users || []).map(u => (
                                        <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                                                        {(u.name || u.username || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium">{u.name || u.username}</div>
                                                        <div className="text-xs text-muted-foreground font-mono">@{u.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-sm">{u.email}</td>
                                            <td className="px-5 py-3">
                                                <span className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary font-bold">{u.role}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                {u.is_active ? (
                                                    <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle className="w-3 h-3" /> Aktiv</span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-xs text-red-500"><XCircle className="w-3 h-3" /> Inaktiv</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-xs text-muted-foreground">
                                                {new Date(u.created_at).toLocaleDateString('de-DE')}
                                            </td>
                                        </tr>
                                    ))}
                                    {(detail?.users || []).length === 0 && (
                                        <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground text-sm">Keine Benutzer</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* ───── ORDERS ───── */}
                {activeTab === 'orders' && (
                    <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <h3 className="font-bold text-lg">Bestellungen ({detail?.orders.length || 0})</h3>
                        <div className="glass-card rounded-2xl overflow-hidden border border-border/50">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-muted/40 border-b border-border/50">
                                        <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase">Status</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase">Teil</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase">OEM</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase">Fahrzeug</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase">Kunde</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase">Betrag</th>
                                        <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase">Datum</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {(detail?.orders || []).map(o => (
                                        <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-5 py-3">
                                                <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-bold ${statusColor(o.status)}`}>
                                                    {o.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-sm font-medium max-w-[200px] truncate">{o.part_name}</td>
                                            <td className="px-5 py-3">
                                                {o.oem_number ? (
                                                    <code className="text-xs font-mono bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded">{o.oem_number}</code>
                                                ) : <span className="text-xs text-muted-foreground">—</span>}
                                            </td>
                                            <td className="px-5 py-3 text-sm text-muted-foreground">
                                                {o.vehicle_brand ? `${o.vehicle_brand} ${o.vehicle_model || ''} ${o.vehicle_year || ''}`.trim() : '—'}
                                            </td>
                                            <td className="px-5 py-3 text-xs text-muted-foreground font-mono">{o.customer || '—'}</td>
                                            <td className="px-5 py-3 text-sm font-medium">
                                                {o.total ? `€${Number(o.total).toFixed(2)}` : '—'}
                                            </td>
                                            <td className="px-5 py-3 text-xs text-muted-foreground">
                                                {new Date(o.created_at).toLocaleDateString('de-DE')}
                                            </td>
                                        </tr>
                                    ))}
                                    {(detail?.orders || []).length === 0 && (
                                        <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground text-sm">Keine Bestellungen</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* ───── DEVICES ───── */}
                {activeTab === 'devices' && (
                    <motion.div key="devices" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <h3 className="font-bold text-lg">Aktive Geräte ({detail?.devices.length || 0}/{tenant.max_devices})</h3>
                        <div className="glass-card rounded-2xl overflow-hidden border border-border/50">
                            {(detail?.devices || []).length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">Keine aktiven Geräte</div>
                            ) : (
                                <div className="divide-y divide-border/30">
                                    {(detail?.devices || []).map((d, i) => (
                                        <div key={d.device_id || i} className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                                    <Smartphone className="w-5 h-5 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium font-mono">{d.device_id?.substring(0, 12) || 'Unbekannt'}...</div>
                                                    <div className="text-xs text-muted-foreground">{d.user_agent?.substring(0, 60) || 'N/A'}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-xs text-muted-foreground">IP: {d.ip_address || 'N/A'}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Zuletzt: {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                    </div>
                                                </div>
                                                <button onClick={async () => {
                                                    try {
                                                        await removeActiveDevice(tenant.id, d.device_id);
                                                        toast.success('Gerät entfernt');
                                                        loadDetail();
                                                    } catch (err: any) { toast.error(err.message); }
                                                }} className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* ───── SETTINGS ───── */}
                {activeTab === 'settings' && (
                    <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl">
                        <h3 className="font-bold text-lg">Händler-Einstellungen</h3>

                        {/* Limits */}
                        <div className="glass-card rounded-2xl border border-border/50 p-6 space-y-4">
                            <h4 className="font-bold text-sm uppercase text-muted-foreground tracking-wider">Limits</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Max. Benutzer</label>
                                    <input type="number" value={editMaxUsers} onChange={e => setEditMaxUsers(Number(e.target.value))}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border/50 rounded-xl text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Max. Geräte</label>
                                    <input type="number" value={editMaxDevices} onChange={e => setEditMaxDevices(Number(e.target.value))}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border/50 rounded-xl text-sm" />
                                </div>
                            </div>
                            <button onClick={handleSaveSettings} disabled={savingSettings}
                                className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50">
                                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}
                            </button>
                        </div>

                        {/* Info */}
                        <div className="glass-card rounded-2xl border border-border/50 p-6 space-y-3">
                            <h4 className="font-bold text-sm uppercase text-muted-foreground tracking-wider">Kontoinformationen</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">WhatsApp:</span>
                                    <div className="font-medium">{detail?.settings?.whatsapp_number || tenant.whatsapp_number || 'Nicht konfiguriert'}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Onboarding:</span>
                                    <div className="font-medium capitalize">{detail?.settings?.onboarding_status || tenant.onboarding_status || 'pending'}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Payment:</span>
                                    <div className="font-medium capitalize">{detail?.settings?.payment_status || tenant.payment_status || 'trial'}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tenant ID:</span>
                                    <div className="font-medium font-mono">{tenant.id}</div>
                                </div>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="glass-card rounded-2xl border border-red-500/20 p-6 space-y-3">
                            <h4 className="font-bold text-sm uppercase text-red-500 tracking-wider">Gefahrenzone</h4>
                            <p className="text-sm text-muted-foreground">
                                Deaktivierte Händler können sich nicht mehr einloggen und haben keinen Zugriff auf das System.
                            </p>
                            <button onClick={handleToggleActive}
                                className={`px-5 py-2 rounded-xl text-sm font-bold ${tenant.is_active
                                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                                    : 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20'}`}>
                                <Shield className="w-4 h-4 inline mr-2" />
                                {tenant.is_active ? 'Händler deaktivieren' : 'Händler aktivieren'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default TenantDetailView;
