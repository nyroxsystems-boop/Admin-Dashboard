/**
 * Inbox View for Admin Dashboard
 * Full email client with personal/shared mailbox, AI replies, and assignments
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Mail, Inbox, Send, RefreshCw, Search, Loader2, ArrowLeft,
    User, Clock, Paperclip, Reply, Sparkles, CheckCircle, AlertCircle,
    Settings, Key, ChevronDown, PenSquare, X, Wand2, Users, Megaphone, FileText, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { getAuthToken } from '../api/wws';
import DOMPurify from 'dompurify';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://autoteile-bot-service-production.up.railway.app';

interface EmailMessage {
    uid: number;
    messageId: string;
    from: { name: string; address: string };
    to: string[];
    subject: string;
    date: string;
    snippet: string;
    body: string;
    html?: string;
    isRead: boolean;
    hasAttachments: boolean;
    attachments: { filename: string; size: number }[];
    assignment?: {
        assigned_to: string;
        status: string;
        notes: string;
    };
}

interface AdminProfile {
    id: string;
    username: string;
    email: string;
    full_name: string;
    signature: string;
    has_imap_setup: boolean;
}

const AI_PROMPTS = [
    { label: 'Bestätigen', prompt: 'Bestätige den Empfang und teile mit, dass wir uns darum kümmern.' },
    { label: 'Nachfragen', prompt: 'Frage nach weiteren Details, die wir benötigen.' },
    { label: 'Ablehnen', prompt: 'Lehne die Anfrage höflich ab.' },
    { label: 'Termin', prompt: 'Schlage einen Termin für ein Gespräch vor.' },
    { label: 'Danke', prompt: 'Bedanke dich für die Nachricht.' },
    { label: 'Angebot', prompt: 'Teile mit, dass wir ein Angebot erstellen werden.' },
];

export function InboxView() {
    const { user } = useAuth();
    const [mailbox, setMailbox] = useState<'shared' | 'personal'>('shared');
    const [folder, setFolder] = useState<'inbox' | 'assigned' | 'done'>('inbox');
    const [emails, setEmails] = useState<EmailMessage[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [needsSetup, setNeedsSetup] = useState(false);
    const [profile, setProfile] = useState<AdminProfile | null>(null);
    const [showSetup, setShowSetup] = useState(false);
    const [imapPassword, setImapPassword] = useState('');
    const [setupLoading, setSetupLoading] = useState(false);

    // Reply state
    const [showReply, setShowReply] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [sendingReply, setSendingReply] = useState(false);

    // Compose state
    const [showCompose, setShowCompose] = useState(false);
    const [composeData, setComposeData] = useState({
        to: '',
        subject: '',
        body: '',
        htmlContent: ''
    });
    const [composeSending, setComposeSending] = useState(false);
    const [composeAiLoading, setComposeAiLoading] = useState(false);
    const [composeAiPrompt, setComposeAiPrompt] = useState('');
    const [recipientType, setRecipientType] = useState<'manual' | 'group'>('manual');
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [recipientList, setRecipientList] = useState<{ email: string; name: string }[]>([]);
    const [loadingRecipients, setLoadingRecipients] = useState(false);
    const [emailType, setEmailType] = useState<'normal' | 'promotional'>('normal');
    const [showPreview, setShowPreview] = useState(false);
    const [sendFromMailbox, setSendFromMailbox] = useState<'shared' | 'personal'>('shared');

    // Recipient groups
    const RECIPIENT_GROUPS = [
        { id: 'active', label: 'Aktive Händler', icon: '✓' },
        { id: 'cancelled', label: 'Gekündigte Kunden', icon: '✗' },
        { id: 'trial', label: 'Probe-Nutzer', icon: '⏱' },
        { id: 'all', label: 'Alle Kunden', icon: '📋' }
    ];

    const scrollRef = useRef<HTMLDivElement>(null);

    // Get auth headers dynamically to always use fresh token
    const getHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Token ${getAuthToken()}`
    });

    // Load profile on mount
    useEffect(() => {
        loadProfile();
    }, []);

    // Load emails when mailbox changes
    useEffect(() => {
        loadEmails();
    }, [mailbox]);

    const loadProfile = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/admin-auth/profile`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
                // Only prompt for IMAP setup when on personal mailbox
                // Shared mailbox works without personal IMAP credentials
            }
        } catch (error) {
            console.error('Failed to load profile:', error);
        }
    };

    const loadEmails = async () => {
        setIsLoading(true);
        setSelectedEmail(null);
        try {
            const res = await fetch(`${API_BASE}/api/inbox/emails?mailbox=${mailbox}`, { headers: getHeaders() });
            const data = await res.json();

            if (data.needsSetup) {
                setNeedsSetup(true);
                setShowSetup(true);
                setEmails([]);
            } else if (res.ok) {
                setNeedsSetup(false);
                setEmails(data.emails || []);
            } else {
                throw new Error(data.error);
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'E-Mails konnten nicht geladen werden');
            setEmails([]);
        } finally {
            setIsLoading(false);
        }
    };

    const setupImap = async () => {
        if (!imapPassword) return;
        setSetupLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/inbox/setup`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ imapPassword })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('IMAP-Zugang konfiguriert');
                setShowSetup(false);
                setNeedsSetup(false);
                setImapPassword('');
                loadEmails();
            } else {
                throw new Error(data.error);
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'IMAP-Einrichtung fehlgeschlagen');
        } finally {
            setSetupLoading(false);
        }
    };

    const generateAiReply = async (prompt: string) => {
        if (!selectedEmail) return;
        setAiLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/inbox/email/ai-reply`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    originalEmail: {
                        from: selectedEmail.from.address,
                        subject: selectedEmail.subject,
                        body: selectedEmail.body,
                        date: selectedEmail.date
                    },
                    prompt,
                    tone: 'professional'
                })
            });
            const data = await res.json();
            if (res.ok) {
                setReplyText(data.reply);
                toast.success('KI-Antwort generiert');
            } else {
                throw new Error(data.error);
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'KI-Antwort fehlgeschlagen');
        } finally {
            setAiLoading(false);
        }
    };

    const sendReply = async () => {
        if (!selectedEmail || !replyText.trim()) return;
        setSendingReply(true);
        try {
            const res = await fetch(`${API_BASE}/api/inbox/email/send`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    to: selectedEmail.from.address,
                    subject: selectedEmail.subject.toLowerCase().startsWith('re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
                    body: replyText,
                    useSharedMailbox: mailbox === 'shared',
                    replyToMessageId: selectedEmail.messageId
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Antwort gesendet');
                setReplyText('');
                // Optionally auto-resolve after reply
            } else {
                throw new Error(data.error);
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Antwort konnte nicht gesendet werden');
        } finally {
            setSendingReply(false);
        }
    };

    // --- Action Functions (Assign, Resolve) ---
    const updateAssignment = async (email: EmailMessage, status: string, notes: string = '') => {
        if (!profile) return;
        try {
            const res = await fetch(`${API_BASE}/api/inbox/email/${email.uid}/assign`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    messageId: email.messageId,
                    mailbox,
                    assignedTo: profile.username,
                    status,
                    notes
                })
            });
            if (res.ok) {
                toast.success(status === 'done' ? 'Als Erledigt markiert' : 'Dir zugewiesen');
                // Optimistic update
                setEmails(emails.map(e => e.uid === email.uid ? {
                    ...e,
                    assignment: { assigned_to: profile.username, status, notes }
                } : e));
                if (selectedEmail?.uid === email.uid) {
                    setSelectedEmail({
                        ...selectedEmail,
                        assignment: { assigned_to: profile.username, status, notes }
                    });
                }
            } else {
                const data = await res.json();
                throw new Error(data.error);
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Aktion fehlgeschlagen');
        }
    };

    // Send new email (supports both manual and group recipients)
    const sendCompose = async () => {
        const hasManualRecipient = recipientType === 'manual' && composeData.to.trim();
        const hasGroupRecipients = recipientType === 'group' && recipientList.length > 0;

        if (!hasManualRecipient && !hasGroupRecipients) {
            toast.error('Bitte Empfänger auswählen');
            return;
        }
        if (!composeData.subject || !composeData.body) {
            toast.error('Bitte Betreff und Nachricht ausfüllen');
            return;
        }

        setComposeSending(true);
        try {
            let res;
            if (recipientType === 'group' && recipientList.length > 0) {
                // Use marketing email endpoint for group sending
                res = await fetch(`${API_BASE}/api/admin/emails/send`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        subject: composeData.subject,
                        htmlContent: composeData.htmlContent || `<p>${composeData.body.replace(/\n/g, '</p><p>')}</p>`,
                        customEmails: recipientList.map(r => r.email)
                    })
                });
            } else {
                // Single recipient via inbox endpoint
                res = await fetch(`${API_BASE}/api/inbox/email/send`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        to: composeData.to,
                        subject: composeData.subject,
                        body: composeData.body,
                        useSharedMailbox: sendFromMailbox === 'shared'
                    })
                });
            }

            const data = await res.json();
            if (res.ok) {
                const sentCount = data.sent || 1;
                toast.success(`${sentCount} E-Mail${sentCount > 1 ? 's' : ''} gesendet`);
                setShowCompose(false);
                setComposeData({ to: '', subject: '', body: '', htmlContent: '' });
                setComposeAiPrompt('');
                setRecipientType('manual');
                setSelectedGroup('');
                setRecipientList([]);
                setSendFromMailbox('shared');
            } else {
                throw new Error(data.error);
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'E-Mail konnte nicht gesendet werden');
        } finally {
            setComposeSending(false);
        }
    };

    // Generate AI email content
    const generateComposeAI = async () => {
        if (!composeAiPrompt.trim()) {
            toast.error('Bitte einen Prompt eingeben');
            return;
        }
        setComposeAiLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/emails/generate`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    prompt: composeAiPrompt,
                    type: emailType // 'normal' or 'promotional'
                })
            });
            const data = await res.json();
            if (res.ok && data.email) {
                setComposeData(prev => ({
                    ...prev,
                    subject: data.email.subject || prev.subject,
                    body: data.email.plainText || data.email.htmlContent?.replace(/<[^>]*>/g, '') || prev.body,
                    htmlContent: data.email.htmlContent || prev.htmlContent
                }));
                // Auto-show preview for promotional emails with HTML
                if (emailType === 'promotional' && data.email.htmlContent) {
                    setShowPreview(true);
                }
                toast.success(emailType === 'promotional' ? 'Werbe-Mail generiert' : 'E-Mail generiert');
            } else {
                throw new Error(data.error || 'Generierung fehlgeschlagen');
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'E-Mail-Generierung fehlgeschlagen');
        } finally {
            setComposeAiLoading(false);
        }
    };

    // Load recipients by group
    const loadRecipientsByGroup = async (groupId: string) => {
        setLoadingRecipients(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/emails/recipients/${groupId}`, {
                headers: getHeaders()
            });
            const data = await res.json();
            if (res.ok && data.recipients) {
                setRecipientList(data.recipients);
                toast.success(`${data.count} Empfänger geladen`);
            }
        } catch (error: unknown) {
            toast.error('Empfänger konnten nicht geladen werden');
        } finally {
            setLoadingRecipients(false);
        }
    };

    const filteredEmails = emails.filter(e => {
        const matchesSearch = e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.from.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.from.address.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (!matchesSearch) return false;

        const isDone = e.assignment?.status === 'done';
        const isAssignedToMe = e.assignment?.assigned_to === profile?.username;
        const isAssigned = e.assignment && e.assignment.status === 'in_progress';

        if (folder === 'inbox') return !isDone && !isAssignedToMe; // Unassigned or assigned to others, but not done
        if (folder === 'assigned') return isAssignedToMe && !isDone;
        if (folder === 'done') return isDone;
        return true;
    });

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Gestern';
        } else if (days < 7) {
            return date.toLocaleDateString('de-DE', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        }
    };

    // Setup modal
    if (showSetup) {
        return (
            <div className="h-full flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-card border border-border rounded-2xl p-8 max-w-md w-full"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Key className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">IMAP-Zugang einrichten</h2>
                            <p className="text-muted-foreground text-sm">{profile?.email}</p>
                        </div>
                    </div>

                    <p className="text-muted-foreground mb-4">
                        Um auf dein persönliches Postfach zugreifen zu können, benötigen wir dein STRATO E-Mail-Passwort.
                    </p>

                    <input
                        type="password"
                        value={imapPassword}
                        onChange={(e) => setImapPassword(e.target.value)}
                        placeholder="STRATO E-Mail-Passwort"
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl mb-4 focus:outline-none focus:border-primary"
                    />

                    <div className="flex gap-3">
                        <button
                            onClick={() => { setShowSetup(false); setMailbox('shared'); }}
                            className="flex-1 py-3 bg-muted hover:bg-muted/80 rounded-xl font-medium transition-colors"
                        >
                            Abbrechen
                        </button>
                        <button
                            onClick={setupImap}
                            disabled={!imapPassword || setupLoading}
                            className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {setupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verbinden'}
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Responsive: on mobile, show list or detail, not both
    const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

    // Keyboard shortcut: Escape to deselect email
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showCompose) { setShowCompose(false); return; }
                if (selectedEmail) { setSelectedEmail(null); setMobileView('list'); }
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [showCompose, selectedEmail]);

    return (
        <div className="h-full flex flex-col lg:flex-row gap-4">
            {/* 1. Left Sidebar - Folders & Mailboxes (hidden on mobile when viewing detail) */}
            <div className={`w-full lg:w-64 shrink-0 flex flex-col gap-4 ${selectedEmail && mobileView === 'detail' ? 'hidden lg:flex' : 'flex'}`}>
                <button
                    onClick={() => setShowCompose(true)}
                    className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-2xl font-semibold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                    <PenSquare className="w-5 h-5" />
                    Neue E-Mail
                </button>

                <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col shadow-sm flex-1">
                    <div className="px-5 py-4 border-b border-border bg-muted/20">
                        <h3 className="text-sm font-bold text-foreground tracking-wide">POSTFÄCHER</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto py-2">
                        {/* Shared Mailbox */}
                        <div className="px-2 mb-4">
                            <button
                                onClick={() => setMailbox('shared')}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all ${mailbox === 'shared' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted text-foreground'}`}
                            >
                                <span className="flex items-center gap-2.5 text-sm">
                                    <Inbox className="w-4 h-4" />
                                    info@partsunion.de
                                </span>
                            </button>
                            
                            {mailbox === 'shared' && (
                                <div className="mt-1.5 ml-3 pl-3 border-l-2 border-primary/10 flex flex-col gap-1">
                                    <button onClick={() => setFolder('inbox')} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${folder === 'inbox' ? 'bg-primary text-white font-medium shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-muted'}`}>
                                        <Mail className="w-4 h-4" /> Offen
                                    </button>
                                    <button onClick={() => setFolder('assigned')} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${folder === 'assigned' ? 'bg-primary text-white font-medium shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-muted'}`}>
                                        <User className="w-4 h-4" /> Mir zugewiesen
                                    </button>
                                    <button onClick={() => setFolder('done')} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${folder === 'done' ? 'bg-primary text-white font-medium shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-muted'}`}>
                                        <CheckCircle className="w-4 h-4" /> Erledigt
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Personal Mailbox */}
                        <div className="px-2">
                            <button
                                onClick={() => setMailbox('personal')}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all ${mailbox === 'personal' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted text-foreground'}`}
                            >
                                <span className="flex items-center gap-2.5 text-sm">
                                    <User className="w-4 h-4" />
                                    Mein Postfach
                                </span>
                            </button>
                            
                            {mailbox === 'personal' && (
                                <div className="mt-1.5 ml-3 pl-3 border-l-2 border-primary/10 flex flex-col gap-1">
                                    <button onClick={() => setFolder('inbox')} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${folder === 'inbox' ? 'bg-primary text-white font-medium shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-muted'}`}>
                                        <Mail className="w-4 h-4" /> Offen
                                    </button>
                                    <button onClick={() => setFolder('done')} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${folder === 'done' ? 'bg-primary text-white font-medium shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-muted'}`}>
                                        <CheckCircle className="w-4 h-4" /> Erledigt
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Middle Column - Email List */}
            <div className={`w-full lg:w-80 shrink-0 bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm ${selectedEmail && mobileView === 'detail' ? 'hidden lg:flex' : 'flex'}`}>
                <div className="px-5 py-4 border-b border-border bg-muted/10 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-foreground">
                            {folder === 'inbox' ? 'Offene E-Mails' : folder === 'assigned' ? 'Mir zugewiesen' : 'Erledigte E-Mails'}
                            <span className="text-muted-foreground font-normal text-sm ml-2">({filteredEmails.length})</span>
                        </h3>
                        <button onClick={loadEmails} disabled={isLoading} className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Suchen..."
                            className="w-full pl-9 pr-4 py-2 bg-muted border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        />
                    </div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredEmails.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <Mail className="w-12 h-12 mb-3 opacity-50" />
                                <p>Keine E-Mails</p>
                            </div>
                        ) : (
                            filteredEmails.map((email) => (
                                <button
                                    key={email.uid}
                                    onClick={() => { setSelectedEmail(email); setShowReply(false); setMobileView('detail'); }}
                                    className={`w-full p-4 border-b border-border text-left hover:bg-muted/50 transition-colors ${selectedEmail?.uid === email.uid ? 'bg-primary/5 border-l-4 border-l-primary' : ''} ${!email.isRead ? 'bg-primary/[0.02]' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <span className={`truncate ${!email.isRead ? 'font-bold text-foreground' : 'font-medium'}`}>{email.from.name}</span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(email.date)}</span>
                                    </div>
                                    <p className={`text-sm mb-1 truncate ${!email.isRead ? 'font-semibold text-foreground' : 'font-medium'}`}>{email.subject}</p>
                                    <p className="text-sm text-muted-foreground truncate">{email.snippet}</p>
                                    {email.assignment && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${email.assignment.status === 'done' ? 'bg-success-light text-success' :
                                                email.assignment.status === 'in_progress' ? 'bg-warn-light text-warn' :
                                                    'bg-brand-light text-brand'
                                                }`}>
                                                {email.assignment.assigned_to}
                                            </span>
                                        </div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

            {/* 3. Right Column - Email Detail & Inline Reply */}
            <div className={`flex-1 bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm relative ${!selectedEmail && mobileView === 'list' ? 'hidden lg:flex' : 'flex'}`}>
                {selectedEmail ? (
                    <>
                        {/* Detail Header & Action Bar */}
                        <div className="bg-muted/10 border-b border-border">
                            <div className="p-4 lg:p-6 pb-4 flex items-start justify-between">
                                <div className="min-w-0 flex-1">
                                    {/* Mobile back button */}
                                    <button
                                        onClick={() => { setSelectedEmail(null); setMobileView('list'); }}
                                        className="lg:hidden flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Zurück
                                    </button>
                                    <h2 className="text-xl lg:text-2xl font-bold mb-3 break-words">{selectedEmail.subject}</h2>
                                    <div className="flex flex-wrap items-center gap-3 lg:gap-5 text-sm text-foreground">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                                                {selectedEmail.from.name.charAt(0)}
                                            </div>
                                            <span className="font-medium truncate">{selectedEmail.from.name} <span className="text-muted-foreground font-normal ml-1 hidden sm:inline">&lt;{selectedEmail.from.address}&gt;</span></span>
                                        </div>
                                        <span className="flex items-center gap-1.5 text-muted-foreground">
                                            <Clock className="w-4 h-4" />
                                            {new Date(selectedEmail.date).toLocaleString('de-DE')}
                                        </span>
                                        {selectedEmail.hasAttachments && (
                                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                                <Paperclip className="w-4 h-4" />
                                                {selectedEmail.attachments.length} Anhang
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Actions Bar */}
                            <div className="px-4 lg:px-6 py-3 bg-muted/30 border-t border-border flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    {selectedEmail.assignment?.status !== 'done' && selectedEmail.assignment?.assigned_to !== profile?.username && (
                                        <button onClick={() => updateAssignment(selectedEmail, 'in_progress')} className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border hover:border-primary/50 text-foreground rounded-lg text-sm font-medium transition-colors shadow-sm">
                                            <User className="w-4 h-4 text-primary" />
                                            Mir zuweisen
                                        </button>
                                    )}
                                    {selectedEmail.assignment?.assigned_to && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-light text-brand rounded-lg text-sm font-medium">
                                            <User className="w-4 h-4" />
                                            Zugewiesen an {selectedEmail.assignment.assigned_to}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {selectedEmail.assignment?.status === 'done' ? (
                                        <button onClick={() => updateAssignment(selectedEmail, 'in_progress')} className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border hover:border-warn text-foreground rounded-lg text-sm font-medium transition-colors shadow-sm">
                                            <RefreshCw className="w-4 h-4 text-warn" />
                                            Wieder öffnen
                                        </button>
                                    ) : (
                                        <button onClick={() => updateAssignment(selectedEmail, 'done')} className="flex items-center gap-2 px-3 py-1.5 bg-success text-white hover:bg-success/90 rounded-lg text-sm font-medium transition-colors shadow-sm">
                                            <CheckCircle className="w-4 h-4" />
                                            Als erledigt markieren
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Email Body Scroll Area */}
                        <div className="flex-1 overflow-y-auto p-4 lg:p-8 pb-48 lg:pb-40">
                            {selectedEmail.html ? (
                                <div
                                    className="prose prose-sm max-w-none text-foreground/90 leading-relaxed [&_img]:max-w-full [&_img]:h-auto [&_a]:text-primary [&_a]:underline"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedEmail.html, { ADD_ATTR: ['target'] }) }}
                                />
                            ) : (
                                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/90 leading-relaxed">
                                    {selectedEmail.body}
                                </div>
                            )}
                        </div>

                        {/* Anchored Inline Reply Box */}
                        <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.1)] p-3 lg:p-4 pt-3">
                            {/* AI Quick Templates */}
                            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 hide-scrollbar">
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-brand-light text-brand rounded-full text-xs font-semibold shrink-0">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    KI:
                                </div>
                                {AI_PROMPTS.map((p) => (
                                    <button
                                        key={p.label}
                                        onClick={() => generateAiReply(p.prompt)}
                                        disabled={aiLoading}
                                        className="px-3 py-1.5 shrink-0 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-full text-xs font-medium transition-colors"
                                    >
                                        {p.label}
                                    </button>
                                ))}
                                {aiLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0 text-primary" />}
                            </div>

                            {/* Reply Textarea */}
                            <div className="flex gap-2 items-end">
                                <textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && replyText.trim() && !sendingReply) {
                                            e.preventDefault();
                                            sendReply();
                                        }
                                    }}
                                    placeholder={`Antworten an ${selectedEmail.from.name}...`}
                                    rows={replyText.trim() ? 4 : 2}
                                    className="flex-1 pl-4 pr-4 py-3 bg-muted/40 border border-border focus:border-primary focus:bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none transition-all text-sm"
                                />
                                <button
                                    onClick={sendReply}
                                    disabled={!replyText.trim() || sendingReply}
                                    className="px-4 lg:px-5 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm shrink-0"
                                    title="Senden (Ctrl+Enter)"
                                >
                                    {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    <span className="hidden lg:inline">Senden</span>
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 hidden lg:flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
                        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                            <Mail className="w-8 h-8 opacity-50" />
                        </div>
                        <p className="text-xl font-semibold text-foreground mb-2">Keine E-Mail ausgewählt</p>
                        <p className="text-sm text-center px-8">Wähle eine E-Mail aus der Liste, um Details anzuzeigen und zu antworten.</p>
                    </div>
                )}
            </div>
            {/* Compose Modal (Marketing/Promotions now in separate view, keeping simple email here) */}
            <AnimatePresence>
                {showCompose && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setShowCompose(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-card border border-border rounded-2xl w-full max-w-6xl h-[90vh] lg:h-[85vh] overflow-hidden flex flex-col shadow-2xl"
                        >
                            {/* Header & Tabs */}
                            <div className="flex flex-col border-b border-border shrink-0 bg-muted/5">
                                <div className="flex items-center justify-between px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                            {emailType === 'normal' ? <PenSquare className="w-5 h-5 text-primary" /> : <Megaphone className="w-5 h-5 text-warn" />}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold">{emailType === 'normal' ? 'Neue E-Mail' : 'Werbekampagne'}</h2>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-sm text-muted-foreground">Absender:</span>
                                                <select
                                                    value={sendFromMailbox}
                                                    onChange={(e) => setSendFromMailbox(e.target.value as 'shared' | 'personal')}
                                                    className="text-sm bg-muted border-0 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer font-medium"
                                                >
                                                    <option value="shared">info@partsunion.de (Shared)</option>
                                                    {profile?.email && profile.email.toLowerCase() !== 'info@partsunion.de' && (
                                                        <option value="personal">{profile.email} (Persönlich)</option>
                                                    )}
                                                </select>
                                                {profile?.email && profile.email.toLowerCase() === 'info@partsunion.de' && (
                                                    <span className="text-xs text-muted-foreground">({profile.username})</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowCompose(false)}
                                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex px-6 gap-6 pt-2">
                                    <button 
                                        onClick={() => setEmailType('normal')} 
                                        className={`py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${emailType === 'normal' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                    >
                                        <FileText className="w-4 h-4" /> Direktnachricht
                                    </button>
                                    <button 
                                        onClick={() => setEmailType('promotional')} 
                                        className={`py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${emailType === 'promotional' ? 'border-warn text-warn' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                    >
                                        <Megaphone className="w-4 h-4" /> Werbekampagne
                                    </button>
                                </div>
                            </div>

                            {/* Main Content Area depends on emailType */}
                            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                                {emailType === 'normal' ? (
                                    /* SIMPLE COMPOSE LOGIC FOR 1-ON-1 EMAILS */
                                    <div className="flex-1 flex flex-col p-8 bg-card max-w-4xl mx-auto w-full">
                                        <div className="space-y-5 flex-1 flex flex-col">
                                            <div className="flex items-center gap-4">
                                                <label className="w-20 text-sm font-medium text-muted-foreground text-right shrink-0">An:</label>
                                                <input
                                                    type="text"
                                                    value={composeData.to}
                                                    onChange={(e) => setComposeData(prev => ({ ...prev, to: e.target.value }))}
                                                    placeholder="empfaenger@beispiel.de"
                                                    className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                                />
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <label className="w-20 text-sm font-medium text-muted-foreground text-right shrink-0">Betreff:</label>
                                                <input
                                                    type="text"
                                                    value={composeData.subject}
                                                    onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                                                    placeholder="Betreff der E-Mail"
                                                    className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                                />
                                            </div>
                                            
                                            <div className="flex flex-col flex-1 pl-0 lg:pl-24 pt-2 relative">
                                                <textarea
                                                    value={composeData.body}
                                                    onChange={(e) => setComposeData(prev => ({ ...prev, body: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && composeData.to && composeData.subject && composeData.body && !composeSending) {
                                                            e.preventDefault();
                                                            sendCompose();
                                                        }
                                                    }}
                                                    placeholder="Schreibe deine Nachricht..."
                                                    className="flex-1 w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                                />
                                                <div className="absolute bottom-4 right-4 flex items-center gap-3">
                                                    <button onClick={() => setShowCompose(false)} className="px-5 py-2.5 bg-background border border-border hover:bg-muted rounded-xl font-medium transition-colors text-sm shadow-sm">Abbrechen</button>
                                                    <button 
                                                        onClick={sendCompose} 
                                                        disabled={composeSending || !composeData.to || !composeData.subject || !composeData.body}
                                                        className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2 text-sm shadow-md"
                                                    >
                                                        {composeSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Senden
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* 2-COLUMN MARKETING CAMPAIGN LOGIC */
                                    <>
                                        {/* Left Column - AI Generator & Recipients */}
                                        <div className="w-full lg:w-[45%] border-r border-border flex flex-col overflow-y-auto bg-muted/5">
                                            <div className="p-6 space-y-8">

                                    {/* AI Generator Section */}
                                    <div className={`rounded-xl p-5 border ${emailType === 'promotional' ? 'bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20' : 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20'}`}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <Sparkles className={`w-5 h-5 ${emailType === 'promotional' ? 'text-warn' : 'text-stat-4'}`} />
                                            <span className="font-semibold">KI E-Mail Generator</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            {emailType === 'promotional'
                                                ? 'Beschreibe deine Werbekampagne. Die KI generiert gestylte HTML-E-Mails mit Partsunion Branding.'
                                                : 'Beschreibe, was du senden möchtest. Die KI generiert Betreff und Inhalt im Partsunion-Stil.'
                                            }
                                        </p>
                                        <textarea
                                            value={composeAiPrompt}
                                            onChange={(e) => setComposeAiPrompt(e.target.value)}
                                            placeholder={emailType === 'promotional'
                                                ? 'z.B. Erstelle eine Werbe-E-Mail für unsere neue WAWI-Integration. Betone die Zeitersparnis und einfache Bedienung. Füge einen Call-to-Action Button hinzu...'
                                                : 'z.B. Schreibe eine Willkommens-E-Mail für neue Händler die sich gerade angemeldet haben. Erkläre die wichtigsten Features unserer Plattform...'
                                            }
                                            rows={5}
                                            className={`w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none resize-none mb-4 ${emailType === 'promotional' ? 'focus:ring-2 focus:ring-orange-500/30' : 'focus:ring-2 focus:ring-purple-500/30'}`}
                                        />
                                        <button
                                            onClick={generateComposeAI}
                                            disabled={composeAiLoading || !composeAiPrompt.trim()}
                                            className={`w-full px-4 py-3 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${emailType === 'promotional' ? 'bg-gradient-to-r from-accent to-accent/80 hover:brightness-110' : 'bg-gradient-to-r from-primary to-primary/80 hover:brightness-110'}`}
                                        >
                                            {composeAiLoading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Generiere...
                                                </>
                                            ) : (
                                                <>
                                                    <Wand2 className="w-4 h-4" />
                                                    {emailType === 'promotional' ? 'Werbe-Mail generieren' : 'E-Mail generieren'}
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Recipients Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-5 h-5 text-primary" />
                                            <span className="font-semibold">Empfänger auswählen</span>
                                        </div>

                                        {/* Toggle Manual vs Group */}
                                        <div className="flex bg-muted rounded-xl p-1">
                                            <button
                                                onClick={() => setRecipientType('manual')}
                                                className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${recipientType === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                            >
                                                Manuelle Eingabe
                                            </button>
                                            <button
                                                onClick={() => setRecipientType('group')}
                                                className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${recipientType === 'group' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                            >
                                                Kundengruppe
                                            </button>
                                        </div>

                                        {recipientType === 'manual' ? (
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-muted-foreground">E-Mail-Adresse(n)</label>
                                                <input
                                                    type="text"
                                                    value={composeData.to}
                                                    onChange={(e) => setComposeData(prev => ({ ...prev, to: e.target.value }))}
                                                    placeholder="name@firma.de, weitere@firma.de"
                                                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                />
                                                <p className="text-xs text-muted-foreground mt-2">Mehrere E-Mails mit Komma trennen</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-2">
                                                    {RECIPIENT_GROUPS.map(group => (
                                                        <button
                                                            key={group.id}
                                                            onClick={() => {
                                                                setSelectedGroup(group.id);
                                                                loadRecipientsByGroup(group.id);
                                                            }}
                                                            className={`p-3 rounded-xl border text-left transition-all ${selectedGroup === group.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg">{group.icon}</span>
                                                                <span className="font-medium text-sm">{group.label}</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>

                                                {loadingRecipients && (
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Lade Empfänger...
                                                    </div>
                                                )}

                                                {recipientList.length > 0 && (
                                                    <div className="bg-muted/50 rounded-xl p-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-medium">{recipientList.length} Empfänger ausgewählt</span>
                                                        </div>
                                                        <div className="max-h-32 overflow-y-auto space-y-1">
                                                            {recipientList.slice(0, 10).map((r, i) => (
                                                                <div key={i} className="text-xs text-muted-foreground truncate">
                                                                    {r.name} ({r.email})
                                                                </div>
                                                            ))}
                                                            {recipientList.length > 10 && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    ... und {recipientList.length - 10} weitere
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {/* Close p-6 space-y-8 wrapper */}
                                    </div>
                                </div>

                                {/* Right Column - Email Preview */}
                                <div className="w-full lg:w-1/2 flex flex-col overflow-hidden p-4 lg:p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-5 h-5 text-primary" />
                                            <span className="font-semibold">E-Mail {showPreview ? 'Vorschau' : 'Bearbeiten'}</span>
                                        </div>
                                        {(composeData.htmlContent || emailType === 'promotional') && (
                                            <button
                                                onClick={() => setShowPreview(!showPreview)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showPreview ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'}`}
                                            >
                                                <Eye className="w-4 h-4" />
                                                {showPreview ? 'Editor' : 'Vorschau'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Email Form / Preview */}
                                    <div className="flex-1 space-y-4 overflow-y-auto">
                                        {/* Subject */}
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Betreff</label>
                                            <input
                                                type="text"
                                                value={composeData.subject}
                                                onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                                                placeholder="Betreff der E-Mail"
                                                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                                            />
                                        </div>

                                        {showPreview && composeData.htmlContent ? (
                                            /* Full HTML Preview */
                                            <div className="flex-1 border border-border rounded-xl overflow-hidden">
                                                <div className="px-4 py-3 bg-gradient-to-r from-accent/10 to-accent/5 text-sm font-medium border-b border-border flex items-center gap-2">
                                                    <Megaphone className="w-4 h-4 text-warn" />
                                                    Werbe-Mail Vorschau
                                                </div>
                                                <div
                                                    className="bg-white min-h-[400px] overflow-y-auto"
                                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(composeData.htmlContent) }}
                                                />
                                            </div>
                                        ) : (
                                            /* Body Editor */
                                            <div className="flex-1 flex flex-col min-h-0">
                                                <label className="block text-sm font-medium mb-2">Nachricht</label>
                                                <textarea
                                                    value={composeData.body}
                                                    onChange={(e) => setComposeData(prev => ({ ...prev, body: e.target.value }))}
                                                    placeholder={emailType === 'promotional' ? 'Werbe-Text hier eingeben oder KI generieren lassen...' : 'Ihre Nachricht...'}
                                                    className="flex-1 w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none min-h-[300px]"
                                                />
                                                {emailType === 'promotional' && !composeData.htmlContent && (
                                                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                                        <Sparkles className="w-3 h-3" />
                                                        Nutze den KI-Generator für professionelles HTML-Design
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Mini HTML Preview when not in full preview mode */}
                                        {!showPreview && composeData.htmlContent && (
                                            <div className="border border-border rounded-xl overflow-hidden relative">
                                                <div className="px-3 py-2 bg-muted text-xs font-medium border-b border-border flex items-center justify-between">
                                                    <span className="flex items-center gap-1">
                                                        <Megaphone className="w-3 h-3 text-warn" />
                                                        HTML generiert
                                                    </span>
                                                    <button
                                                        onClick={() => setShowPreview(true)}
                                                        className="text-primary hover:underline"
                                                    >
                                                        Vorschau anzeigen
                                                    </button>
                                                </div>
                                                <div
                                                    className="p-4 bg-white text-black text-sm max-h-32 overflow-hidden"
                                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(composeData.htmlContent) }}
                                                />
                                                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                </>
                            )}
                            </div>

                            {/* Footer only for Promotional (Normal has it inside the single pane) */}
                            {emailType === 'promotional' && (
                                <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/5 shrink-0">
                                    <div className="text-sm font-medium text-muted-foreground">
                                        {recipientType === 'group' && recipientList.length > 0
                                            ? `${recipientList.length} Empfänger ausgewählt`
                                            : composeData.to ? `Empfänger: ${composeData.to}` : 'Kein Empfänger ausgewählt'}
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowCompose(false)}
                                            className="px-5 py-2.5 bg-background border border-border hover:bg-muted rounded-xl font-medium transition-colors text-sm shadow-sm"
                                        >
                                            Abbrechen
                                        </button>
                                        <button
                                            onClick={sendCompose}
                                            disabled={composeSending || (!composeData.to && recipientList.length === 0) || !composeData.subject || !composeData.body}
                                            className="px-8 py-2.5 bg-warn hover:bg-warn/90 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 text-sm shadow-md hover:shadow-lg"
                                        >
                                            {composeSending ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Megaphone className="w-4 h-4 shrink-0" />}
                                            Kampagne Senden
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default InboxView;
