/**
 * useBotTesting — exercise the WhatsApp/AI pipeline through real endpoints.
 *
 * Differences from previous stub shape:
 *   - sendBotTestMessage takes a structured payload (phone, message, mediaUrl?)
 *     and returns BotTestResponse { success, message?, raw? }
 *   - Local history is still kept as a session-scoped state for the
 *     existing UI; entries now reflect the real backend response.
 *   - Media upload is exposed as a separate mutation (useUploadBotMedia)
 *   - Cancellation hits POST /api/bot-testing/runs/:id/cancel via
 *     useCancelBotTestRun.
 */

import { useCallback, useState } from 'react';
import {
    useMutation,
    type UseMutationResult,
} from '@tanstack/react-query';
import {
    sendBotTestMessage,
    uploadBotTestMedia,
    cancelBotTestRun,
    type BotTestPayload,
} from '@/api/bot';
import type { BotTestResponse } from '@/api/types';

export interface BotTestResult {
    id: string;
    timestamp: string;
    phone: string;
    message: string;
    response: string;
    durationMs: number;
    status: 'ok' | 'error';
    raw?: unknown;
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

export function useUploadBotMedia(): UseMutationResult<{ url: string }, Error, File> {
    return useMutation({
        mutationFn: (file) => uploadBotTestMedia(file),
    });
}

export function useCancelBotTestRun(): UseMutationResult<
    { success: boolean },
    Error,
    string
> {
    return useMutation({
        mutationFn: (runId) => cancelBotTestRun(runId),
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
                    response: res.message ?? (res.success ? 'OK' : 'Failed'),
                    durationMs: Date.now() - start,
                    status: res.success ? 'ok' : 'error',
                    raw: res.raw,
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
                        response: message,
                        durationMs: Date.now() - start,
                        status: 'error',
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
