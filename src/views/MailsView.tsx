/**
 * Mails View for Admin Dashboard
 * AI-powered email template generator and marketing email sender
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Mail, Sparkles, Send, Users, Loader2,
    Save, Wand2, Eye, Code, ChevronDown,
    Check, AlertCircle, RefreshCw, X
} from 'lucide-react';
import {
    generateEmailTemplate,
    getEmailRecipients,
    sendMarketingEmail,
    saveEmailTemplate,
    type GeneratedEmail,
    type EmailRecipient
} from '../api/wws';
import { toast } from 'sonner';

type RecipientType = 'active' | 'cancelled' | 'trial' | 'all' | 'custom';

const recipientTypeLabels: Record<RecipientType, string> = {
    active: 'Aktive Händler',
    cancelled: 'Gekündigte Händler',
    trial: 'Probeabo',
    all: 'Alle Kunden',
    custom: 'Manuelle Liste'
};

export function MailsView() {
    // Generation state
    const [prompt, setPrompt] = useState('');
    const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Preview state
    const [previewMode, setPreviewMode] = useState<'visual' | 'html'>('visual');

    // Recipients state
    const [recipientType, setRecipientType] = useState<RecipientType>('active');
    const [customEmails, setCustomEmails] = useState('');
    const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
    const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);

    // Sending state
    const [isSending, setIsSending] = useState(false);
    const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);

    // Save state
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [templateName, setTemplateName] = useState('');

    // Load recipients when type changes
    const loadRecipients = useCallback(async (type: RecipientType) => {
        if (type === 'custom') {
            setRecipients([]);
            return;
        }

        setIsLoadingRecipients(true);
        try {
            const data = await getEmailRecipients(type);
            setRecipients(data.recipients);
        } catch (error) {
            toast.error('Empfänger konnten nicht geladen werden');
        } finally {
            setIsLoadingRecipients(false);
        }
    }, []);

    // Generate email with AI
    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error('Bitte geben Sie einen Prompt ein');
            return;
        }

        setIsGenerating(true);
        try {
            const result = await generateEmailTemplate(prompt);
            setGeneratedEmail(result.email);
            toast.success('E-Mail erfolgreich generiert');
        } catch (error: any) {
            toast.error(error.message || 'Generierung fehlgeschlagen');
        } finally {
            setIsGenerating(false);
        }
    };

    // Send emails
    const handleSend = async () => {
        if (!generatedEmail) {
            toast.error('Bitte generieren Sie zuerst eine E-Mail');
            return;
        }

        const emailList = recipientType === 'custom'
            ? customEmails.split(/[,;\n]/).map(e => e.trim()).filter(e => e.includes('@'))
            : recipients.map(r => r.email);

        if (emailList.length === 0) {
            toast.error('Keine gültigen Empfänger ausgewählt');
            return;
        }

        setIsSending(true);
        try {
            const result = await sendMarketingEmail(
                generatedEmail.subject,
                generatedEmail.htmlContent,
                recipientType !== 'custom' ? recipientType : undefined,
                recipientType === 'custom' ? emailList : undefined
            );
            toast.success(`${result.sent} von ${result.total} E-Mails erfolgreich gesendet`);
        } catch (error: any) {
            toast.error(error.message || 'Versand fehlgeschlagen');
        } finally {
            setIsSending(false);
        }
    };

    // Save template
    const handleSave = async () => {
        if (!generatedEmail || !templateName.trim()) {
            toast.error('Name und E-Mail erforderlich');
            return;
        }

        try {
            await saveEmailTemplate(
                templateName,
                generatedEmail.subject,
                generatedEmail.htmlContent,
                prompt
            );
            toast.success('Template gespeichert');
            setShowSaveModal(false);
            setTemplateName('');
        } catch (error: any) {
            toast.error(error.message || 'Speichern fehlgeschlagen');
        }
    };

    return (
        <div className="h-full flex flex-col lg:flex-row gap-6">
            {/* Left Panel - Prompt & Controls */}
            <div className="lg:w-1/2 flex flex-col gap-4">
                {/* AI Generator Card */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold">KI E-Mail Generator</h3>
                            <p className="text-slate-400 text-sm">Beschreiben Sie Ihre E-Mail</p>
                        </div>
                    </div>

                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="z.B. Schreibe eine E-Mail an Autoteile-Händler über unser neues WhatsApp-Bot Feature für automatische OEM-Ermittlung..."
                        className="w-full h-40 bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 resize-none"
                    />

                    <div className="flex gap-3 mt-4">
                        <motion.button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Wand2 className="w-5 h-5" />
                                    Generieren
                                </>
                            )}
                        </motion.button>

                        {generatedEmail && (
                            <motion.button
                                onClick={() => setShowSaveModal(true)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl flex items-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                            </motion.button>
                        )}
                    </div>
                </div>

                {/* Recipients Card */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 flex-1">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold">Empfänger</h3>
                            <p className="text-slate-400 text-sm">Zielgruppe auswählen</p>
                        </div>
                    </div>

                    {/* Recipient Type Selector */}
                    <div className="relative mb-4">
                        <button
                            onClick={() => setShowRecipientDropdown(!showRecipientDropdown)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white"
                        >
                            <span>{recipientTypeLabels[recipientType]}</span>
                            <ChevronDown className={`w-5 h-5 transition-transform ${showRecipientDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {showRecipientDropdown && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl"
                                >
                                    {Object.entries(recipientTypeLabels).map(([key, label]) => (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                setRecipientType(key as RecipientType);
                                                loadRecipients(key as RecipientType);
                                                setShowRecipientDropdown(false);
                                            }}
                                            className="w-full px-4 py-3 text-left text-white hover:bg-slate-700/50 flex items-center justify-between"
                                        >
                                            {label}
                                            {recipientType === key && <Check className="w-4 h-4 text-blue-400" />}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Custom emails input */}
                    {recipientType === 'custom' ? (
                        <textarea
                            value={customEmails}
                            onChange={(e) => setCustomEmails(e.target.value)}
                            placeholder="E-Mail-Adressen eingeben (eine pro Zeile oder kommagetrennt)"
                            className="w-full h-32 bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 resize-none"
                        />
                    ) : (
                        <div className="bg-slate-900/50 rounded-xl p-4">
                            {isLoadingRecipients ? (
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Laden...
                                </div>
                            ) : recipients.length > 0 ? (
                                <div className="text-sm text-slate-300">
                                    <span className="text-2xl font-bold text-white">{recipients.length}</span>
                                    <span className="ml-2">Empfänger ausgewählt</span>
                                </div>
                            ) : (
                                <button
                                    onClick={() => loadRecipients(recipientType)}
                                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Empfänger laden
                                </button>
                            )}
                        </div>
                    )}

                    {/* Send Button */}
                    <motion.button
                        onClick={handleSend}
                        disabled={isSending || !generatedEmail}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full mt-4 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Send className="w-5 h-5" />
                                E-Mails senden
                            </>
                        )}
                    </motion.button>
                </div>
            </div>

            {/* Right Panel - Preview */}
            <div className="lg:w-1/2 flex flex-col">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl flex-1 flex flex-col overflow-hidden">
                    {/* Preview Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
                        <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-slate-400" />
                            <span className="text-white font-medium">Vorschau</span>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-900/50 rounded-lg p-1">
                            <button
                                onClick={() => setPreviewMode('visual')}
                                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${previewMode === 'visual'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                <Eye className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPreviewMode('html')}
                                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${previewMode === 'html'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                <Code className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Preview Content */}
                    <div className="flex-1 overflow-auto p-6">
                        {generatedEmail ? (
                            previewMode === 'visual' ? (
                                <div className="bg-white rounded-xl overflow-hidden shadow-lg">
                                    {/* Email Header */}
                                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center">
                                        <img
                                            src="/logo.png"
                                            alt="Partsunion"
                                            className="h-10 mx-auto"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                        <div className="mt-4 text-white font-bold text-xl">Partsunion</div>
                                    </div>

                                    {/* Subject */}
                                    <div className="px-6 py-4 border-b border-gray-100">
                                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Betreff</div>
                                        <div className="text-gray-900 font-semibold">{generatedEmail.subject}</div>
                                    </div>

                                    {/* Body */}
                                    <div
                                        className="p-6 prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: generatedEmail.htmlContent }}
                                    />

                                    {/* Footer */}
                                    <div className="bg-gray-50 px-6 py-4 text-center text-xs text-gray-500 border-t border-gray-100">
                                        Partsunion GmbH • B2B Autoteile-Plattform
                                    </div>
                                </div>
                            ) : (
                                <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap bg-slate-900/50 rounded-xl p-4 overflow-auto">
                                    {generatedEmail.htmlContent}
                                </pre>
                            )
                        ) : (
                            <div className="h-full flex items-center justify-center text-center">
                                <div className="max-w-xs">
                                    <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Mail className="w-8 h-8 text-slate-500" />
                                    </div>
                                    <h4 className="text-white font-medium mb-2">Keine Vorschau</h4>
                                    <p className="text-slate-400 text-sm">
                                        Geben Sie einen Prompt ein und klicken Sie auf "Generieren"
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Save Template Modal */}
            <AnimatePresence>
                {showSaveModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setShowSaveModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">Template speichern</h3>
                                <button
                                    onClick={() => setShowSaveModal(false)}
                                    className="text-slate-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <input
                                type="text"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder="Template-Name"
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 mb-4"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowSaveModal(false)}
                                    className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl"
                                >
                                    Speichern
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default MailsView;
