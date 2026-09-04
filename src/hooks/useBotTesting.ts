/**
 * useBotTesting — exercise the WhatsApp/AI pipeline through real endpoints.
 *
 * Contract (botTestingRoutes.ts /chat): payload { phone, message, imageBase64? },
 * response { reply, orderId?, interimMessages, … }. Bilder werden clientseitig
 * via fileToBase64 konvertiert — es gibt keinen Upload-Endpoint.
 */

import { useCallback, useState } from 'react';
import {
    useMutation,
    type UseMutationResult,
} from '@tanstack/react-query';
import {
    sendBotTestMessage,
    cancelBotTestRun,
    type BotTestPayload,
} from '@/api/bot';
import type { BotTestResponse, BotOrderDetails } from '@/api/types';

export interface BotTestResult {
    id: string;
    timestamp: string;
    phone: string;
    message: string;
    /** P2.2: strukturiert statt zu einem String gejoint. */
    reply: string;
    interimMessages: string[];
    orderId?: string | number | null;
    orderDetails?: BotOrderDetails | null;
    pdfDocument?: { base64: string; filename: string; caption?: string } | null;
    /** Händler, gegen den getestet wurde (für den Order-Deep-Link). */
    merchantId?: string | null;
    durationMs: number;
    status: 'ok' | 'error';
    error?: string;
}

export function useSendBotTestMessage(): UseMutationResult<
    BotTestResponse,
    Error,
    BotTestPayload
> {
    return useMutation({
        mutationFn: (payload) => sendBotTestMessage(payload),
    });
}

/** Reset the backend bot-test session. The mutation variable is the phone
 *  number (`from`) whose session to clear — /reset requires it (P0.3). */
export function useCancelBotTestRun(): UseMutationResult<
    { success: boolean },
    Error,
    string
> {
    return useMutation({
        mutationFn: (from) => cancelBotTestRun(from),
    });
}

/**
 * Composite hook keeping a session-scoped history of test runs.
 * Wraps the real send mutation; failures land as `status: 'error'` rows.
 */
export function useBotTesting(): {
    history: BotTestResult[];
    isRunning: boolean;
    error: string | null;
    sendTest: (input: BotTestPayload) => Promise<void>;
    clearHistory: () => void;
} {
    const send = useSendBotTestMessage();
    const [history, setHistory] = useState<BotTestResult[]>([]);
    const [error, setError] = useState<string | null>(null);

    const sendTest = useCallback(
        async (input: BotTestPayload): Promise<void> => {
            setError(null);
            const start = Date.now();
            try {
                const res = await send.mutateAsync(input);
                const row: BotTestResult = {
                    id: 'bt_' + Math.random().toString(36).slice(2, 8),
                    timestamp: new Date().toISOString(),
                    phone: input.phone,
                    message: input.message,
                    reply: res.reply || '(leere Antwort)',
                    interimMessages: res.interimMessages ?? [],
                    orderId: res.orderId ?? null,
                    orderDetails: res.orderDetails ?? null,
                    pdfDocument: res.pdfDocument ?? null,
                    merchantId: input.merchantId ?? null,
                    durationMs: Date.now() - start,
                    status: 'ok',
                };
                setHistory((prev) => [row, ...prev]);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Bot test failed';
                setError(message);
                setHistory((prev) => [
                    {
                        id: 'bt_' + Math.random().toString(36).slice(2, 8),
                        timestamp: new Date().toISOString(),
                        phone: input.phone,
                        message: input.message,
                        reply: '',
                        interimMessages: [],
                        durationMs: Date.now() - start,
                        status: 'error',
                        error: message,
                    },
                    ...prev,
                ]);
            }
        },
        [send]
    );

    const clearHistory = useCallback(() => setHistory([]), []);

    return {
        history,
        isRunning: send.isPending,
        error,
        sendTest,
        clearHistory,
    };
}
