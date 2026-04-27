/**
 * Bot Testing API — exercise the WhatsApp/AI pipeline manually.
 */

import { apiFetch } from './client';
import { BotTestResponseSchema, parseApiResponse, type BotTestResponse } from './types';

export interface BotTestPayload {
    phone: string;
    message: string;
    mediaUrl?: string;
}

export async function sendBotTestMessage(payload: BotTestPayload): Promise<BotTestResponse> {
    // Backend route is /chat (not /send). Body shape: { from, message, mediaUrl? }.
    const raw = await apiFetch<unknown>('/api/bot-testing/chat', {
        method: 'POST',
        body: JSON.stringify({
            from: payload.phone,
            message: payload.message,
            mediaUrl: payload.mediaUrl,
        }),
    });
    return parseApiResponse(BotTestResponseSchema, raw);
}

export async function uploadBotTestMedia(_file: File): Promise<{ url: string }> {
    // No /upload endpoint in the bot-testing router. Caller should pass a
    // pre-uploaded URL (or use a future /upload route once added).
    throw new Error('Direkter Upload nicht unterstützt — bitte URL einer hochgeladenen Datei verwenden.');
}

export async function cancelBotTestRun(_runId: string): Promise<{ success: boolean }> {
    // The bot-testing router exposes /reset (clear session) but no per-run cancel.
    await apiFetch('/api/bot-testing/reset', { method: 'POST' });
    return { success: true };
}
