/**
 * Bot Testing API — exercise the WhatsApp/AI pipeline manually.
 *
 * Backend contract (botTestingRoutes.ts POST /chat):
 *   body:     { from, text, merchantId?, imageBase64? }
 *   response: { reply, orderId?, orderDetails?, interimMessages, pdfDocument?, … }
 */

import { apiFetch } from './client';
import { BotTestResponseSchema, parseApiResponse, type BotTestResponse } from './types';

export interface BotTestPayload {
    phone: string;
    message: string;
    /** P2.1: kanonische tenant_id (companies.pk) — als welcher Händler getestet wird.
     *  Ohne sie fällt das Backend auf DEFAULT_MERCHANT_ID / 'admin' zurück. */
    merchantId?: string;
    /** Raw base64 (ohne data:-Prefix) — Backend baut daraus die Media-URL. */
    imageBase64?: string;
}

export async function sendBotTestMessage(payload: BotTestPayload): Promise<BotTestResponse> {
    const raw = await apiFetch<unknown>('/api/bot-testing/chat', {
        method: 'POST',
        body: JSON.stringify({
            from: payload.phone,
            text: payload.message,
            ...(payload.merchantId ? { merchantId: payload.merchantId } : {}),
            ...(payload.imageBase64 ? { imageBase64: payload.imageBase64 } : {}),
        }),
    });
    return parseApiResponse(BotTestResponseSchema, raw);
}

/** Datei → raw base64 (ohne data:-Prefix) für den imageBase64-Body. */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const comma = result.indexOf(',');
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(reader.error ?? new Error('Datei konnte nicht gelesen werden'));
        reader.readAsDataURL(file);
    });
}

export async function cancelBotTestRun(from: string): Promise<{ success: boolean }> {
    // The bot-testing router exposes /reset (clear session) but no per-run cancel —
    // resetting the phone's session IS the cancel. P0.3: /reset REQUIRES `from`
    // and 400s without it; the old call sent an empty body and always failed.
    await apiFetch('/api/bot-testing/reset', {
        method: 'POST',
        body: JSON.stringify({ from }),
    });
    return { success: true };
}
