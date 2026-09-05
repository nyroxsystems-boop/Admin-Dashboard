import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageOff, ShieldCheck } from 'lucide-react';
import { useTheme } from 'next-themes';

import type { InboxMessage } from '@/api/types';
import { Button } from '@/components/ui/button';
import { createMailDocument } from '@/lib/mailDocument';
import { plainTextToEmailHtml } from '@/utils/emailHtml';

const START_HEIGHT = 320;

/** A fresh reader also resets image consent and measured height between messages. */
export function MailHtmlFrame({ message }: { message: InboxMessage }): JSX.Element {
    return <MessageFrame key={message.id} message={message} />;
}

function MessageFrame({ message }: { message: InboxMessage }): JSX.Element {
    const { resolvedTheme } = useTheme();
    const [loadImages, setLoadImages] = useState(false);
    const [adaptColors, setAdaptColors] = useState(false);
    const [height, setHeight] = useState(START_HEIGHT);
    const frame = useRef<HTMLIFrameElement>(null);
    const scheduled = useRef<number | null>(null);
    const observer = useRef<ResizeObserver | null>(null);

    const document = useMemo(() => createMailDocument(message.html || plainTextToEmailHtml(message.body || ''), {
        loadImages,
        dark: resolvedTheme === 'dark' && adaptColors,
    }), [message.html, message.body, loadImages, resolvedTheme, adaptColors]);

    const measure = useCallback(() => {
        if (scheduled.current !== null) return;
        scheduled.current = requestAnimationFrame(() => {
            scheduled.current = null;
            const content = frame.current?.contentDocument;
            if (!content?.documentElement) return;
            const next = Math.ceil(Math.max(
                content.documentElement.getBoundingClientRect().height,
                content.body?.scrollHeight ?? 0,
            ));
            if (next > 0) setHeight((previous) => Math.abs(previous - next) > 2 ? next : previous);
        });
    }, []);

    const onLoad = useCallback(() => {
        observer.current?.disconnect();
        const root = frame.current?.contentDocument?.documentElement;
        if (root && typeof ResizeObserver !== 'undefined') {
            observer.current = new ResizeObserver(measure);
            observer.current.observe(root);
        }
        measure();
    }, [measure]);

    useEffect(() => () => {
        observer.current?.disconnect();
        if (scheduled.current !== null) cancelAnimationFrame(scheduled.current);
    }, []);

    return (
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                    {loadImages ? <ShieldCheck className="h-4 w-4" /> : <ImageOff className="h-4 w-4" />}
                    {loadImages ? 'Externe Bilder für diese Nachricht freigegeben.' : 'Externe Inhalte sind zum Schutz deiner Privatsphäre blockiert.'}
                </span>
                <div className="flex items-center gap-2">
                    {document.hasRemoteContent && (
                        <Button variant="ghost" size="sm" onClick={() => setLoadImages((value) => !value)}>
                            {loadImages ? 'Bilder blockieren' : 'Bilder laden'}
                        </Button>
                    )}
                    {resolvedTheme === 'dark' && (
                        <Button variant="ghost" size="sm" onClick={() => setAdaptColors((value) => !value)}>
                            {adaptColors ? 'Originalfarben' : 'Dunkle Lesefläche'}
                        </Button>
                    )}
                </div>
            </div>
            <iframe
                ref={frame}
                title={message.subject ? `E-Mail-Inhalt: ${message.subject}` : 'E-Mail-Inhalt'}
                srcDoc={document.html}
                onLoad={onLoad}
                // Same-origin permits parent-side height measurement. Scripts, forms,
                // top navigation and downloads remain disabled, reinforced by srcdoc CSP.
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                scrolling="no"
                style={{ height: `${height}px` }}
                className="w-full border-0 bg-white"
            />
        </div>
    );
}

export default MailHtmlFrame;
