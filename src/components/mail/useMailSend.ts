import { useRef, useState } from 'react';
import { isApiError } from '@/api/client';
import { sendInboxEmail, updateInboxAssignment, type SendInboxEmailInput } from '@/api/inbox';

export type SendPhase = 'editing' | 'sending' | 'unconfirmed' | 'finishing' | 'finishFailed' | 'done';
function messageOf(reason: unknown, fallback: string): string {
    if (isApiError(reason) && reason.body && typeof reason.body === 'object') {
        const body = reason.body as { error?: unknown; details?: Array<{ message?: string }> };
        if (typeof body.error === 'string' && body.error.trim()) return body.error;
        const detail = body.details?.find(item => item.message)?.message;
        if (detail) return detail;
    }
    if (isApiError(reason) && reason.status >= 500) return fallback;
    return reason instanceof Error ? reason.message : fallback;
}
/** A resend check uses exactly the original request ID and payload. Completion never resends mail. */
export function useMailSend(onChanged: () => void) {
    const [phase, setPhase] = useState<SendPhase>('editing');
    const [error, setError] = useState('');
    const [requestId, setRequestId] = useState('');
    const lock = useRef(false);
    const snapshot = useRef<{ payload: SendInboxEmailInput; finishId?: string } | null>(null);

    async function finish(): Promise<void> {
        const id = snapshot.current?.finishId;
        if (!id) { setPhase('done'); return; }
        setPhase('finishing');
        try { await updateInboxAssignment(id, { status: 'done' }); setPhase('done'); onChanged(); }
        catch (reason) { setError(messageOf(reason, 'Bearbeitungsstatus konnte nicht gespeichert werden.')); setPhase('finishFailed'); }
    }

    async function execute(): Promise<void> {
        if (lock.current || !snapshot.current) return;
        lock.current = true; setError(''); setPhase('sending');
        try {
            await sendInboxEmail(snapshot.current.payload);
            onChanged();
            await finish();
        } catch (reason) {
            setError(messageOf(reason, 'Keine eindeutige Versandbestätigung erhalten.'));
            // A validation/permission rejection before delivery can be corrected. Anything
            // else is frozen: a timeout or provider error is not evidence of non-delivery.
            if (isApiError(reason) && [400, 401, 403, 404, 413, 422].includes(reason.status)) {
                snapshot.current = null; setPhase('editing');
            } else setPhase('unconfirmed');
        } finally { lock.current = false; }
    }

    async function send(payload: Omit<SendInboxEmailInput, 'requestId'>, finishId?: string): Promise<void> {
        if (lock.current || phase !== 'editing') return;
        const id = crypto.randomUUID();
        snapshot.current = { payload: { ...structuredClone(payload), requestId: id }, finishId };
        setRequestId(id);
        await execute();
    }
    async function retryFinish(): Promise<void> {
        if (lock.current || phase !== 'finishFailed') return;
        lock.current = true; setError('');
        try { await finish(); } finally { lock.current = false; }
    }
    return { phase, error, requestId, send, retry: execute, retryFinish,
        busy: ['sending', 'finishing'].includes(phase), locked: phase !== 'editing' };
}
