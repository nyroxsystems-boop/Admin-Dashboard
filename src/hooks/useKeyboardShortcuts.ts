import { useEffect } from 'react';

export interface ShortcutHandler {
    /** Key (case-insensitive). Examples: "k", "n", "/", "?", "Escape". */
    key: string;
    /** Cmd on macOS, Ctrl elsewhere. */
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
    handler: (e: KeyboardEvent) => void;
    /** Allow this shortcut even when focus is in an input/textarea. */
    allowInInput?: boolean;
    /** Optional label for ShortcutsOverlay. */
    description?: string;
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/**
 * useKeyboardShortcuts — Generic global shortcut binder.
 *
 * Usage:
 *   useKeyboardShortcuts([
 *     { key: 'k', meta: true, handler: () => openCommandPalette() },
 *     { key: '/', handler: () => focusSearch() },
 *   ]);
 */
export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]): void {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            for (const s of shortcuts) {
                if (e.key.toLowerCase() !== s.key.toLowerCase()) continue;
                const wantMeta = !!s.meta;
                const hasMeta = e.metaKey || e.ctrlKey;
                if (wantMeta !== hasMeta) continue;
                if (!!s.shift !== e.shiftKey) continue;
                if (!!s.alt !== e.altKey) continue;
                if (!s.allowInInput && isEditableTarget(e.target)) continue;
                e.preventDefault();
                s.handler(e);
                return;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [shortcuts]);
}
