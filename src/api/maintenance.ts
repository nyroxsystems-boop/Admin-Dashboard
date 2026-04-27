/**
 * Maintenance Mode API.
 *
 * The bot-service backend currently does NOT expose a maintenance-mode
 * endpoint. We surface a static "disabled" state so the UI degrades to a
 * read-only banner; mutation throws a helpful error.
 */

import { type MaintenanceState } from './types';

export async function getMaintenanceState(): Promise<MaintenanceState> {
    return Promise.resolve({
        enabled: false,
        message: undefined,
        scheduled_until: null,
    });
}

export async function setMaintenanceState(
    _state: { enabled: boolean; message?: string; scheduled_until?: string | null }
): Promise<MaintenanceState> {
    throw new Error(
        'Wartungsmodus wird vom Backend (whatsapp-bot service) noch nicht unterstützt.'
    );
}
