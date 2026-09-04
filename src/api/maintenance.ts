/**
 * Maintenance Mode API.
 *
 * Wired to the bot-service backend:
 *   GET  /api/dashboard/admin/maintenance  → { enabled }
 *   PUT  /api/dashboard/admin/maintenance  → { success, enabled }
 *
 * The backend persists a single global boolean (merchant_settings 'admin'
 * → maintenanceMode). It does NOT store a free-text message or a scheduled
 * end time, so the UI exposes only the on/off toggle. When enabled, tenant
 * users see a maintenance banner in the User-Dashboard (MaintenanceBanner).
 */

import { apiFetch } from './client';
import { type MaintenanceState } from './types';

const ENDPOINT = '/api/dashboard/admin/maintenance';

export async function getMaintenanceState(): Promise<MaintenanceState> {
    const res = await apiFetch<{ enabled?: boolean }>(ENDPOINT);
    return { enabled: !!res?.enabled };
}

export async function setMaintenanceState(
    state: { enabled: boolean }
): Promise<MaintenanceState> {
    const res = await apiFetch<{ success?: boolean; enabled?: boolean }>(ENDPOINT, {
        method: 'PUT',
        body: JSON.stringify({ enabled: state.enabled }),
    });
    return { enabled: !!res?.enabled };
}
