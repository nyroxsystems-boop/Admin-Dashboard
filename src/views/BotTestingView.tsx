/**
 * Bot Testing View
 * OEM WhatsApp Bot Simulator for Admin Dashboard
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    MessageSquare, Send, RotateCcw, Loader2,
    Bot, User, Trash2, ChevronDown,
    Phone, Sparkles, CheckCircle, AlertCircle,
    Car, Package, Hash, ImagePlus, X, Image, Search
} from 'lucide-react';
import { toast } from 'sonner';
import { getAuthToken } from '../api/wws';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://autoteile-bot-service-production.up.railway.app';

interface Message {
    role: 'user' | 'bot';
    text: string;
    timestamp: Date;
    imagePreview?: string; // Base64 preview for images
}

interface OrderDetails {
    id: string;
    status: string;
    oem_number?: string;
    requested_part_name?: string;
    brand?: string;
    model?: string;
    year?: string;
    vin?: string;
}

interface ChatResponse {
    reply: string;
    orderId?: string;
    orderDetails?: OrderDetails;
    interimMessages?: string[];
    session: {
        from: string;
        history: Message[];
    };
}

interface OemStats {
    total_orders: number;
    oem_resolved: number;
    resolution_rate: number;
}

export function BotTestingView() {
    // State
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('+491234567890');
    const [isLoading, setIsLoading] = useState(false);
    const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
    const [oemStats, setOemStats] = useState<OemStats | null>(null);
    const [imageData, setImageData] = useState<{ base64: string; preview: string } | null>(null);
    const [reverseLookup, setReverseLookup] = useState<{ loading: boolean; result: any | null }>({ loading: false, result: null });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load OEM stats on mount
    useEffect(() => {
        loadOemStats();
    }, []);

    const loadOemStats = async () => {
        try {
            const token = getAuthToken();
            const res = await fetch(`${API_BASE_URL}/api/bot-testing/oem-stats`, {
                headers: {
                    ...(token ? { 'Authorization': `Token ${token}` } : {})
                }
            });
            if (res.ok) {
                const data = await res.json();
                setOemStats(data);
            }
        } catch (e) {
            console.error('Failed to load OEM stats:', e);
        }
    };

    // Handle image selection
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Bitte nur Bilder hochladen');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Bild ist zu groß (max. 10MB)');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setImageData({
                base64: base64.split(',')[1], // Remove data:image/...;base64, prefix
                preview: base64 // Keep full for preview
            });
            toast.success('Bild hinzugefügt - Fahrzeugschein erkannt?');
        };
        reader.readAsDataURL(file);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Remove selected image
    const removeImage = () => {
        setImageData(null);
    };

    // Send message
    const sendMessage = async () => {
        if ((!inputText.trim() && !imageData) || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            text: inputText.trim() || (imageData ? '📷 Fahrzeugschein-Bild' : ''),
            timestamp: new Date(),
            imagePreview: imageData?.preview
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        const currentImageData = imageData;
        setImageData(null);
        setIsLoading(true);

        try {
            const token = getAuthToken();
            const res = await fetch(`${API_BASE_URL}/api/bot-testing/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Token ${token}` } : {})
                },
                body: JSON.stringify({
                    from: phoneNumber,
                    text: userMessage.text,
                    imageBase64: currentImageData?.base64
                })
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data: ChatResponse = await res.json();

            // Show interim messages first (e.g., "🔍 Ich suche...")
            if (data.interimMessages && data.interimMessages.length > 0) {
                const interimMsgs: Message[] = data.interimMessages.map(msg => ({
                    role: 'bot' as const,
                    text: msg,
                    timestamp: new Date()
                }));
                setMessages(prev => [...prev, ...interimMsgs]);
            }

            const botMessage: Message = {
                role: 'bot',
                text: data.reply,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMessage]);

            if (data.orderDetails) {
                setOrderDetails(data.orderDetails);
            }

            // Refresh stats after interaction
            loadOemStats();

        } catch (err: any) {
            toast.error(`Fehler: ${err.message}`);
            setMessages(prev => [...prev, {
                role: 'bot',
                text: `❌ Fehler: ${err.message}`,
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Reset conversation with confirmation
    const resetConversation = async () => {
        if (messages.length > 0 && !window.confirm('Gesamte Konversation löschen und Bot-Session zurücksetzen?')) {
            return;
        }

        try {
            const token = getAuthToken();
            await fetch(`${API_BASE_URL}/api/bot-testing/reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Token ${token}` } : {})
                },
                body: JSON.stringify({ from: phoneNumber })
            });

            setMessages([]);
            setOrderDetails(null);
            setImageData(null);
            toast.success('Konversation gelöscht & Session zurückgesetzt');
        } catch (err: any) {
            toast.error(`Reset fehlgeschlagen: ${err.message}`);
        }
    };

    // Quick prompts
    const quickPrompts = [
        "Ich brauche einen Bremssattel für einen Golf 7",
        "Stoßdämpfer hinten rechts",
        "Ölfilter für BMW E46 320i",
        "Ich suche Bremsbeläge"
    ];

    return (
        <div className="h-full flex flex-col md:flex-row gap-4 md:gap-6">
            {/* Chat Panel - Full width on mobile */}
            <div className="flex-1 flex flex-col bg-card border border-border rounded-2xl overflow-hidden min-h-0">
                {/* Header - Compact on mobile */}
                <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border bg-muted/50">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary to-primary/70 rounded-lg md:rounded-xl flex items-center justify-center">
                            <Bot className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-foreground font-semibold text-sm md:text-base">OEM Bot</h3>
                            <p className="text-muted-foreground text-xs hidden md:block">Twilio Bypass - Direkte Bot-Logik</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Phone input - hidden on mobile */}
                        <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="bg-transparent text-foreground text-sm w-32 focus:outline-none"
                                placeholder="+49..."
                            />
                        </div>
                        <button
                            onClick={resetConversation}
                            className="flex items-center gap-1.5 px-3 py-2 text-danger hover:text-danger bg-danger-light hover:bg-danger-light border border-destructive/15 hover:border-destructive/30 rounded-lg transition-all text-sm font-medium"
                            title="Konversation löschen & zurücksetzen"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden md:inline">Reset</span>
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 min-h-0">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center px-4">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-muted rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4">
                                <MessageSquare className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground" />
                            </div>
                            <h4 className="text-foreground font-medium mb-2 text-sm md:text-base">Bot Simulator bereit</h4>
                            <p className="text-muted-foreground text-xs md:text-sm max-w-xs mb-4 md:mb-6">
                                Senden Sie eine Nachricht um den OEM-Bot zu testen.
                            </p>

                            {/* Quick prompts - scrollable on mobile */}
                            <div className="flex flex-wrap gap-2 max-w-md justify-center">
                                {quickPrompts.slice(0, 3).map((prompt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setInputText(prompt)}
                                        className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs rounded-full transition-colors border border-border"
                                    >
                                        {prompt.length > 25 ? prompt.substring(0, 25) + '...' : prompt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <AnimatePresence mode="popLayout">
                        {messages.map((msg, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`flex items-start gap-2 max-w-[85%] md:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user'
                                        ? 'bg-brand'
                                        : 'bg-gradient-to-br from-primary to-primary/70'
                                        }`}>
                                        {msg.role === 'user' ? (
                                            <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                                        ) : (
                                            <Bot className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                                        )}
                                    </div>
                                    <div className={`px-3 py-2 md:px-4 md:py-3 rounded-2xl ${msg.role === 'user'
                                        ? 'bg-brand text-primary-foreground'
                                        : 'bg-muted text-foreground border border-border'
                                        }`}>
                                        {/* Image preview if present */}
                                        {msg.imagePreview && (
                                            <img
                                                src={msg.imagePreview}
                                                alt="Anhang"
                                                className="max-h-40 w-auto rounded-lg mb-2 border border-white/20"
                                            />
                                        )}
                                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex justify-start"
                        >
                            <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 bg-muted rounded-2xl border border-border">
                                <Loader2 className="w-4 h-4 text-success animate-spin" />
                                <span className="text-muted-foreground text-sm">Bot denkt nach...</span>
                            </div>
                        </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area - Always visible and accessible */}
                <div className="p-3 md:p-4 border-t border-border bg-card">
                    {/* Image Preview */}
                    {imageData && (
                        <div className="mb-3 relative inline-block">
                            <img
                                src={imageData.preview}
                                alt="Vorschau"
                                className="h-20 w-auto rounded-lg border border-border object-cover"
                            />
                            <button
                                onClick={removeImage}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-danger hover:bg-danger text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    <div className="flex gap-2 md:gap-3">
                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                        />

                        {/* Image upload button */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="px-3 py-2.5 md:py-3 bg-muted border border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-blue-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            title="Fahrzeugschein-Bild hochladen"
                        >
                            <ImagePlus className="w-5 h-5" />
                            <span className="hidden md:inline text-sm">Bild</span>
                        </button>

                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            placeholder="Nachricht eingeben..."
                            className="flex-1 px-3 py-2.5 md:px-4 md:py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-green-500/50 text-sm md:text-base"
                            disabled={isLoading}
                        />
                        <motion.button
                            onClick={sendMessage}
                            disabled={isLoading || (!inputText.trim() && !imageData)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-primary to-primary/70 hover:brightness-110 text-white font-semibold rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="w-4 h-4 md:w-5 md:h-5" />
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Details Panel - Hidden on mobile */}
            <div className="hidden md:flex w-80 flex-col gap-4">
                {/* OEM Stats Card */}
                <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h4 className="text-foreground font-semibold">OEM Statistiken</h4>
                            <p className="text-muted-foreground text-xs">Letzte 7 Tage</p>
                        </div>
                    </div>

                    {oemStats ? (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground text-sm">Erfolgsquote</span>
                                <span className={`font-bold ${oemStats.resolution_rate >= 70 ? 'text-success' : 'text-warn'}`}>
                                    {oemStats.resolution_rate}%
                                </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-primary to-primary/70 h-2 rounded-full transition-all"
                                    style={{ width: `${oemStats.resolution_rate}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{oemStats.oem_resolved} aufgelöst</span>
                                <span>{oemStats.total_orders} gesamt</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-muted-foreground text-sm">Laden...</div>
                    )}
                </div>

                {/* Order Details Card */}
                {orderDetails && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card border border-border rounded-2xl p-5"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center">
                                <Package className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h4 className="text-foreground font-semibold">Order Details</h4>
                                <p className="text-muted-foreground text-xs">{orderDetails.status}</p>
                            </div>
                        </div>

                        <div className="space-y-3 text-sm">
                            {orderDetails.requested_part_name && (
                                <div>
                                    <span className="text-muted-foreground">Teil:</span>
                                    <span className="text-foreground ml-2">{orderDetails.requested_part_name}</span>
                                </div>
                            )}

                            {orderDetails.oem_number && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Hash className="w-4 h-4 text-success" />
                                        <span className="text-success font-mono font-bold">{orderDetails.oem_number}</span>
                                        <CheckCircle className="w-4 h-4 text-success" />
                                        <button
                                            onClick={async () => {
                                                setReverseLookup({ loading: true, result: null });
                                                try {
                                                    const res = await fetch(`${API_BASE_URL}/api/bot-testing/oem-reverse-lookup`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
                                                        body: JSON.stringify({ oem: orderDetails.oem_number }),
                                                    });
                                                    const data = await res.json();
                                                    setReverseLookup({ loading: false, result: data });
                                                } catch (err) {
                                                    setReverseLookup({ loading: false, result: { error: 'Fehler bei Rücksuche' } });
                                                }
                                            }}
                                            disabled={reverseLookup.loading}
                                            className="ml-1 px-2 py-1 text-xs bg-brand-light hover:bg-brand-light text-brand rounded-lg flex items-center gap-1 transition-colors"
                                            title="KI-Rücksuche: Welches Teil gehört zu dieser OEM-Nummer?"
                                        >
                                            {reverseLookup.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                            Rücksuche
                                        </button>
                                    </div>
                                    {reverseLookup.result && !reverseLookup.result.error && (
                                        <div className="bg-brand-light border border-brand/15 rounded-lg p-3 text-xs space-y-1">
                                            <div className="text-brand font-semibold">
                                                🔍 {reverseLookup.result.partName || 'Unbekannt'}
                                            </div>
                                            {reverseLookup.result.partCategory && (
                                                <div className="text-muted-foreground">Kategorie: {reverseLookup.result.partCategory}</div>
                                            )}
                                            {reverseLookup.result.vehicles && (
                                                <div className="text-muted-foreground">Fahrzeuge: {reverseLookup.result.vehicles}</div>
                                            )}
                                            {reverseLookup.result.manufacturer && (
                                                <div className="text-muted-foreground">Hersteller: {reverseLookup.result.manufacturer}</div>
                                            )}
                                            {reverseLookup.result.confidence !== undefined && (
                                                <div className={`font-mono ${reverseLookup.result.confidence >= 0.7 ? 'text-success' : 'text-warn'}`}>
                                                    Confidence: {Math.round(reverseLookup.result.confidence * 100)}%
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {reverseLookup.result?.error && (
                                        <div className="text-danger text-xs">{reverseLookup.result.error}</div>
                                    )}
                                </div>
                            )}

                            {(orderDetails.brand || orderDetails.model) && (
                                <div className="flex items-center gap-2">
                                    <Car className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-foreground">
                                        {[orderDetails.brand, orderDetails.model, orderDetails.year].filter(Boolean).join(' ')}
                                    </span>
                                </div>
                            )}

                            {orderDetails.vin && (
                                <div>
                                    <span className="text-muted-foreground">VIN:</span>
                                    <span className="text-foreground ml-2 font-mono text-xs">{orderDetails.vin}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Usage Hints */}
                <div className="bg-muted/50 border border-border/50 rounded-2xl p-5">
                    <h4 className="text-muted-foreground text-xs uppercase tracking-wider mb-3">Test-Szenarien</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>• "Bremssattel Golf 7" - Standard-Anfrage</li>
                        <li>• "Stoßdämpfer" - Fehlende Details</li>
                        <li>• Fahrzeugdaten nach Rückfrage</li>
                        <li>• VIN-Nummer senden</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default BotTestingView;
