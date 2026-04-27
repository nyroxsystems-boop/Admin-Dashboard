/**
 * BotTestingView — Send test-messages to the WhatsApp/AI Bot and inspect responses.
 *
 * Optional media-upload via useUploadBotMedia (returns a URL we attach as mediaUrl).
 */
import { useMemo, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { toast } from 'sonner';

import {
    useBotTesting,
    useUploadBotMedia,
} from '@/hooks/useBotTesting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatDateTime } from '@/utils/format/date';

export default function BotTestingView(): JSX.Element {
    const { history, isRunning, error, sendTest, clearHistory } = useBotTesting();
    const uploadMut = useUploadBotMedia();
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);

    const phoneValid = useMemo(() => /^\+?[0-9 ()-]{6,}$/.test(phone.trim()), [phone]);
    const canSend = phoneValid && message.trim().length > 0 && !isRunning;

    async function handleUpload(file: File): Promise<void> {
        try {
            const res = await uploadMut.mutateAsync(file);
            setMediaUrl(res.url);
            toast.success('Media hochgeladen.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload fehlgeschlagen.');
        }
    }

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-display font-semibold tracking-tight">Bot Testing</h1>
                <p className="text-sm text-text-secondary">Sende Test-Nachrichten an die Bot-API.</p>
            </header>

            <div className="grid md:grid-cols-2 gap-6">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!canSend) return;
                        const payload = {
                            phone: phone.trim(),
                            message,
                            ...(mediaUrl ? { mediaUrl } : {}),
                        };
                        void sendTest(payload).then(() => {
                            // Optional: clear media after one send
                            setMediaUrl(null);
                        });
                    }}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <Label htmlFor="bt-phone">Telefonnummer</Label>
                        <Input
                            id="bt-phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+49 ..."
                            aria-invalid={phone !== '' && !phoneValid}
                        />
                        {phone && !phoneValid && (
                            <p className="text-xs text-danger">Ungültiges Telefonformat.</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bt-msg">Nachricht</Label>
                        <Textarea
                            id="bt-msg"
                            rows={5}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bt-media">Media (optional)</Label>
                        <div className="flex items-center gap-2">
                            <input
                                id="bt-media"
                                type="file"
                                accept="image/*"
                                className="text-xs"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleUpload(f);
                                }}
                            />
                            {uploadMut.isPending && (
                                <span className="text-xs text-text-muted">Lade hoch…</span>
                            )}
                            {mediaUrl && (
                                <span className="text-xs text-success flex items-center gap-1">
                                    <Paperclip className="size-3" /> angefügt
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" disabled={!canSend}>
                            {isRunning ? 'Sende…' : 'Senden'}
                        </Button>
                        {history.length > 0 && (
                            <Button type="button" variant="ghost" onClick={clearHistory}>
                                History leeren
                            </Button>
                        )}
                    </div>
                    {error && <ErrorState message={error} />}
                </form>

                <div>
                    <h3 className="text-xs font-mono uppercase tracking-widest text-text-secondary mb-2">
                        Verlauf
                    </h3>
                    {isRunning ? (
                        <LoadingState label="AI denkt nach…" />
                    ) : history.length === 0 ? (
                        <EmptyState
                            title="Noch keine Tests"
                            description="Sende eine Nachricht, um zu starten."
                        />
                    ) : (
                        <ul className="space-y-2 max-h-[480px] overflow-y-auto">
                            {history.map((h) => (
                                <li key={h.id} className="rounded-md border border-border p-3 text-sm">
                                    <div className="flex justify-between text-xs text-text-muted mb-1">
                                        <span className="font-mono">{h.phone}</span>
                                        <span>{formatDateTime(h.timestamp)}</span>
                                    </div>
                                    <div className="text-text-secondary">→ {h.message}</div>
                                    <div className="mt-1 font-mono text-xs">← {h.response}</div>
                                    <div className="mt-1 text-[10px] font-mono text-text-muted">
                                        {h.durationMs}ms · {h.status}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
