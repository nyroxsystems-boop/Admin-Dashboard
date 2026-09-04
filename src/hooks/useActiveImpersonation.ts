/**
 * useActiveImpersonation — reaktiver Lesezugriff auf den Impersonation-Marker (P1.4).
 * Aktualisiert sich live, wenn eine Impersonation startet/endet (auch tab-übergreifend).
 */
import { useSyncExternalStore } from 'react';
import {
    getActiveImpersonationSnapshot,
    subscribeImpersonation,
    type ActiveImpersonation,
} from '@/lib/impersonationSession';

export function useActiveImpersonation(): ActiveImpersonation | null {
    return useSyncExternalStore(
        subscribeImpersonation,
        getActiveImpersonationSnapshot,
        () => null,
    );
}
