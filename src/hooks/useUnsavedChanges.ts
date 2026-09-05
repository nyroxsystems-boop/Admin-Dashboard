import { createContext, useContext, useEffect, useId } from 'react';
import { useBeforeUnload } from './useBeforeUnload';

export type UnsavedDraft = { label: string; busy: boolean };
export const UnsavedChangesContext = createContext<{
    register: (id: string, draft: UnsavedDraft | null) => void;
    confirmDiscard: () => boolean;
} | null>(null);

export function useUnsavedChanges(label: string, dirty: boolean, busy = false): void {
    const registry = useContext(UnsavedChangesContext);
    const register = registry?.register;
    const id = useId();
    useBeforeUnload(!registry && (dirty || busy));
    useEffect(() => {
        register?.(id, dirty || busy ? { label, busy } : null);
        return () => register?.(id, null);
    }, [register, id, label, dirty, busy]);
}

export function useConfirmDiscard(): () => boolean {
    return useContext(UnsavedChangesContext)?.confirmDiscard ?? (() => true);
}
