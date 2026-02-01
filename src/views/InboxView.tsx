/**
 * Inbox View for Admin Dashboard
 * Full email client with personal/shared mailbox, AI replies, and assignments
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Mail, Inbox, Send, RefreshCw, Search, Loader2, ArrowLeft,
    User, Clock, Paperclip, Reply, Sparkles, CheckCircle, AlertCircle,
    Settings, Key, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { getAuthToken } from '../api/wws';

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
        } catch (error: any) {
            toast.error(error.message || 'E-Mails konnten nicht geladen werden');
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
        } catch (error: any) {
            toast.error(error.message);
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
        } catch (error: any) {
            toast.error(error.message);
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
                    subject: `Re: ${selectedEmail.subject}`,
                    body: replyText,
                    useSharedMailbox: mailbox === 'shared',
                    replyToMessageId: selectedEmail.messageId
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('E-Mail gesendet');
                setShowReply(false);
                setReplyText('');
            } else {
                throw new Error(data.error);
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSendingReply(false);
        }
    };

    const filteredEmails = emails.filter(e =>
        e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.from.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.from.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex bg-muted rounded-xl p-1">
                        <button
                            onClick={() => setMailbox('shared')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${mailbox === 'shared' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <span className="flex items-center gap-2">
                                <Inbox className="w-4 h-4" />
                                info@partsunion.de
                            </span>
                        </button>
                        <button
                            onClick={() => setMailbox('personal')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${mailbox === 'personal' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <span className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Mein Postfach
                            </span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Suchen..."
                            className="pl-10 pr-4 py-2 bg-muted border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 w-64"
                        />
                    </div>
                    <button
                        onClick={loadEmails}
                        disabled={isLoading}
                        className="p-2 bg-muted hover:bg-muted/80 rounded-xl transition-colors"
                    >
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* Email List */}
                <div className="w-96 bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-border">
                        <h3 className="font-semibold">{filteredEmails.length} E-Mails</h3>
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
                                    onClick={() => { setSelectedEmail(email); setShowReply(false); }}
                                    className={`w-full p-4 border-b border-border text-left hover:bg-muted/50 transition-colors ${selectedEmail?.uid === email.uid ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <span className="font-medium truncate">{email.from.name}</span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(email.date)}</span>
                                    </div>
                                    <p className="font-medium text-sm mb-1 truncate">{email.subject}</p>
                                    <p className="text-sm text-muted-foreground truncate">{email.snippet}</p>
                                    {email.assignment && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${email.assignment.status === 'done' ? 'bg-green-500/20 text-green-600' :
                                                email.assignment.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-600' :
                                                    'bg-blue-500/20 text-blue-600'
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

                {/* Email Detail */}
                <div className="flex-1 bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
                    {selectedEmail ? (
                        <>
                            <div className="p-6 border-b border-border">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h2 className="text-xl font-bold mb-2">{selectedEmail.subject}</h2>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <User className="w-4 h-4" />
                                                {selectedEmail.from.name} &lt;{selectedEmail.from.address}&gt;
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {new Date(selectedEmail.date).toLocaleString('de-DE')}
                                            </span>
                                            {selectedEmail.hasAttachments && (
                                                <span className="flex items-center gap-1">
                                                    <Paperclip className="w-4 h-4" />
                                                    {selectedEmail.attachments.length} Anhang
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowReply(!showReply)}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
                                    >
                                        <Reply className="w-4 h-4" />
                                        Antworten
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                                    {selectedEmail.body}
                                </div>
                            </div>

                            {/* Reply Panel */}
                            <AnimatePresence>
                                {showReply && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-border"
                                    >
                                        <div className="p-4">
                                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <Sparkles className="w-4 h-4" />
                                                    KI-Vorlagen:
                                                </span>
                                                {AI_PROMPTS.map((p) => (
                                                    <button
                                                        key={p.label}
                                                        onClick={() => generateAiReply(p.prompt)}
                                                        disabled={aiLoading}
                                                        className="px-3 py-1 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors"
                                                    >
                                                        {p.label}
                                                    </button>
                                                ))}
                                                {aiLoading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                                            </div>
                                            <textarea
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                placeholder="Antwort schreiben..."
                                                rows={6}
                                                className="w-full p-4 bg-background border border-border rounded-xl focus:outline-none focus:border-primary resize-none"
                                            />
                                            <div className="flex items-center justify-between mt-3">
                                                <span className="text-sm text-muted-foreground">
                                                    Senden als: {mailbox === 'shared' ? 'info@partsunion.de' : profile?.email}
                                                </span>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setShowReply(false)}
                                                        className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-xl font-medium transition-colors"
                                                    >
                                                        Abbrechen
                                                    </button>
                                                    <button
                                                        onClick={sendReply}
                                                        disabled={!replyText.trim() || sendingReply}
                                                        className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                                                    >
                                                        {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                        Senden
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <Mail className="w-16 h-16 mb-4 opacity-30" />
                            <p className="text-lg font-medium">Wähle eine E-Mail aus</p>
                            <p className="text-sm">um die Details anzuzeigen</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default InboxView;
