/**
 * Maintenance Mode API — toggle global service banner / read-only mode.
 */

import { apiFetch } from './client';
import { MaintenanceStateSchema, parseApiResponse, type MaintenanceState } from './types';

export async function getMaintenanceState(): Promise<MaintenanceState> {
    const raw = await apiFetch<unknown>('/api/admin/maintenance');
    return parseApiResponse(MaintenanceStateSchema, raw);
}

export async function setMaintenanceState(
    state: { enabled: boolean; message?: string; scheduled_until?: string | null }
): Promise<MaintenanceState> {
    const raw = await apiFetch<unknown>('/api/admin/maintenance', {
        method: 'PUT',
        body: JSON.stringify(state),
    });
    return parseApiResponse(MaintenanceStateSchema, raw);
}
