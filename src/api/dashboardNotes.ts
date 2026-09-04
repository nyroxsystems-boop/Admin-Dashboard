import { apiFetch } from './client';

export type DashboardNoteCategory = 'important' | 'idea' | 'improvement' | 'todo';
export type DashboardNoteStatus = 'open' | 'done';

export interface DashboardNote {
    id: string;
    title: string;
    body: string;
    category: DashboardNoteCategory;
    status: DashboardNoteStatus;
    created_by: string;
    author_label: string;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}

export interface CreateDashboardNoteInput {
    title: string;
    body?: string;
    category: DashboardNoteCategory;
}

const BASE = '/api/admin/dashboard-notes';

export async function listDashboardNotes(): Promise<{ notes: DashboardNote[] }> {
    return apiFetch<{ notes: DashboardNote[] }>(BASE);
}

export async function createDashboardNote(input: CreateDashboardNoteInput): Promise<{ note: DashboardNote }> {
    return apiFetch<{ note: DashboardNote }>(BASE, {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

export async function updateDashboardNote(
    id: string,
    input: Partial<Pick<DashboardNote, 'status' | 'title' | 'body' | 'category'>>,
): Promise<{ note: DashboardNote }> {
    return apiFetch<{ note: DashboardNote }>(`${BASE}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
    });
}

export async function deleteDashboardNote(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

