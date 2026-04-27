/**
 * Marketing Email Templates API — generate, save, send.
 */

import { apiFetch } from './client';
import {
    EmailTemplateSchema,
    GeneratedEmailSchema,
    EmailRecipientSchema,
    parseApiResponse,
    type EmailRecipient,
    type EmailTemplate,
    type GeneratedEmail,
} from './types';
import { z } from 'zod';

export async function generateEmailTemplate(prompt: string): Promise<{ success: boolean; email: GeneratedEmail }> {
    const raw = await apiFetch<{ success: boolean; email: unknown }>('/api/admin/emails/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
    });
    return { success: raw.success, email: parseApiResponse(GeneratedEmailSchema, raw.email) };
}

export async function improveEmailTemplate(
    prompt: string,
    existingContent: string
): Promise<{ success: boolean; email: GeneratedEmail }> {
    const raw = await apiFetch<{ success: boolean; email: unknown }>('/api/admin/emails/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt, improve: true, existingContent }),
    });
    return { success: raw.success, email: parseApiResponse(GeneratedEmailSchema, raw.email) };
}

export async function getEmailRecipients(
    type: 'active' | 'cancelled' | 'trial' | 'all'
): Promise<{ type: string; count: number; recipients: EmailRecipient[] }> {
    const raw = await apiFetch<{ type: string; count: number; recipients: unknown }>(
        `/api/admin/emails/recipients/${type}`
    );
    const list = z.array(EmailRecipientSchema).safeParse(raw.recipients);
    return {
        type: raw.type,
        count: raw.count,
        recipients: list.success ? list.data : [],
    };
}

export async function sendMarketingEmail(
    subject: string,
    htmlContent: string,
    recipientType?: string,
    customEmails?: string[]
): Promise<{ success: boolean; sent: number; failed: number; total: number }> {
    return apiFetch('/api/admin/emails/send', {
        method: 'POST',
        body: JSON.stringify({ subject, htmlContent, recipientType, customEmails }),
    });
}

export async function getSavedTemplates(): Promise<EmailTemplate[]> {
    const raw = await apiFetch<unknown>('/api/admin/emails/templates');
    const parsed = z.array(EmailTemplateSchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
}

export async function saveEmailTemplate(
    name: string,
    subject: string,
    htmlContent: string,
    prompt?: string
): Promise<{ success: boolean; id: string }> {
    return apiFetch('/api/admin/emails/templates', {
        method: 'POST',
        body: JSON.stringify({ name, subject, htmlContent, prompt }),
    });
}
