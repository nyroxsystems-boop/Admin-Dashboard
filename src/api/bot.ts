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
    const raw = await apiFetch<unknown>('/api/bot-testing/send', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return parseApiResponse(BotTestResponseSchema, raw);
}

export async function uploadBotTestMedia(file: File): Promise<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return apiFetch<{ url: string }>('/api/bot-testing/upload', {
        method: 'POST',
        body: form,
        headers: {
            // Strip Content-Type so the browser sets the multipart boundary.
            'Content-Type': '',
        },
    });
}

export async function cancelBotTestRun(runId: string): Promise<{ success: boolean }> {
    return apiFetch(`/api/bot-testing/runs/${runId}/cancel`, { method: 'POST' });
}
