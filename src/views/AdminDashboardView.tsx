import { useState, useEffect } from 'react';
import {
    Users, Shield, Smartphone, Activity, Server,
    Globe, LogOut, Plus, Settings, RefreshCcw,
    LayoutDashboard, PieChart, Search, Bell, Menu, X,
    ChevronRight, MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { getAdminStats, listActiveDevices, removeActiveDevice, updateTenantLimits, createTenantUser, AdminStats, ActiveDevice, createTenant } from '../api/wws';
import { toast } from 'sonner';

// Mock Data for Charts (not used anymore, real data coming from API)
// const chartData = [];

export function AdminDashboardView() {
    // --- State ---
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
    const [activeDevices, setActiveDevices] = useState<ActiveDevice[]>([]);

    // UI State
    const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'settings'>('overview');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Modal State
    const [showTenantModal, setShowTenantModal] = useState(false);
    const [newTenantName, setNewTenantName] = useState('');
    const [newTenantEmail, setNewTenantEmail] = useState('');
    const [newTenantPhone, setNewTenantPhone] = useState('');
    const [newTenantWebsite, setNewTenantWebsite] = useState('');
    const [newTenantPassword, setNewTenantPassword] = useState('Start123!');
    const [newTenantWhatsapp, setNewTenantWhatsapp] = useState('');
    const [newTenantLogo, setNewTenantLogo] = useState('');

    const [showUserModal, setShowUserModal] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');

    // --- Effects ---
    useEffect(() => {
        loadStats();
    }, []);

    // --- Actions ---
    const loadStats = async () => {
        try {
            setLoading(true);
            const data = await getAdminStats();
            setStats(data);
        } catch (err: any) {
            toast.error('Fehler beim Laden der Statistiken');
        } finally {
            setLoading(false);
        }
    };

    const loadDevices = async (tenantId: number) => {
        try {
            const data = await listActiveDevices(tenantId);
            setActiveDevices(data);
        } catch (err) {
            toast.error('Geräte konnten nicht geladen werden');
        }
    };

    const handleRemoveDevice = async (tenantId: number, deviceId: string) => {
        try {
            await removeActiveDevice(tenantId, deviceId);
            toast.success('Gerät abgemeldet');
            loadDevices(tenantId);
            loadStats();
        } catch (err) {
            toast.error('Fehler beim Abmelden');
        }
    };

    const handleCreateTenant = async () => {
        try {
            await createTenant({
                name: newTenantName,
                email: newTenantEmail,
                phone: newTenantPhone,
                website: newTenantWebsite,
                password: newTenantPassword,
                whatsapp_number: newTenantWhatsapp,
                logo_url: newTenantLogo
            });


            toast.success('Händler erfolgreich angelegt');
            setShowTenantModal(false);
            resetTenantForm();
            loadStats();
        } catch (err: any) {
            toast.error(err.message || 'Fehler beim Anlegen');
        }
    };

    const handleCreateUser = async () => {
        if (!selectedTenant) return;
        try {
            await createTenantUser(selectedTenant.id, {
                email: newUserEmail,
                username: newUsername,
                password: newUserPassword,
                role: 'TENANT_ADMIN'
            });
            toast.success('Benutzer angelegt');
            setShowUserModal(false);
            resetUserForm();
            loadStats();
        } catch (err: any) {
            toast.error(err.message || 'Fehler beim Anlegen');
        }
    };

    const handleUpdateLimits = async (tenantId: number, maxUsers: number, maxDevices: number) => {
        try {
            await updateTenantLimits(tenantId, { max_users: maxUsers, max_devices: maxDevices });
            toast.success('Limits aktualisiert');
            loadStats();
        } catch (err) {
            toast.error('Fehler beim Aktualisieren');
        }
    };

    // --- Helpers ---
    const resetTenantForm = () => {
        setNewTenantName(''); setNewTenantEmail(''); setNewTenantPhone(''); setNewTenantWebsite('');
        setNewTenantWhatsapp(''); setNewTenantLogo('');
    };
    const resetUserForm = () => {
        setNewUserEmail(''); setNewUsername(''); setNewUserPassword('');
    };

    // --- Renders ---

    if (loading && !stats) {
        return (
            <div className="min-h-screen bg-background p-8 space-y-8 animate-pulse">
                <div className="flex items-center justify-between">
                    <div className="h-10 w-48 bg-muted rounded-xl" />
                    <div className="h-10 w-10 rounded-full bg-muted" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="h-32 rounded-2xl bg-muted" />
                    <div className="h-32 rounded-2xl bg-muted" />
                    <div className="h-32 rounded-2xl bg-muted" />
                </div>
                <div className="h-[400px] rounded-2xl bg-muted" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
            {/* Sidebar */}
            <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: sidebarOpen ? 280 : 0, opacity: 1 }}
                className="h-screen bg-card border-r border-border flex flex-col fixed md:relative z-20 shadow-2xl"
            >
                <div className="p-6 flex items-center gap-3 border-b border-border/50">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-purple-400 flex items-center justify-center shadow-lg shadow-primary/20">
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-xl tracking-tight">Admin</h1>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">Control Center</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <SidebarItem
                        icon={<LayoutDashboard />}
                        label="Übersicht"
                        active={activeTab === 'overview'}
                        onClick={() => setActiveTab('overview')}
                    />
                    <SidebarItem
                        icon={<Users />}
                        label="Händler & Mandanten"
                        active={activeTab === 'tenants'}
                        onClick={() => setActiveTab('tenants')}
                    />
                    <SidebarItem
                        icon={<Settings />}
                        label="Einstellungen"
                        active={activeTab === 'settings'}
                        onClick={() => setActiveTab('settings')}
                    />
                </nav>

                <div className="p-4 border-t border-border/50">
                    <div className="bg-primary/5 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">System Status</p>
                            <p className="text-xs text-green-500 font-bold flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                Operational
                            </p>
                        </div>
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-muted/10 relative">
                {/* Header */}
                <header className="h-16 border-b border-border/50 glass flex items-center justify-between px-6 z-10 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                            <Menu className="w-5 h-5 text-muted-foreground" />
                        </button>
                        <div className="relative hidden md:block group">
                            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" />
                            <input
                                placeholder="Suche..."
                                className="pl-9 pr-4 py-2 bg-muted/50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 w-64 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="p-2 hover:bg-muted rounded-full relative">
                            <Bell className="w-5 h-5 text-muted-foreground" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-background" />
                        </button>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 border-2 border-background shadow-lg" />
                    </div>
                </header>

                {/* Content Scroll Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                    <AnimatePresence mode='wait'>
                        {activeTab === 'overview' && (
                            <motion.div
                                key="overview"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-8"
                            >
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h2 className="text-3xl font-bold tracking-tight">Dashboard Übersicht</h2>
                                        <p className="text-muted-foreground mt-1">Willkommen zurück, Administrator.</p>
                                    </div>
                                    <button
                                        onClick={loadStats}
                                        className="p-2 hover:rotate-180 transition-transform duration-500 text-muted-foreground hover:text-primary"
                                    >
                                        <RefreshCcw className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <StatsCard
                                        title="Gesamt Händler"
                                        value={stats?.total_tenants || 0}
                                        icon={<Globe className="w-5 h-5 text-white" />}
                                        trend="+12% diesen Monat"
                                        color="from-blue-500 to-cyan-400"
                                    />
                                    <StatsCard
                                        title="Aktive Benutzer"
                                        value={stats?.total_users || 0}
                                        icon={<Users className="w-5 h-5 text-white" />}
                                        trend="+5 Neuanmeldungen"
                                        color="from-purple-500 to-pink-500"
                                    />
                                    <StatsCard
                                        title="Aktive Geräte"
                                        value={stats?.total_devices || 0}
                                        icon={<Smartphone className="w-5 h-5 text-white" />}
                                        trend="Online"
                                        color="from-green-500 to-emerald-400"
                                    />
                                </div>

                                {/* Chart Section */}
                                <div className="glass-card rounded-2xl p-6 border border-border/50">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-bold text-lg">Wachstumsanalyse</h3>
                                        <select className="bg-muted/50 border-none rounded-lg text-xs py-1 px-3">
                                            <option>Letzte 6 Monate</option>
                                            <option>Dieses Jahr</option>
                                        </select>
                                    </div>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={stats?.history || []}>
                                                <defs>
                                                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '12px', border: 'none', color: '#fff' }}
                                                    itemStyle={{ color: '#fff' }}
                                                />
                                                <Area type="monotone" dataKey="orders" stroke="#8884d8" strokeWidth={3} fillOpacity={1} fill="url(#colorOrders)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'tenants' && (
                            <motion.div
                                key="tenants"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-6"
                            >
                                <div className="flex justify-between items-center">
                                    <h2 className="text-2xl font-bold">Mandantenverwaltung</h2>
                                    <button
                                        onClick={() => setShowTenantModal(true)}
                                        className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/25 flex items-center gap-2 transition-all active:scale-95"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Neuer Händler
                                    </button>
                                </div>

                                <div className="glass-card rounded-2xl overflow-hidden border border-border/50">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-muted/40 border-b border-border/50">
                                                    <th className="text-left px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Händler / Slug</th>
                                                    <th className="text-left px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Onboarding</th>
                                                    <th className="text-left px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                                                    <th className="text-left px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Benutzer Limit</th>
                                                    <th className="text-left px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Geräte Limit</th>
                                                    <th className="text-right px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Aktionen</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/30">
                                                {stats?.tenants.map((tenant, idx) => (
                                                    <tr key={tenant.id} className="hover:bg-muted/30 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                {tenant.logo_url ? (
                                                                    <img src={tenant.logo_url} alt={tenant.name} className="w-10 h-10 rounded-xl object-cover shadow-md bg-white" />
                                                                ) : (
                                                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${['from-pink-500 to-rose-500', 'from-blue-500 to-indigo-500', 'from-amber-500 to-orange-500'][idx % 3]} flex items-center justify-center font-bold text-lg text-white shadow-md`}>
                                                                        {tenant.name.charAt(0)}
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div className="font-bold text-foreground text-sm">{tenant.name}</div>
                                                                    <div className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 rounded inline-block mt-0.5">{tenant.slug}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1.5">
                                                                <StatusBadge status={tenant.onboarding_status || 'pending'} type="onboarding" />
                                                                <StatusBadge status={tenant.payment_status || 'trial'} type="payment" />
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-2 h-2 rounded-full ${tenant.is_active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                                                <span className="text-sm font-medium">{tenant.is_active ? 'Aktiv' : 'Gesperrt'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <LimitBar current={tenant.user_count} max={tenant.max_users} label="Users" />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <LimitBar current={tenant.device_count} max={tenant.max_devices} label="Devices" />
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                <ActionButton icon={<Smartphone className="w-4 h-4" />} onClick={() => { setSelectedTenant(tenant); loadDevices(tenant.id); }} tooltip="Geräte verwalten" />
                                                                <ActionButton icon={<Users className="w-4 h-4" />} onClick={() => { setSelectedTenant(tenant); setShowUserModal(true); }} tooltip="Benutzer hinzufügen" />
                                                                <ActionButton icon={<Settings className="w-4 h-4" />} onClick={() => {
                                                                    const maxU = prompt('Neues Benutzer Limit:', tenant.max_users.toString());
                                                                    if (maxU) handleUpdateLimits(tenant.id, parseInt(maxU), tenant.max_devices);
                                                                }} tooltip="Limits anpassen" />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'settings' && (
                            <motion.div
                                key="settings"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="max-w-4xl space-y-8"
                            >
                                <div>
                                    <h2 className="text-2xl font-bold">Globale Einstellungen</h2>
                                    <p className="text-muted-foreground">Konfigurieren Sie das Systemverhalten.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-card border border-border/50 p-6 rounded-2xl space-y-4 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500"><Shield className="w-5 h-5" /></div>
                                            <h3 className="font-bold">Wartungsmodus</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground">Wenn aktiviert, können sich keine neuen Händler registrieren und das System ist für Nutzer gesperrt.</p>
                                        <div className="flex items-center justify-between pt-2">
                                            <span className="text-sm font-medium">Status</span>
                                            <button className="w-12 h-6 bg-muted rounded-full relative transition-colors hover:bg-muted/80">
                                                <span className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-card border border-border/50 p-6 rounded-2xl space-y-4 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Globe className="w-5 h-5" /></div>
                                            <h3 className="font-bold">Systemsprache</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground">Standard-Sprache für neue Mandanten und Emails.</p>
                                        <select className="w-full bg-muted/50 border border-border/50 rounded-xl p-2 text-sm mt-2 focus:ring-2 focus:ring-primary/20 outline-none">
                                            <option>Deutsch (Standard)</option>
                                            <option>English</option>
                                        </select>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main >

            {/* Modals & Drawers */}
            <AnimatePresence>
                {
                    selectedTenant && !showUserModal && (
                        <DeviceDrawer
                            tenant={selectedTenant}
                            devices={activeDevices}
                            onClose={() => setSelectedTenant(null)}
                            onRemove={(id: string) => handleRemoveDevice(selectedTenant.id, id)}
                        />
                    )
                }
                {
                    showTenantModal && (
                        <Modal onClose={() => setShowTenantModal(false)} title="Neuen Händler anlegen">
                            <div className="space-y-4">
                                <Input label="Firmenname" value={newTenantName} onChange={setNewTenantName} />
                                <Input label="E-Mail" value={newTenantEmail} onChange={setNewTenantEmail} />
                                <Input label="Telefon" value={newTenantPhone} onChange={setNewTenantPhone} />
                                <Input label="Website" value={newTenantWebsite} onChange={setNewTenantWebsite} />
                                <Input label="WhatsApp Bot Nummer (Twilio)" value={newTenantWhatsapp} onChange={setNewTenantWhatsapp} placeholder="+49 151 ..." />
                                <Input label="Logo URL" value={newTenantLogo} onChange={setNewTenantLogo} placeholder="https://..." />
                                <Input label="Initial Passwort" value={newTenantPassword} onChange={setNewTenantPassword} />
                                <div className="flex justify-end gap-3 mt-6">
                                    <Button variant="ghost" onClick={() => setShowTenantModal(false)}>Abbrechen</Button>
                                    <Button onClick={handleCreateTenant}>Anlegen</Button>
                                </div>
                            </div>
                        </Modal>
                    )
                }
                {
                    showUserModal && (
                        <Modal onClose={() => setShowUserModal(false)} title={`Benutzer für ${selectedTenant?.name}`}>
                            <div className="space-y-4">
                                <Input label="E-Mail" value={newUserEmail} onChange={setNewUserEmail} />
                                <Input label="Benutzername" value={newUsername} onChange={setNewUsername} />
                                <Input label="Passwort" type="password" value={newUserPassword} onChange={setNewUserPassword} />
                                <div className="flex justify-end gap-3 mt-6">
                                    <Button variant="ghost" onClick={() => setShowUserModal(false)}>Abbrechen</Button>
                                    <Button onClick={handleCreateUser}>Benutzer erstellen</Button>
                                </div>
                            </div>
                        </Modal>
                    )
                }
            </AnimatePresence >
        </div >
    );
}

// --- Sub Components ---

const SidebarItem = ({ icon, label, active, onClick }: any) => (
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

const StatsCard = ({ title, value, icon, trend, color }: any) => (
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

const LimitBar = ({ current, max, label }: any) => {
    const percentage = Math.min((current / max) * 100, 100);
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

const StatusBadge = ({ status, type }: any) => {
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

const ActionButton = ({ icon, onClick, tooltip }: any) => (
    <button
        onClick={onClick}
        title={tooltip}
        className="p-2 hover:bg-primary hover:text-white rounded-lg transition-all text-muted-foreground active:scale-95"
    >
        {icon}
    </button>
);

const Modal = ({ children, onClose, title }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
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

const DeviceDrawer = ({ tenant, devices, onClose, onRemove }: any) => (
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

const Input = ({ label, onChange, ...props }: any) => (
    <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">{label}</label>
        <input
            className="w-full px-4 py-2.5 bg-muted/50 border border-transparent focus:border-primary/50 focus:bg-background rounded-xl outline-none transition-all placeholder:text-muted-foreground/50"
            onChange={(e) => onChange?.(e.target.value)}
            {...props}
        />
    </div>
);

const Button = ({ children, variant = 'primary', ...props }: any) => (
    <button
        className={`px-5 py-2.5 rounded-xl font-medium transition-all active:scale-95 ${variant === 'primary'
            ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20'
            : 'bg-transparent hover:bg-muted text-foreground'
            }`}
        {...props}
    >
        {children}
    </button>
);
