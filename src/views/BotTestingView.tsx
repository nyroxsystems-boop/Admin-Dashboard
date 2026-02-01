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
    Car, Package, Hash
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface Message {
    role: 'user' | 'bot';
    text: string;
    timestamp: Date;
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
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
            const res = await fetch(`${API_BASE_URL}/api/bot-testing/oem-stats`);
            if (res.ok) {
                const data = await res.json();
                setOemStats(data);
            }
        } catch (e) {
            console.error('Failed to load OEM stats:', e);
        }
    };

    // Send message
    const sendMessage = async () => {
        if (!inputText.trim() || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            text: inputText.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/api/bot-testing/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: phoneNumber,
                    text: userMessage.text
                })
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data: ChatResponse = await res.json();

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

    // Reset conversation
    const resetConversation = async () => {
        try {
            await fetch(`${API_BASE_URL}/api/bot-testing/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from: phoneNumber })
            });

            setMessages([]);
            setOrderDetails(null);
            toast.success('Konversation zurückgesetzt');
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
        <div className="h-full flex gap-6">
            {/* Chat Panel */}
            <div className="flex-1 flex flex-col bg-card border border-border rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-foreground font-semibold">OEM Bot Simulator</h3>
                            <p className="text-muted-foreground text-sm">Twilio Bypass - Direkte Bot-Logik</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
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
                            className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Konversation zurücksetzen"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                                <MessageSquare className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h4 className="text-foreground font-medium mb-2">Bot Simulator bereit</h4>
                            <p className="text-muted-foreground text-sm max-w-xs mb-6">
                                Senden Sie eine Nachricht um den OEM-Bot zu testen. Die Antworten werden direkt berechnet.
                            </p>

                            {/* Quick prompts */}
                            <div className="flex flex-wrap gap-2 max-w-md justify-center">
                                {quickPrompts.map((prompt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setInputText(prompt)}
                                        className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs rounded-full transition-colors border border-border"
                                    >
                                        {prompt}
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
                                <div className={`flex items-start gap-2 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user'
                                        ? 'bg-blue-600'
                                        : 'bg-gradient-to-br from-green-500 to-emerald-600'
                                        }`}>
                                        {msg.role === 'user' ? (
                                            <User className="w-4 h-4 text-white" />
                                        ) : (
                                            <Bot className="w-4 h-4 text-white" />
                                        )}
                                    </div>
                                    <div className={`px-4 py-3 rounded-2xl ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-muted text-foreground border border-border'
                                        }`}>
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
                            <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-2xl border border-border">
                                <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
                                <span className="text-muted-foreground text-sm">Bot denkt nach...</span>
                            </div>
                        </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-border">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            placeholder="Nachricht eingeben..."
                            className="flex-1 px-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-green-500/50"
                            disabled={isLoading}
                        />
                        <motion.button
                            onClick={sendMessage}
                            disabled={isLoading || !inputText.trim()}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="w-5 h-5" />
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Details Panel */}
            <div className="w-80 flex flex-col gap-4">
                {/* OEM Stats Card */}
                <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
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
                                <span className={`font-bold ${oemStats.resolution_rate >= 70 ? 'text-green-500' : 'text-yellow-500'}`}>
                                    {oemStats.resolution_rate}%
                                </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all"
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
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
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
                                <div className="flex items-center gap-2">
                                    <Hash className="w-4 h-4 text-green-500" />
                                    <span className="text-green-500 font-mono">{orderDetails.oem_number}</span>
                                    <CheckCircle className="w-4 h-4 text-green-500" />
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
