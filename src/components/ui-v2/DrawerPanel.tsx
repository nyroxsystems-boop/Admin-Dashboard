/**
 * DrawerPanel — Slide-in Detailansicht (rechts oder links).
 *
 * Für Artikel-Details, Kunden-Info, etc. ohne Page-Wechsel.
 * Integriert @radix-ui/react-dialog → Focus-Trap, ESC-Close, Overlay-Click.
 */

import { forwardRef, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DrawerPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  side?: 'right' | 'left';
  width?: string; // z.B. "480px" oder "40%"
  children: ReactNode;
  className?: string;
  /** Content-Padding ausschalten (für eigene vollflächige Layouts). */
  padded?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
}

export const DrawerPanel = forwardRef<HTMLDivElement, DrawerPanelProps>(
  (
    {
      open,
      onClose,
      title,
      description,
      side = 'right',
      width = '480px',
      children,
      className,
      padded = true,
      closeOnBackdrop = true,
      closeOnEsc = true,
    },
    ref,
  ) => {
    return (
      <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={cn(
              'fixed inset-0 z-drawer bg-canvas/60 backdrop-blur-sm',
              'animate-fade-in',
            )}
            onClick={(e) => {
              if (!closeOnBackdrop) e.preventDefault();
            }}
          />
          <Dialog.Content
            ref={ref}
            onPointerDownOutside={(e) => {
              if (!closeOnBackdrop) e.preventDefault();
            }}
            onEscapeKeyDown={(e) => {
              if (!closeOnEsc) e.preventDefault();
            }}
            aria-describedby={description ? 'drawer-description' : undefined}
            style={{ width, maxWidth: '100vw' }}
            className={cn(
              'fixed top-0 bottom-0 z-drawer bg-surface',
              'border-border-subtle shadow-modal overflow-hidden',
              'focus:outline-none flex flex-col',
              side === 'right'
                ? 'right-0 border-l animate-[slide-in-right_400ms_cubic-bezier(0.16,1,0.3,1)_forwards]'
                : 'left-0 border-r animate-slide-in-left',
              className,
            )}
          >
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border-subtle flex-shrink-0">
              <div className="flex-1 min-w-0">
                {title ? (
                  <Dialog.Title className="font-display text-lg text-text-primary truncate">
                    {title}
                  </Dialog.Title>
                ) : (
                  <Dialog.Title className="sr-only">Panel</Dialog.Title>
                )}
                {description && (
                  <Dialog.Description
                    id="drawer-description"
                    className="text-xs text-text-secondary mt-0.5 truncate"
                  >
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Schließen"
                  className={cn(
                    'text-text-muted hover:text-text-primary flex-shrink-0',
                    'rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-500',
                  )}
                >
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
            <div className={cn('flex-1 overflow-y-auto', padded && 'p-4')}>
              {children}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  },
);

DrawerPanel.displayName = 'DrawerPanel';
