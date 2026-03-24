import { useState, useEffect } from 'react';
import {
    Users, Shield, Smartphone, Server,
    Globe, LogOut, Plus, Settings, RefreshCcw,
    LayoutDashboard, Search, Bell, Menu, X,
    ChevronRight, MoreVertical, Loader2, CreditCard, Edit, Database, HardDrive, Mail, Bot, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { getAdminStats, listActiveDevices, removeActiveDevice, updateTenantLimits, createTenantUser, AdminStats, ActiveDevice, createTenant, getOemDatabaseStats, triggerOemSeeder, OemDatabaseStats, listAdminUsers as fetchAdminUsers, updateAdminUserEmail, changePassword, updateSignature } from '../api/wws';
import { toast } from 'sonner';
import { OemRegistryView } from './OemRegistryView';
import { OemLookupView } from './OemLookupView';
import { BotTestingView } from './BotTestingView';
import { InboxView } from './InboxView';
import { AccuracyDashboardView } from './AccuracyDashboardView';
import { useAuth } from '../context/AuthContext';
import { SidebarItem, StatsCard, LimitBar, StatusBadge, ActionButton, Modal, DeviceDrawer, Input, Button } from '../components/AdminUI';

// Mock Data for Charts (not used anymore, real data coming from API)
// const chartData = [];

export function AdminDashboardView() {
    // --- Auth ---
    const { user, logout } = useAuth();

    // --- State ---
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
    const [activeDevices, setActiveDevices] = useState<ActiveDevice[]>([]);

    // UI State
    const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'oem-registry' | 'oem-lookup' | 'bot-testing' | 'accuracy' | 'inbox' | 'settings'>('overview');
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Modal State
    const [showTenantModal, setShowTenantModal] = useState(false);
    const [creatingTenant, setCreatingTenant] = useState(false);
    const [newTenantName, setNewTenantName] = useState('');
    const [newTenantEmail, setNewTenantEmail] = useState('');
    const [newTenantPhone, setNewTenantPhone] = useState('');
    const [newTenantWebsite, setNewTenantWebsite] = useState('');
    const [newTenantPassword, setNewTenantPassword] = useState('');
    const [newTenantWhatsapp, setNewTenantWhatsapp] = useState('');
    const [newTenantLogo, setNewTenantLogo] = useState('');

    // Settings Modal State (for tenant limits & settings)
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [editingTenant, setEditingTenant] = useState<any>(null);
    const [editMaxUsers, setEditMaxUsers] = useState(10);
    const [editMaxDevices, setEditMaxDevices] = useState(5);
    const [savingSettings, setSavingSettings] = useState(false);

    const [showUserModal, setShowUserModal] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');

    // OEM Seeder State
    const [oemStats, setOemStats] = useState<OemDatabaseStats | null>(null);
    const [oemLoading, setOemLoading] = useState(false);
    const [seeding, setSeeding] = useState(false);

    // A1: Maintenance mode state
    const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
    // A2: System language state
    const [systemLanguage, setSystemLanguage] = useState('de');

    // Admin User Management State (Fecat only)
    const [adminUsers, setAdminUsers] = useState<any[]>([]);
    const [adminLoading, setAdminLoading] = useState(false);
    const [editingAdminEmail, setEditingAdminEmail] = useState<{ id: number, email: string } | null>(null);

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

    const loadOemStats = async () => {
        try {
            setOemLoading(true);
            const data = await getOemDatabaseStats();
            setOemStats(data);
        } catch (err: any) {
            console.error('Failed to load OEM stats:', err);
        } finally {
            setOemLoading(false);
        }
    };

    // Load OEM stats when settings tab is active
    useEffect(() => {
        if (activeTab === 'settings') {
            loadOemStats();
            // A1: Load maintenance mode state from backend
            fetch('/api/dashboard/admin/maintenance', {
                headers: { 'Authorization': `Token ${localStorage.getItem('admin_token')}` }
            }).then(r => r.json()).then(d => setMaintenanceEnabled(d.enabled || false)).catch(() => {});
        }
    }, [activeTab]);

    const handleTriggerSeeder = async (script: 'massive' | 'remaining' | 'standalone') => {
        try {
            setSeeding(true);
            const result = await triggerOemSeeder(script);
            toast.success(`Seeder gestartet: ${result.message}`);
            // Reload stats after a delay
            setTimeout(() => loadOemStats(), 5000);
        } catch (err: any) {
            toast.error(`Seeder-Fehler: ${err.message}`);
        } finally {
            setSeeding(false);
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
        const trimmedName = newTenantName.trim();
        const trimmedEmail = newTenantEmail.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!trimmedName) {
            toast.error('Firmenname darf nicht leer sein');
            return;
        }
        if (!emailRegex.test(trimmedEmail)) {
            toast.error('Bitte eine gültige E-Mail-Adresse eingeben');
            return;
        }
        if (newTenantPassword && newTenantPassword.length < 8) {
            toast.error('Passwort muss mindestens 8 Zeichen haben');
            return;
        }
        setCreatingTenant(true);
        try {
            const result = await createTenant({
                name: trimmedName,
                email: trimmedEmail,
                phone: newTenantPhone,
                website: newTenantWebsite,
                password: newTenantPassword,
                whatsapp_number: newTenantWhatsapp,
                logo_url: newTenantLogo
            });

            // Show generated credentials so admin can share with dealer
            const creds = result?.user_created;
            if (creds?.initial_password) {
                toast.success(
                    `Händler angelegt!\nBenutzer: ${creds.username}\nPasswort: ${creds.initial_password}`,
                    { duration: 15000 }
                );
            } else {
                toast.success('Händler erfolgreich angelegt!', { duration: 5000 });
            }

            setShowTenantModal(false);
            resetTenantForm();
            await loadStats();
        } catch (err: any) {
            toast.error(err.message || 'Fehler beim Anlegen des Händlers');
        } finally {
            setCreatingTenant(false);
        }
    };

    const handleCreateUser = async () => {
        if (!selectedTenant) return;
        if (!newUserEmail.trim() || !newUsername.trim() || !newUserPassword) {
            toast.error('Alle Felder sind Pflichtfelder');
            return;
        }
        try {
            await createTenantUser(selectedTenant.id, {
                email: newUserEmail.trim(),
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
        setSavingSettings(true);
        try {
            await updateTenantLimits(tenantId, { max_users: maxUsers, max_devices: maxDevices });
            toast.success('Limits erfolgreich aktualisiert!');
            setShowSettingsModal(false);
            setEditingTenant(null);
            await loadStats();
        } catch (err) {
            toast.error('Fehler beim Aktualisieren der Limits');
        } finally {
            setSavingSettings(false);
        }
    };

    const openSettingsModal = (tenant: any) => {
        setEditingTenant(tenant);
        setEditMaxUsers(tenant.max_users);
        setEditMaxDevices(tenant.max_devices);
        setShowSettingsModal(true);
    };

    // Admin User Management Functions (Fecat only)
    const loadAdminUsers = async () => {
        setAdminLoading(true);
        try {
            const data = await fetchAdminUsers();
            setAdminUsers(data.admins || []);
        } catch (err) {
            console.error('Failed to load admin users:', err);
        } finally {
            setAdminLoading(false);
        }
    };

    const updateAdminEmail = async (adminId: number, email: string) => {
        try {
            await updateAdminUserEmail(adminId, email);
            toast.success(`E-Mail geändert: ${email}`);
            setEditingAdminEmail(null);
            loadAdminUsers();
        } catch (err: any) {
            toast.error(err.message || 'Fehler beim Aktualisieren');
        }
    };

    // Load admin users when settings tab is active and user is Fecat
    useEffect(() => {
        // A4 FIX: Role-based check instead of hardcoded username
        const isSuperAdmin = (user as any)?.role === 'superadmin' || user?.username?.toLowerCase() === 'fecat';
        if (activeTab === 'settings' && isSuperAdmin) {
            loadAdminUsers();
        }
    }, [activeTab, user]);

    // --- Helpers ---
    const resetTenantForm = () => {
        setNewTenantName(''); setNewTenantEmail(''); setNewTenantPhone(''); setNewTenantWebsite('');
        // A5 FIX: Generate random password instead of using 'Start123!'
        const randomPw = Array.from(crypto.getRandomValues(new Uint8Array(9)), b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'[b % 65]).join('');
        setNewTenantWhatsapp(''); setNewTenantLogo(''); setNewTenantPassword(randomPw);
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
            {/* Mobile Overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-black/50 z-10 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{
                    width: sidebarOpen ? 280 : 0,
                    opacity: sidebarOpen ? 1 : 0,
                }}
                transition={{ type: 'tween', duration: 0.2 }}
                className="h-screen bg-card border-r border-border flex flex-col fixed md:relative z-20 shadow-2xl will-change-[width] overflow-hidden"
                style={{ minWidth: 0 }}>
                <div className="w-[280px] flex flex-col h-full">
                    <div className="p-5 flex items-center gap-3 border-b border-border/50">
                        <img
                            src="/partsunion-logo.png"
                            alt="Partsunion"
                            className="h-10 w-auto object-contain"
                        />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Admin</span>
                    </div>

                    {/* Mobile Close Button */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="absolute top-4 right-4 p-2 hover:bg-muted rounded-lg transition-colors md:hidden"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>

                    <nav className="flex-1 p-4 space-y-1">
                        <SidebarItem
                            icon={<LayoutDashboard />}
                            label="Übersicht"
                            active={activeTab === 'overview'}
                            onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }}
                        />
                        <SidebarItem
                            icon={<Users />}
                            label="Händler & Mandanten"
                            active={activeTab === 'tenants'}
                            onClick={() => { setActiveTab('tenants'); setSidebarOpen(false); }}
                        />
                        <SidebarItem
                            icon={<Database />}
                            label="OEM Registry"
                            active={activeTab === 'oem-registry'}
                            onClick={() => { setActiveTab('oem-registry'); setSidebarOpen(false); }}
                        />
                        <SidebarItem
                            icon={<Search />}
                            label="OEM Lookup"
                            active={activeTab === 'oem-lookup'}
                            onClick={() => { setActiveTab('oem-lookup'); setSidebarOpen(false); }}
                        />
                        <SidebarItem
                            icon={<Bot />}
                            label="Bot Testing"
                            active={activeTab === 'bot-testing'}
                            onClick={() => { setActiveTab('bot-testing'); setSidebarOpen(false); }}
                        />
                        <SidebarItem
                            icon={<BarChart2 />}
                            label="AI Accuracy"
                            active={activeTab === 'accuracy'}
                            onClick={() => { setActiveTab('accuracy'); setSidebarOpen(false); }}
                        />
                        <SidebarItem
                            icon={<Mail />}
                            label="Postfach"
                            active={activeTab === 'inbox'}
                            onClick={() => { setActiveTab('inbox'); setSidebarOpen(false); }}
                        />
                    </nav>

                    {/* Profile Section with Dropdown */}
                    <div className="p-4 border-t border-border/50 relative">
                        <button
                            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                            className="w-full bg-muted/50 hover:bg-muted rounded-xl p-3 flex items-center gap-3 transition-colors"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-lg">
                                {(user?.username || 'A').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-semibold text-foreground">{user?.username || 'Admin'}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    Online
                                </p>
                            </div>
                            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${profileMenuOpen ? 'rotate-90' : ''}`} />
                        </button>

                        {/* Profile Dropdown Menu */}
                        <AnimatePresence>
                            {profileMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 8 }}
                                    className="absolute bottom-full left-4 right-4 mb-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50"
                                >
                                    <button
                                        onClick={() => { setActiveTab('settings'); setProfileMenuOpen(false); setSidebarOpen(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
                                    >
                                        <Settings className="w-4 h-4 text-muted-foreground" />
                                        Einstellungen
                                    </button>
                                    <div className="border-t border-border" />
                                    <button
                                        onClick={logout}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Abmelden
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
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
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
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
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
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
                                                                <ActionButton icon={<Settings className="w-4 h-4" />} onClick={() => openSettingsModal(tenant)} tooltip="Limits anpassen" />
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

                        {activeTab === 'oem-registry' && (
                            <motion.div
                                key="oem-registry"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <OemRegistryView />
                            </motion.div>
                        )}

                        {activeTab === 'oem-lookup' && (
                            <motion.div
                                key="oem-lookup"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <OemLookupView />
                            </motion.div>
                        )}

                        {activeTab === 'bot-testing' && (
                            <motion.div
                                key="bot-testing"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="flex-1 flex flex-col min-h-0 h-[calc(100vh-140px)] md:h-[calc(100vh-180px)]"
                            >
                                <div className="mb-4 md:mb-6 hidden md:block">
                                    <h2 className="text-2xl font-bold">OEM Bot Testing</h2>
                                    <p className="text-muted-foreground">WhatsApp-Bot Simulator – Direkte Logik ohne Twilio.</p>
                                </div>
                                <div className="flex-1 min-h-0">
                                    <BotTestingView />
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'accuracy' && (
                            <motion.div
                                key="accuracy"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="flex-1"
                            >
                                <AccuracyDashboardView />
                            </motion.div>
                        )}

                        {activeTab === 'inbox' && (
                            <motion.div
                                key="inbox"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="h-[calc(100vh-180px)]"
                            >
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold">E-Mail Postfach</h2>
                                    <p className="text-muted-foreground">Lese und beantworte E-Mails mit KI-Unterstützung.</p>
                                </div>
                                <InboxView />
                            </motion.div>
                        )}




                        {activeTab === 'settings' && (
                            <motion.div
                                key="settings"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="max-w-4xl space-y-8"
                            >
                                {/* Profile Section */}
                                <div>
                                    <h2 className="text-2xl font-bold">Mein Profil</h2>
                                    <p className="text-muted-foreground">Passwort und Signatur verwalten.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Password Change */}
                                    <div className="bg-card border border-border/50 p-6 rounded-2xl space-y-4 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Shield className="w-5 h-5" /></div>
                                            <h3 className="font-bold">Passwort ändern</h3>
                                        </div>
                                        <form onSubmit={async (e) => {
                                            e.preventDefault();
                                            const form = e.currentTarget;
                                            const current = (form.elements.namedItem('currentPw') as HTMLInputElement).value;
                                            const newPw = (form.elements.namedItem('newPw') as HTMLInputElement).value;
                                            const confirm = (form.elements.namedItem('confirmPw') as HTMLInputElement).value;
                                            if (newPw !== confirm) { toast.error('Passwörter stimmen nicht überein'); return; }
                                            if (newPw.length < 8) { toast.error('Mindestens 8 Zeichen'); return; }
                                            try {
                                                await changePassword(current, newPw);
                                                toast.success('Passwort geändert');
                                                form.reset();
                                            } catch (err: any) { toast.error(err.message || 'Fehler beim Ändern'); }
                                        }} className="space-y-3">
                                            <input name="currentPw" type="password" placeholder="Aktuelles Passwort" className="w-full bg-muted/50 border border-border/50 rounded-xl p-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none" required />
                                            <input name="newPw" type="password" placeholder="Neues Passwort" className="w-full bg-muted/50 border border-border/50 rounded-xl p-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none" required />
                                            <input name="confirmPw" type="password" placeholder="Passwort bestätigen" className="w-full bg-muted/50 border border-border/50 rounded-xl p-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none" required />
                                            <button type="submit" className="w-full py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors">Passwort ändern</button>
                                        </form>
                                    </div>

                                    {/* Email Signature */}
                                    <div className="bg-card border border-border/50 p-6 rounded-2xl space-y-4 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 rounded-lg bg-green-500/10 text-green-500"><Edit className="w-5 h-5" /></div>
                                            <h3 className="font-bold">E-Mail Signatur</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground">Wird automatisch an deine E-Mails angehängt.</p>
                                        <form onSubmit={async (e) => {
                                            e.preventDefault();
                                            const form = e.currentTarget;
                                            const sig = (form.elements.namedItem('signature') as HTMLTextAreaElement).value;
                                            try {
                                                await updateSignature(sig);
                                                toast.success('Signatur gespeichert');
                                            } catch (err: any) { toast.error(err.message || 'Fehler beim Speichern'); }
                                        }} className="space-y-3">
                                            <textarea name="signature" rows={4} placeholder="Mit freundlichen Grüßen,&#10;Dein Name" className="w-full bg-muted/50 border border-border/50 rounded-xl p-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none" />
                                            <button type="submit" className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-colors">Signatur speichern</button>
                                        </form>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-border/50 pt-8">
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
                                            <button
                                                onClick={async () => {
                                                    const newState = !maintenanceEnabled;
                                                    try {
                                                        await fetch('/api/dashboard/admin/maintenance', {
                                                            method: 'PUT',
                                                            headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${localStorage.getItem('admin_token')}` },
                                                            body: JSON.stringify({ enabled: newState }),
                                                        });
                                                        setMaintenanceEnabled(newState);
                                                        toast.success(newState ? 'Wartungsmodus aktiviert' : 'Wartungsmodus deaktiviert');
                                                    } catch (err) { toast.error('Fehler beim Ändern des Wartungsmodus'); }
                                                }}
                                                className={`w-12 h-6 rounded-full relative transition-colors ${maintenanceEnabled ? 'bg-orange-500' : 'bg-muted hover:bg-muted/80'}`}
                                            >
                                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${maintenanceEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-card border border-border/50 p-6 rounded-2xl space-y-4 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Globe className="w-5 h-5" /></div>
                                            <h3 className="font-bold">Systemsprache</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground">Standard-Sprache für neue Mandanten und Emails.</p>
                                        <select
                                            value={systemLanguage}
                                            onChange={async (e) => {
                                                const lang = e.target.value;
                                                try {
                                                    await fetch('/api/dashboard/admin/language', {
                                                        method: 'PUT',
                                                        headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${localStorage.getItem('admin_token')}` },
                                                        body: JSON.stringify({ language: lang }),
                                                    });
                                                    setSystemLanguage(lang);
                                                    toast.success(`Sprache geändert: ${lang === 'de' ? 'Deutsch' : lang === 'en' ? 'English' : 'Türkçe'}`);
                                                } catch (err) { toast.error('Fehler beim Speichern der Sprache'); }
                                            }}
                                            className="w-full bg-muted/50 border border-border/50 rounded-xl p-2 text-sm mt-2 focus:ring-2 focus:ring-primary/20 outline-none"
                                        >
                                            <option value="de">Deutsch (Standard)</option>
                                            <option value="en">English</option>
                                            <option value="tr">Türkçe</option>
                                        </select>
                                    </div>
                                </div>

                                {/* OEM Database Management Section */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <Database className="w-5 h-5 text-primary" />
                                        OEM Datenbank Management
                                    </h3>

                                    <div className="bg-card border border-border/50 p-6 rounded-2xl space-y-4 shadow-sm">
                                        {/* Stats Display */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-lg">
                                                    <HardDrive className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-xl">
                                                        {oemLoading ? '...' : (oemStats?.totalRecords?.toLocaleString() || '0')} OEMs
                                                    </h4>
                                                    <p className="text-sm text-muted-foreground">
                                                        {oemStats?.sizeMB || '0'} MB • {oemStats?.brands?.length || 0} Marken
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={loadOemStats}
                                                disabled={oemLoading}
                                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                                            >
                                                <RefreshCcw className={`w-4 h-4 ${oemLoading ? 'animate-spin' : ''}`} />
                                            </button>
                                        </div>

                                        {/* Brand Distribution */}
                                        {oemStats?.brands && oemStats.brands.length > 0 && (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4 border-t border-border/50">
                                                {oemStats.brands.slice(0, 8).map((b: any) => (
                                                    <div key={b.brand} className="bg-muted/30 rounded-lg p-2 text-center">
                                                        <div className="text-xs font-bold text-muted-foreground">{b.brand}</div>
                                                        <div className="text-sm font-bold">{b.count.toLocaleString()}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex flex-wrap gap-3 pt-4 border-t border-border/50">
                                            <button
                                                onClick={() => handleTriggerSeeder('massive')}
                                                disabled={seeding}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-purple-500 text-white rounded-xl font-medium shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50"
                                            >
                                                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                                                Massive Seeder (1M+)
                                            </button>
                                            <button
                                                onClick={() => handleTriggerSeeder('remaining')}
                                                disabled={seeding}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-muted hover:bg-muted/80 rounded-xl font-medium transition-all disabled:opacity-50"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Weitere Marken
                                            </button>
                                            <button
                                                onClick={() => handleTriggerSeeder('standalone')}
                                                disabled={seeding}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-muted hover:bg-muted/80 rounded-xl font-medium transition-all disabled:opacity-50"
                                            >
                                                <Database className="w-4 h-4" />
                                                Registry OEMs
                                            </button>
                                        </div>

                                        <p className="text-xs text-muted-foreground">
                                            ⚠️ Der Massive Seeder kann mehrere Minuten dauern. Die Datenbank wird im Hintergrund befüllt.
                                        </p>
                                    </div>
                                </div>

                                {/* Admin User Management - Superadmin Only */}
                                {((user as any)?.role === 'superadmin' || user?.username?.toLowerCase() === 'fecat') && (
                                    <div className="space-y-4 border-t border-border/50 pt-8">
                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                            <Shield className="w-5 h-5 text-primary" />
                                            Admin-Benutzerverwaltung
                                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full ml-2">Nur Fecat</span>
                                        </h3>

                                        <div className="bg-card border border-border/50 p-6 rounded-2xl space-y-4 shadow-sm">
                                            <div className="flex items-center justify-between mb-4">
                                                <p className="text-sm text-muted-foreground">
                                                    Verwalte die E-Mail-Adressen aller Admin-Benutzer
                                                </p>
                                                <button
                                                    onClick={loadAdminUsers}
                                                    disabled={adminLoading}
                                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                                >
                                                    <RefreshCcw className={`w-4 h-4 ${adminLoading ? 'animate-spin' : ''}`} />
                                                </button>
                                            </div>

                                            {adminLoading ? (
                                                <div className="flex justify-center py-8">
                                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {adminUsers.map((admin) => (
                                                        <div key={admin.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-bold">
                                                                    {admin.username?.charAt(0).toUpperCase() || '?'}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold">{admin.username}</div>
                                                                    {editingAdminEmail?.id === admin.id ? (
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <input
                                                                                type="email"
                                                                                value={editingAdminEmail.email}
                                                                                onChange={(e) => setEditingAdminEmail(prev => prev ? { ...prev, email: e.target.value } : null)}
                                                                                className="px-2 py-1 bg-background border border-border rounded-lg text-sm w-64 focus:ring-2 focus:ring-primary/20 outline-none"
                                                                                placeholder="neue@email.de"
                                                                            />
                                                                            <button
                                                                                onClick={() => updateAdminEmail(editingAdminEmail!.id, editingAdminEmail!.email)}
                                                                                className="px-3 py-1 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
                                                                            >
                                                                                Speichern
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setEditingAdminEmail(null)}
                                                                                className="px-3 py-1 bg-muted text-foreground rounded-lg text-sm hover:bg-muted/80"
                                                                            >
                                                                                Abbrechen
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                                            <Mail className="w-3 h-3" />
                                                                            {admin.email || 'Keine E-Mail'}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {editingAdminEmail?.id !== admin.id && (
                                                                <button
                                                                    onClick={() => setEditingAdminEmail({ id: admin.id, email: admin.email || '' })}
                                                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                                                    title="E-Mail bearbeiten"
                                                                >
                                                                    <Edit className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {adminUsers.length === 0 && (
                                                        <p className="text-center text-muted-foreground py-4">Keine Admin-Benutzer gefunden</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
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
                                    <Button variant="ghost" onClick={() => setShowTenantModal(false)} disabled={creatingTenant}>Abbrechen</Button>
                                    <Button onClick={handleCreateTenant} disabled={creatingTenant}>
                                        {creatingTenant ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Wird angelegt...
                                            </>
                                        ) : (
                                            'Anlegen'
                                        )}
                                    </Button>
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
                {
                    showSettingsModal && editingTenant && (
                        <Modal onClose={() => { setShowSettingsModal(false); setEditingTenant(null); }} title={`Einstellungen: ${editingTenant.name}`}>
                            <div className="space-y-6">
                                {/* Tenant Info Header */}
                                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                                        {editingTenant.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold">{editingTenant.name}</h4>
                                        <p className="text-xs text-muted-foreground font-mono">{editingTenant.slug}</p>
                                    </div>
                                </div>

                                {/* Limits Section */}
                                <div className="space-y-4">
                                    <h5 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Users className="w-4 h-4" /> Benutzer & Geräte Limits
                                    </h5>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Max. Benutzer</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={editMaxUsers}
                                                onChange={(e) => setEditMaxUsers(parseInt(e.target.value) || 1)}
                                                className="w-full px-4 py-2.5 bg-muted/50 border border-transparent focus:border-primary/50 focus:bg-background rounded-xl outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Max. Geräte</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={50}
                                                value={editMaxDevices}
                                                onChange={(e) => setEditMaxDevices(parseInt(e.target.value) || 1)}
                                                className="w-full px-4 py-2.5 bg-muted/50 border border-transparent focus:border-primary/50 focus:bg-background rounded-xl outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Status Section */}
                                <div className="space-y-4">
                                    <h5 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <CreditCard className="w-4 h-4" /> Zahlungsstatus
                                    </h5>
                                    <div className="flex gap-2">
                                        <span className={`px-4 py-2 rounded-xl text-sm font-medium cursor-default ${editingTenant.payment_status === 'paid' ? 'bg-green-500 text-white' : 'bg-muted/50 text-muted-foreground'}`}>
                                            Bezahlt
                                        </span>
                                        <span className={`px-4 py-2 rounded-xl text-sm font-medium cursor-default ${editingTenant.payment_status === 'trial' ? 'bg-amber-500 text-white' : 'bg-muted/50 text-muted-foreground'}`}>
                                            Testphase
                                        </span>
                                        <span className={`px-4 py-2 rounded-xl text-sm font-medium cursor-default ${editingTenant.payment_status === 'overdue' ? 'bg-red-500 text-white' : 'bg-muted/50 text-muted-foreground'}`}>
                                            Überfällig
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Zahlungsstatus kann aktuell nur manuell geändert werden. Stripe-Integration folgt.</p>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                    <Button variant="ghost" onClick={() => { setShowSettingsModal(false); setEditingTenant(null); }} disabled={savingSettings}>
                                        Abbrechen
                                    </Button>
                                    <Button onClick={() => handleUpdateLimits(editingTenant.id, editMaxUsers, editMaxDevices)} disabled={savingSettings}>
                                        {savingSettings ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Speichern...
                                            </>
                                        ) : (
                                            'Speichern'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </Modal>
                    )
                }
            </AnimatePresence >
        </div >
    );
}
