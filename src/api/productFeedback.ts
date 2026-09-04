import { apiFetch } from './client';

export type ProductFeedbackSource = 'user-dashboard' | 'mobile-app' | 'digital-request';
export type ProductFeedbackCategory = 'idea' | 'improvement' | 'problem' | 'other';
export type ProductFeedbackStatus = 'new' | 'seen' | 'planned' | 'done' | 'rejected';
export type ProductFeedbackPriority = 'low' | 'normal' | 'high';

export interface ProductFeedback {
    id: string;
    tenant_id: string;
    tenant_name: string;
    user_id: string;
    user_label: string;
    user_email: string | null;
    source: ProductFeedbackSource;
    category: ProductFeedbackCategory;
    subject: string;
    message: string;
    context: { route?: string; app_version?: string; [key: string]: unknown };
    status: ProductFeedbackStatus;
    priority: ProductFeedbackPriority;
    internal_note: string;
    created_at: string;
    updated_at: string;
    seen_at: string | null;
    resolved_at: string | null;
}

const BASE = '/api/admin/product-feedback';

export async function listProductFeedback(): Promise<{ feedback: ProductFeedback[] }> {
    return apiFetch<{ feedback: ProductFeedback[] }>(BASE);
}

export async function updateProductFeedback(
    id: string,
    input: Partial<Pick<ProductFeedback, 'status' | 'priority' | 'internal_note'>>,
): Promise<{ feedback: ProductFeedback }> {
    return apiFetch<{ feedback: ProductFeedback }>(`${BASE}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
    });
}
