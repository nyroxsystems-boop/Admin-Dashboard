import { useEffect } from 'react';

/**
 * useBeforeUnload — Warns user when leaving the page with unsaved changes.
 */
export function useBeforeUnload(dirty: boolean, message = 'Änderungen wurden nicht gespeichert.'): void {
    useEffect(() => {
        if (!dirty) return;

        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = message;
            return message;
        };

        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty, message]);
}
