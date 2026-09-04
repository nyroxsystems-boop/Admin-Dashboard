/**
 * PushToggle — die Glocke in der Kopfzeile des Mailprogramms.
 *
 * Sie ist bewusst KLEIN und unaufdringlich, und sie fragt nie von selbst.
 * Ein Benachrichtigungsdialog, der beim Öffnen der Seite erscheint, wird von
 * den meisten Leuten weggeklickt — und ein weggeklicktes "Blockieren" gilt
 * dauerhaft für die ganze Domain und ist nur noch von Hand in den
 * Browsereinstellungen zurückzunehmen. Der Dialog erscheint deshalb erst nach
 * einem Klick hierauf.
 *
 * Ist Push auf dem Server nicht eingerichtet oder kann der Browser es nicht,
 * verschwindet die Glocke ganz. Ein abgeblendeter Knopf, der nie funktioniert,
 * ist nur eine Frage, die man nicht beantworten kann.
 */
import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
    pushAusschalten,
    pushEinschalten,
    pushZustand,
    serviceWorkerRegistrieren,
    type PushZustand,
} from '@/lib/push';
import { cn } from '@/lib/utils';

export function PushToggle(): JSX.Element | null {
    const [zustand, setZustand] = useState<PushZustand | null>(null);
    const [laeuft, setLaeuft] = useState(false);

    useEffect(() => {
        let abgemeldet = false;
        void (async () => {
            // Registrierung auch dann, wenn Push aus ist: ohne Service Worker
            // ist die Anwendung nicht installierbar.
            await serviceWorkerRegistrieren();
            const z = await pushZustand();
            if (!abgemeldet) setZustand(z);
        })();
        return () => { abgemeldet = true; };
    }, []);

    const umschalten = useCallback(async () => {
        if (laeuft || !zustand) return;
        setLaeuft(true);
        try {
            if (zustand === 'an') {
                setZustand(await pushAusschalten());
                toast.success('Benachrichtigungen aus.');
            } else {
                const neu = await pushEinschalten();
                setZustand(neu);
                if (neu === 'an') {
                    toast.success('Benachrichtigungen an — dieses Gerät klingelt bei neuer Post.');
                } else if (neu === 'blockiert') {
                    toast.error(
                        'Der Browser blockiert Benachrichtigungen für diese Seite. '
                        + 'Das lässt sich nur in den Browsereinstellungen ändern.',
                        { duration: 9000 },
                    );
                }
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Umschalten fehlgeschlagen.');
        } finally {
            setLaeuft(false);
        }
    }, [laeuft, zustand]);

    // Noch nicht ermittelt, oder hier grundsätzlich nicht möglich.
    if (zustand === null || zustand === 'nicht-unterstuetzt' || zustand === 'server-aus') {
        return null;
    }

    const an = zustand === 'an';
    const blockiert = zustand === 'blockiert';
    const Symbol = laeuft ? Loader2 : blockiert ? BellOff : an ? BellRing : Bell;

    return (
        <button
            type="button"
            onClick={() => void umschalten()}
            disabled={laeuft || blockiert}
            aria-pressed={an}
            title={
                blockiert
                    ? 'Vom Browser blockiert — in den Browsereinstellungen für diese Seite erlauben'
                    : an
                        ? 'Benachrichtigungen aus'
                        : 'Bei neuer Post benachrichtigen'
            }
            className={cn(
                'rounded-md p-1.5 transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                an
                    ? 'text-accent-500 hover:bg-elevated'
                    : 'text-text-muted hover:bg-elevated hover:text-text-primary',
            )}
        >
            <Symbol className={cn('size-4', laeuft && 'animate-spin')} />
            <span className="sr-only">
                {an ? 'Benachrichtigungen ausschalten' : 'Benachrichtigungen einschalten'}
            </span>
        </button>
    );
}

export default PushToggle;
