import { useState, useEffect } from 'react';
import {
    Users, Shield, Smartphone, Server,
    Globe, LogOut, Plus, Settings, RefreshCcw,
    LayoutDashboard, Search, Bell, Menu, X,
    ChevronRight, MoreVertical, Loader2, CreditCard, Edit, Database, HardDrive, Mail, Bot, BarChart2, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { getAdminStats, listActiveDevices, removeActiveDevice, updateTenantLimits, createTenantUser, AdminStats, ActiveDevice, createTenant, getOemDatabaseStats, triggerOemSeeder, OemDatabaseStats, listAdminUsers as fetchAdminUsers, updateAdminUserEmail, changePassword, updateSignature, deactivateTenant, activateTenant, getAuditLog, AuditLogEntry } from '../api/wws';
import { toast } from 'sonner';
import { OemRegistryView } from './OemRegistryView';
import { OemLookupView } from './OemLookupView';
import { BotTestingView } from './BotTestingView';
import { InboxView } from './InboxView';
import { AccuracyDashboardView } from './AccuracyDashboardView';
import { TenantDetailView } from './TenantDetailView';
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
    const [viewingTenant, setViewingTenant] = useState<any | null>(null);

    // UI State
    const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'oem-registry' | 'oem-lookup' | 'bot-testing' | 'accuracy' | 'inbox' | 'audit' | 'settings'>('overview');
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Tenant Creation State (inline form, not modal)
    const [showTenantForm, setShowTenantForm] = useState(false);
    const [creatingTenant, setCreatingTenant] = useState(false);
    const [newTenantName, setNewTenantName] = useState('');
    const [newTenantEmail, setNewTenantEmail] = useState('');
    const [newTenantPhone, setNewTenantPhone] = useState('');
    const [newTenantWebsite, setNewTenantWebsite] = useState('');
    const [newTenantPassword, setNewTenantPassword] = useState('');
    const [newTenantWhatsapp, setNewTenantWhatsapp] = useState('');
    const [newTenantLogo, setNewTenantLogo] = useState('');
    const [wizardStep, setWizardStep] = useState(1);

    // Tenant Search & Filter
    const [tenantSearch, setTenantSearch] = useState('');
    const [tenantStatusFilter, setTenantStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [tenantPaymentFilter, setTenantPaymentFilter] = useState<'all' | 'paid' | 'trial' | 'overdue'>('all');

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

    // Audit Log State
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

    // --- Effects ---
    useEffect(() => {
        loadStats();
        
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile && sidebarOpen) {
                setSidebarOpen(false); // auto-close on mobile initially
            }
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Auto-load audit logs when switching to audit tab
    useEffect(() => {
        if (activeTab === 'audit') {
            getAuditLog().then(d => setAuditLogs(d.logs)).catch(() => {});
        }
    }, [activeTab]);

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

            setShowTenantForm(false);
            resetTenantForm();
            await loadStats();
        } catch (err: any) {
            toast.error('Fehler beim Anlegen des Händlers. Bitte überprüfen Sie die Eingaben.');
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
        // Generate 12-char password guaranteed to pass backend complexity (upper+lower+digit+special)
        const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const lower = 'abcdefghjkmnpqrstuvwxyz';
        const digits = '23456789';
        const special = '!@#$%&*';
        const all = upper + lower + digits + special;
        const bytes = crypto.getRandomValues(new Uint8Array(12));
        const pw = [upper[bytes[0] % upper.length], lower[bytes[1] % lower.length], digits[bytes[2] % digits.length], special[bytes[3] % special.length]];
        for (let i = 4; i < 12; i++) pw.push(all[bytes[i] % all.length]);
        // Shuffle
        for (let i = pw.length - 1; i > 0; i--) { const j = bytes[i] % (i + 1); [pw[i], pw[j]] = [pw[j], pw[i]]; }
        setNewTenantWhatsapp(''); setNewTenantLogo(''); setNewTenantPassword(pw.join(''));
        setWizardStep(1);
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
                    width: sidebarOpen ? (isMobile ? 280 : 280) : (isMobile ? 0 : 72),
                }}
                transition={{ type: 'tween', duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="h-screen bg-card border-r border-border flex flex-col fixed md:relative z-20 will-change-[width] overflow-hidden shadow-[2px_0_12px_rgba(0,0,0,0.02)]">
                <div className={`${sidebarOpen ? 'w-[280px]' : (isMobile ? 'w-0' : 'w-[72px]')} flex flex-col h-full transition-all duration-200 overflow-hidden`}>
                    <div className={`p-5 flex items-center border-b border-border/50 ${sidebarOpen ? 'gap-3' : 'justify-center'}`}>
                        {sidebarOpen ? (
                            <>
                                <img src="/partsunion-logo.png" alt="Partsunion" className="h-10 w-auto object-contain" />
                                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Admin</span>
                            </>
                        ) : (
                            <div className="icon-box w-9 h-9 text-sm font-extrabold" title="Partsunion Admin">P</div>
                        )}
                    </div>

                    {/* Mobile Close */}
                    {sidebarOpen && (
                        <button onClick={() => setSidebarOpen(false)}
                            className="absolute top-4 right-4 p-2 hover:bg-muted rounded-lg transition-colors md:hidden">
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    )}

                    <nav className={`flex-1 ${sidebarOpen ? 'p-4' : 'p-2'} space-y-1`}>
                        <SidebarItem icon={<LayoutDashboard />} label="Übersicht" active={activeTab === 'overview'}
                            onClick={() => { setActiveTab('overview'); }} collapsed={!sidebarOpen} />
                        <SidebarItem icon={<Users />} label="Händler & Mandanten" active={activeTab === 'tenants'}
                            onClick={() => { setActiveTab('tenants'); }} collapsed={!sidebarOpen} />
                        <SidebarItem icon={<Database />} label="OEM Registry" active={activeTab === 'oem-registry'}
                            onClick={() => { setActiveTab('oem-registry'); }} collapsed={!sidebarOpen} />
                        <SidebarItem icon={<Search />} label="OEM Lookup" active={activeTab === 'oem-lookup'}
                            onClick={() => { setActiveTab('oem-lookup'); }} collapsed={!sidebarOpen} />
                        <SidebarItem icon={<Bot />} label="Bot Testing" active={activeTab === 'bot-testing'}
                            onClick={() => { setActiveTab('bot-testing'); }} collapsed={!sidebarOpen} />
                        <SidebarItem icon={<BarChart2 />} label="AI Accuracy" active={activeTab === 'accuracy'}
                            onClick={() => { setActiveTab('accuracy'); }} collapsed={!sidebarOpen} />
                        <SidebarItem icon={<Mail />} label="Postfach" active={activeTab === 'inbox'}
                            onClick={() => { setActiveTab('inbox'); }} collapsed={!sidebarOpen} />
                        <SidebarItem icon={<Shield />} label="Audit Log" active={activeTab === 'audit'}
                            onClick={() => { setActiveTab('audit'); }} collapsed={!sidebarOpen} />
                    </nav>

                    <div className="p-4 border-t border-border/50 relative">
                        {sidebarOpen ? (
                            <button onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                                className="w-full bg-muted/50 hover:bg-muted rounded-xl p-3 flex items-center gap-3 transition-colors">
                                <div className="icon-box w-10 h-10 text-sm font-bold flex-shrink-0">
                                    {(user?.username || 'A').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-semibold text-foreground">{user?.username || 'Admin'}</p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-success" /> Online
                                    </p>
                                </div>
                                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${profileMenuOpen ? 'rotate-90' : ''}`} />
                            </button>
                        ) : (
                            <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} title={user?.username || 'Admin'}
                                className="w-full flex justify-center">
                                <div className="icon-box w-10 h-10 text-sm font-bold">
                                    {(user?.username || 'A').charAt(0).toUpperCase()}
                                </div>
                            </button>
                        )}

                        <AnimatePresence>
                            {profileMenuOpen && (
                                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                                    className="absolute bottom-full left-2 right-2 mb-2 modal-card rounded-xl overflow-hidden z-50">
                                    <button onClick={() => { setActiveTab('settings'); setProfileMenuOpen(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors">
                                        <Settings className="w-4 h-4 text-muted-foreground" /> Einstellungen
                                    </button>
                                    <div className="border-t border-border" />
                                    <button onClick={logout}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-danger hover:bg-danger-light transition-colors">
                                        <LogOut className="w-4 h-4" /> Abmelden
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
                            <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full border-2 border-background" />
                        </button>
                        <div className="icon-box w-8 h-8 text-xs font-bold rounded-full">
                            {(user?.username || 'A').charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                {/* Content Scroll Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                    <>
                        {activeTab === 'overview' && (
                            <div
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
                                    <StatsCard title="Gesamt Händler" value={stats?.total_tenants || 0}
                                        icon={<Globe className="w-5 h-5 text-primary-foreground" />}
                                        trend="+12% diesen Monat" color="from-primary to-primary/70" />
                                    <StatsCard title="Aktive Benutzer" value={stats?.total_users || 0}
                                        icon={<Users className="w-5 h-5 text-primary-foreground" />}
                                        trend="+5 Neuanmeldungen" color="from-accent to-accent/70" />
                                    <StatsCard title="Aktive Geräte" value={stats?.total_devices || 0}
                                        icon={<Smartphone className="w-5 h-5 text-primary-foreground" />}
                                        trend="Online" color="from-primary to-primary/60" />
                                </div>

                                {/* Business KPIs */}
                                {stats?.kpis && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="glass-card rounded-2xl p-5 border border-border/50">
                                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Bestellungen Gesamt</div>
                                            <div className="text-3xl font-bold text-foreground">{stats.kpis.sales.totalOrders}</div>
                                            <div className="text-sm text-success mt-1">+{stats.kpis.sales.ordersToday} heute</div>
                                        </div>
                                        <div className="glass-card rounded-2xl p-5 border border-border/50">
                                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Umsatz</div>
                                            <div className="text-3xl font-bold text-foreground">€{(stats.kpis.sales.revenue || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
                                            <div className="text-sm text-muted-foreground mt-1">{stats.kpis.sales.conversionRate}% Conversion</div>
                                        </div>
                                        <div className="glass-card rounded-2xl p-5 border border-border/50">
                                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">OEM Aufgelöst</div>
                                            <div className="text-3xl font-bold text-foreground">{stats.kpis.oem.resolvedCount}</div>
                                            <div className="text-sm text-brand mt-1">{stats.kpis.oem.successRate}% Erfolgsquote</div>
                                        </div>
                                        <div className="glass-card rounded-2xl p-5 border border-border/50">
                                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Nachrichten</div>
                                            <div className="text-3xl font-bold text-foreground">{stats.kpis.team.messagesSent}</div>
                                            <div className="text-sm text-stat-4 mt-1">{stats.kpis.team.activeUsers} aktive User</div>
                                        </div>
                                    </div>
                                )}

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
                            </div>
                        )}

                        {activeTab === 'tenants' && (() => {
                            // Filter tenants
                            const filteredTenants = (stats?.tenants || []).filter(t => {
                                if (tenantSearch) {
                                    const q = tenantSearch.toLowerCase();
                                    if (!t.name.toLowerCase().includes(q) && !t.slug.toLowerCase().includes(q)) return false;
                                }
                                if (tenantStatusFilter === 'active' && !t.is_active) return false;
                                if (tenantStatusFilter === 'inactive' && t.is_active) return false;
                                if (tenantPaymentFilter !== 'all' && (t.payment_status || 'trial') !== tenantPaymentFilter) return false;
                                return true;
                            });

                            return (
                            <div className="space-y-6">
                                {viewingTenant ? (
                                    <TenantDetailView
                                        tenant={viewingTenant}
                                        onBack={() => setViewingTenant(null)}
                                        onRefresh={() => { loadStats(); setViewingTenant(null); }}
                                    />
                                ) : showTenantForm ? (
                                    /* ── Inline Tenant Creation Form ── */
                                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => { setShowTenantForm(false); setWizardStep(1); }} className="p-2 hover:bg-muted rounded-xl transition-colors">
                                                <ChevronRight className="w-5 h-5 text-muted-foreground rotate-180" />
                                            </button>
                                            <div>
                                                <h2 className="text-2xl font-bold">Neuen Händler anlegen</h2>
                                                <p className="text-muted-foreground text-sm mt-0.5">Füllen Sie die Formulardaten aus und speichern Sie den neuen Mandanten.</p>
                                            </div>
                                        </div>

                                        <div className="glass-card rounded-2xl border border-border/50 p-6 md:p-8 max-w-3xl">
                                            {/* Wizard Progress */}
                                            <div className="mb-8">
                                                <div className="flex items-center justify-between mb-3">
                                                    {[{ n: 1, l: 'Firmendaten' }, { n: 2, l: 'Konfiguration' }, { n: 3, l: 'Zugang' }].map((s, i) => (
                                                        <div key={s.n} className="flex items-center gap-2 flex-1">
                                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                                                wizardStep === s.n ? 'bg-brand text-primary-foreground shadow-lg' :
                                                                wizardStep > s.n ? 'bg-success text-white' : 'bg-muted text-muted-foreground'
                                                            }`}>{wizardStep > s.n ? '✓' : s.n}</div>
                                                            <span className={`text-sm font-semibold hidden sm:inline ${
                                                                wizardStep === s.n ? 'text-brand' : 'text-muted-foreground'
                                                            }`}>{s.l}</span>
                                                            {i < 2 && <div className={`flex-1 h-px mx-2 ${wizardStep > s.n ? 'bg-success' : 'bg-border'}`} />}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-5">
                                                {wizardStep === 1 && (
                                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                                                        <p className="text-sm text-muted-foreground">Grundlegende Informationen des Händlers.</p>
                                                        <Input label="Firmenname *" value={newTenantName} onChange={setNewTenantName} placeholder="Autohaus Müller GmbH" />
                                                        <Input label="E-Mail *" value={newTenantEmail} onChange={setNewTenantEmail} placeholder="info@autohaus-mueller.de" />
                                                        <Input label="Telefon" value={newTenantPhone} onChange={setNewTenantPhone} placeholder="+49 30 123456" />
                                                    </motion.div>
                                                )}
                                                {wizardStep === 2 && (
                                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                                                        <p className="text-sm text-muted-foreground">Optionale Konfiguration für den Händler.</p>
                                                        <Input label="Website" value={newTenantWebsite} onChange={setNewTenantWebsite} placeholder="https://autohaus-mueller.de" />
                                                        <Input label="WhatsApp Bot Nummer (Twilio)" value={newTenantWhatsapp} onChange={setNewTenantWhatsapp} placeholder="+49 151 ..." />
                                                        <Input label="Logo URL" value={newTenantLogo} onChange={setNewTenantLogo} placeholder="https://..." />
                                                    </motion.div>
                                                )}
                                                {wizardStep === 3 && (
                                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                                                        <p className="text-sm text-muted-foreground">Zugangsdaten und Übersicht vor dem Anlegen.</p>
                                                        <Input label="Initial Passwort" value={newTenantPassword} onChange={setNewTenantPassword} />
                                                        <div className="glass-card rounded-xl p-5 space-y-3 !border-brand">
                                                            <h4 className="text-[10px] font-semibold text-brand uppercase tracking-[0.1em] font-mono">Übersicht</h4>
                                                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                                                <div><span className="text-muted-foreground">Firma:</span> <span className="font-semibold">{newTenantName || '—'}</span></div>
                                                                <div><span className="text-muted-foreground">E-Mail:</span> <span className="font-semibold">{newTenantEmail || '—'}</span></div>
                                                                <div><span className="text-muted-foreground">Telefon:</span> <span className="font-semibold">{newTenantPhone || '—'}</span></div>
                                                                <div><span className="text-muted-foreground">Website:</span> <span className="font-semibold">{newTenantWebsite || '—'}</span></div>
                                                                {newTenantWhatsapp && <div><span className="text-muted-foreground">WhatsApp:</span> <span className="font-semibold">{newTenantWhatsapp}</span></div>}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}

                                                {/* Navigation */}
                                                <div className="flex justify-between gap-3 pt-4 border-t border-border/30">
                                                    {wizardStep > 1 ? (
                                                        <Button variant="ghost" onClick={() => setWizardStep(s => s - 1)}>Zurück</Button>
                                                    ) : (
                                                        <Button variant="ghost" onClick={() => { setShowTenantForm(false); setWizardStep(1); }} disabled={creatingTenant}>Abbrechen</Button>
                                                    )}
                                                    {wizardStep < 3 ? (
                                                        <Button onClick={() => {
                                                            if (wizardStep === 1 && (!newTenantName.trim() || !newTenantEmail.trim())) {
                                                                toast.error('Firmenname und E-Mail sind Pflichtfelder');
                                                                return;
                                                            }
                                                            setWizardStep(s => s + 1);
                                                        }}>Weiter</Button>
                                                    ) : (
                                                        <Button onClick={handleCreateTenant} disabled={creatingTenant}>
                                                            {creatingTenant ? (
                                                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Wird angelegt...</>
                                                            ) : 'Händler anlegen'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : (
                                <>
                                {/* Header */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <h2 className="text-2xl font-bold">Mandantenverwaltung</h2>
                                    <button
                                        onClick={() => { resetTenantForm(); setShowTenantForm(true); }}
                                        className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/25 flex items-center gap-2 transition-all active:scale-95"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Neuer Händler
                                    </button>
                                </div>

                                {/* Search & Filter Bar */}
                                <div className="flex flex-col md:flex-row gap-3">
                                    <div className="relative flex-1 group">
                                        <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" />
                                        <input
                                            value={tenantSearch}
                                            onChange={(e) => setTenantSearch(e.target.value)}
                                            placeholder="Händler nach Name oder Slug suchen..."
                                            className="premium-input pl-10"
                                        />
                                    </div>
                                    <select
                                        value={tenantStatusFilter}
                                        onChange={(e) => setTenantStatusFilter(e.target.value as any)}
                                        className="px-4 py-2.5 bg-muted/50 border border-border/50 rounded-xl text-sm min-w-[140px]"
                                    >
                                        <option value="all">Alle Status</option>
                                        <option value="active">Aktiv</option>
                                        <option value="inactive">Gesperrt</option>
                                    </select>
                                    <select
                                        value={tenantPaymentFilter}
                                        onChange={(e) => setTenantPaymentFilter(e.target.value as any)}
                                        className="px-4 py-2.5 bg-muted/50 border border-border/50 rounded-xl text-sm min-w-[140px]"
                                    >
                                        <option value="all">Alle Zahlungen</option>
                                        <option value="paid">Bezahlt</option>
                                        <option value="trial">Testphase</option>
                                        <option value="overdue">Überfällig</option>
                                    </select>
                                </div>

                                <div className="glass-card rounded-2xl overflow-hidden border border-border/50">
                                    <div className="overflow-x-auto">
                                        <table className="premium-table w-full">
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
                                                {filteredTenants.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                                            {tenantSearch || tenantStatusFilter !== 'all' || tenantPaymentFilter !== 'all'
                                                                ? 'Keine Händler für diese Filterkriterien gefunden.'
                                                                : 'Noch keine Händler angelegt. Klicken Sie auf „Neuer Händler" um loszulegen.'}
                                                        </td>
                                                    </tr>
                                                ) : filteredTenants.map((tenant) => (
                                                    <tr key={tenant.id} className="hover:bg-muted/30 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                {tenant.logo_url ? (
                                                                    <img src={tenant.logo_url} alt={tenant.name} className="w-10 h-10 rounded-xl object-cover shadow-md bg-white" />
                                                                ) : (
                                                                    <div className={`icon-box w-10 h-10 font-bold text-lg`}>
                                                                        {tenant.name.charAt(0)}
                                                                    </div>
                                                                )}
                                                                <div className="cursor-pointer" onClick={() => setViewingTenant(tenant)}>
                                                                    <div className="font-bold text-foreground text-sm hover:text-primary transition-colors">{tenant.name}</div>
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
                                                                <span className={`w-2 h-2 rounded-full ${tenant.is_active ? 'bg-success animate-pulse' : 'bg-danger'}`} />
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
                                                                <ActionButton icon={<Eye className="w-4 h-4" />} onClick={() => setViewingTenant(tenant)} tooltip="Details anzeigen" />
                                                                <ActionButton icon={<Smartphone className="w-4 h-4" />} onClick={() => { setSelectedTenant(tenant); loadDevices(tenant.id); }} tooltip="Geräte verwalten" />
                                                                <ActionButton icon={<Users className="w-4 h-4" />} onClick={() => { setSelectedTenant(tenant); setShowUserModal(true); }} tooltip="Benutzer hinzufügen" />
                                                                <ActionButton icon={<Settings className="w-4 h-4" />} onClick={() => openSettingsModal(tenant)} tooltip="Limits anpassen" />
                                                                <ActionButton
                                                                    icon={<Shield className="w-4 h-4" />}
                                                                    onClick={async () => {
                                                                        if (tenant.is_active) {
                                                                            if (!confirm(`Händler "${tenant.name}" wirklich deaktivieren?`)) return;
                                                                            try {
                                                                                await deactivateTenant(tenant.id);
                                                                                toast.success(`${tenant.name} deaktiviert`);
                                                                                loadStats();
                                                                            } catch (err: any) { toast.error('Fehler beim Deaktivieren'); }
                                                                        } else {
                                                                            try {
                                                                                await activateTenant(tenant.id);
                                                                                toast.success(`${tenant.name} aktiviert`);
                                                                                loadStats();
                                                                            } catch (err: any) { toast.error('Fehler beim Aktivieren'); }
                                                                        }
                                                                    }}
                                                                    tooltip={tenant.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                </>)}
                            </div>
                        ); })()}

                        {activeTab === 'oem-registry' && (
                            <div>
                                <OemRegistryView />
                            </div>
                        )}

                        {activeTab === 'oem-lookup' && (
                            <div>
                                <OemLookupView />
                            </div>
                        )}

                        {activeTab === 'bot-testing' && (
                            <div
                                className="flex-1 flex flex-col min-h-0 h-[calc(100vh-140px)] md:h-[calc(100vh-180px)]"
                            >
                                <div className="mb-4 md:mb-6 hidden md:block">
                                    <h2 className="text-2xl font-bold">OEM Bot Testing</h2>
                                    <p className="text-muted-foreground">WhatsApp-Bot Simulator – Direkte Logik ohne Twilio.</p>
                                </div>
                                <div className="flex-1 min-h-0">
                                    <BotTestingView />
                                </div>
                            </div>
                        )}

                        {activeTab === 'accuracy' && (
                            <div className="flex-1">
                                <AccuracyDashboardView />
                            </div>
                        )}

                        {activeTab === 'inbox' && (
                            <div className="h-[calc(100vh-180px)]">
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold">E-Mail Postfach</h2>
                                    <p className="text-muted-foreground">Lese und beantworte E-Mails mit KI-Unterstützung.</p>
                                </div>
                                <InboxView />
                            </div>
                        )}


                        {activeTab === 'audit' && (
                            <div
                                className="space-y-6"
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h2 className="text-2xl font-bold flex items-center gap-2">
                                            <Shield className="w-6 h-6 text-primary" />
                                            Audit Log
                                        </h2>
                                        <p className="text-muted-foreground text-sm mt-1">Alle Admin-Aktivitäten im Überblick</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            getAuditLog().then(d => setAuditLogs(d.logs)).catch(() => toast.error('Fehler beim Laden'));
                                        }}
                                        className="p-2 hover:bg-muted rounded-xl"
                                    >
                                        <RefreshCcw className="w-5 h-5 text-muted-foreground" />
                                    </button>
                                </div>

                                <div className="glass-card rounded-2xl overflow-hidden border border-border/50">
                                    <table className="premium-table w-full">
                                        <thead>
                                            <tr className="bg-muted/40 border-b border-border/50">
                                                <th className="text-left px-6 py-3 text-[11px] font-bold text-muted-foreground uppercase">Zeit</th>
                                                <th className="text-left px-6 py-3 text-[11px] font-bold text-muted-foreground uppercase">Admin</th>
                                                <th className="text-left px-6 py-3 text-[11px] font-bold text-muted-foreground uppercase">Aktion</th>
                                                <th className="text-left px-6 py-3 text-[11px] font-bold text-muted-foreground uppercase">Details</th>
                                                <th className="text-left px-6 py-3 text-[11px] font-bold text-muted-foreground uppercase">IP</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/30">
                                            {auditLogs.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                                        Keine Audit-Einträge vorhanden
                                                    </td>
                                                </tr>
                                            ) : auditLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                                                    <td className="px-6 py-3 text-sm text-muted-foreground whitespace-nowrap">
                                                        {new Date(log.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm font-medium">{log.admin_user}</td>
                                                    <td className="px-6 py-3">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                            log.action.includes('deactivat') ? 'badge-danger' :
                                                            log.action.includes('activat') ? 'badge-success' :
                                                            log.action.includes('creat') ? 'badge-info' :
                                                            'badge-muted'
                                                        }`}>
                                                            {log.action.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                                                        {log.details ? JSON.stringify(JSON.parse(log.details)).replace(/[{}"]/g, '') : '-'}
                                                    </td>
                                                    <td className="px-6 py-3 text-xs text-muted-foreground font-mono">{log.ip_address}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div
                                className="max-w-4xl space-y-8"
                            >
                                {/* Profile Section */}
                                <div>
                                    <h2 className="text-2xl font-bold">Mein Profil</h2>
                                    <p className="text-muted-foreground">Passwort und Signatur verwalten.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Password Change */}
                                    <div className="glass-card p-6 rounded-2xl space-y-4 shadow-sm hover:shadow-md transition-all border border-border/50">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 rounded-lg bg-brand-light text-brand"><Shield className="w-5 h-5" /></div>
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
                                            <input name="currentPw" type="password" placeholder="Aktuelles Passwort" className="premium-input w-full" required />
                                            <input name="newPw" type="password" placeholder="Neues Passwort" className="premium-input w-full" required />
                                            <input name="confirmPw" type="password" placeholder="Passwort bestätigen" className="premium-input w-full" required />
                                            <button type="submit" className="w-full py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors">Passwort ändern</button>
                                        </form>
                                    </div>

                                    {/* Email Signature */}
                                    <div className="glass-card p-6 rounded-2xl space-y-4 shadow-sm hover:shadow-md transition-all border border-border/50">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 rounded-lg bg-success-light text-success"><Edit className="w-5 h-5" /></div>
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
                                            <textarea name="signature" rows={4} placeholder="Mit freundlichen Grüßen,&#10;Dein Name" className="premium-input w-full resize-none" />
                                            <button type="submit" className="btn-success w-full">Signatur speichern</button>
                                        </form>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="border-t border-border/50 pt-8">
                                    <h2 className="text-2xl font-bold">Globale Einstellungen</h2>
                                    <p className="text-muted-foreground">Konfigurieren Sie das Systemverhalten.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="glass-card p-6 rounded-2xl space-y-4 shadow-sm hover:shadow-md transition-all border border-border/50">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 rounded-lg bg-warn-light text-warn"><Shield className="w-5 h-5" /></div>
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
                                                className={`w-12 h-6 rounded-full relative transition-colors ${maintenanceEnabled ? 'bg-warn' : 'bg-muted hover:bg-muted/80'}`}
                                            >
                                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${maintenanceEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="glass-card p-6 rounded-2xl space-y-4 shadow-sm hover:shadow-md transition-all border border-border/50">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 rounded-lg bg-brand-light text-brand"><Globe className="w-5 h-5" /></div>
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
                                            className="premium-input w-full mt-2 cursor-pointer"
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

                                    <div className="glass-card p-6 rounded-2xl space-y-4 shadow-sm border border-border/50">
                                        {/* Stats Display */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="icon-box p-3 shadow-lg">
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
                                                className="btn-brand flex items-center gap-2 disabled:opacity-50"
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
                                                                <div className="icon-box w-10 h-10 rounded-full font-bold">
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
                            </div>
                        )}
                    </>
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
                { /* Tenant modal removed — now inline in page content */ }
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
                                    <div className="icon-box w-12 h-12 font-bold text-lg">
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
                                        <span className={`px-4 py-2 rounded-xl text-sm font-medium cursor-default ${editingTenant.payment_status === 'paid' ? 'bg-success text-white' : 'bg-muted/50 text-muted-foreground'}`}>
                                            Bezahlt
                                        </span>
                                        <span className={`px-4 py-2 rounded-xl text-sm font-medium cursor-default ${editingTenant.payment_status === 'trial' ? 'bg-warn text-white' : 'bg-muted/50 text-muted-foreground'}`}>
                                            Testphase
                                        </span>
                                        <span className={`px-4 py-2 rounded-xl text-sm font-medium cursor-default ${editingTenant.payment_status === 'overdue' ? 'bg-danger text-white' : 'bg-muted/50 text-muted-foreground'}`}>
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
