/**
 * Modal — Radix-Dialog Wrapper.
 *
 *  - Focus-Trap (Radix macht das)
 *  - Escape-to-close (konfigurierbar)
 *  - Backdrop-Click-to-close (konfigurierbar)
 *  - Fade-in Animation
 *  - Size-Variants: sm | md | lg | xl | full
 */

import { forwardRef, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  className?: string;
  /** Schließen-Button in der Top-Right-Ecke anzeigen (default true bei title). */
  showClose?: boolean;
}

const SIZE = {
  sm: 'w-[400px]',
  md: 'w-[640px]',
  lg: 'w-[900px]',
  xl: 'w-[1200px]',
  full: 'w-[95vw] h-[95vh]',
} as const;

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      open,
      onClose,
      title,
      description,
      children,
      size = 'md',
      className,
      closeOnBackdrop = true,
      closeOnEsc = true,
      showClose,
    },
    ref,
  ) => {
    const shouldShowClose = showClose ?? !!title;

    return (
      <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={cn(
              'fixed inset-0 z-modal bg-canvas/80 backdrop-blur-sm',
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
            aria-describedby={description ? 'modal-description' : undefined}
            className={cn(
              'fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2',
              'bg-surface border border-border-subtle rounded-md shadow-modal',
              'max-h-[90vh] overflow-hidden flex flex-col',
              'focus:outline-none animate-fade-in',
              SIZE[size],
              className,
            )}
          >
            {(title || description || shouldShowClose) && (
              <div className="flex items-start justify-between gap-4 p-6 border-b border-border-subtle flex-shrink-0">
                <div className="flex-1 min-w-0">
                  {title ? (
                    <Dialog.Title className="font-display text-lg text-text-primary">
                      {title}
                    </Dialog.Title>
                  ) : (
                    <Dialog.Title className="sr-only">Dialog</Dialog.Title>
                  )}
                  {description && (
                    <Dialog.Description
                      id="modal-description"
                      className="text-sm text-text-secondary mt-1"
                    >
                      {description}
                    </Dialog.Description>
                  )}
                </div>
                {shouldShowClose && (
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Schließen"
                      className={cn(
                        'text-text-muted hover:text-text-primary',
                        'rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-500',
                        'flex-shrink-0',
                      )}
                    >
                      <X size={18} />
                    </button>
                  </Dialog.Close>
                )}
              </div>
            )}
            {!title && !description && shouldShowClose && (
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Schließen"
                  className={cn(
                    'absolute top-3 right-3 text-text-muted hover:text-text-primary',
                    'rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-500 p-1',
                  )}
                >
                  <X size={18} />
                </button>
              </Dialog.Close>
            )}
            <div className="p-6 overflow-y-auto flex-1">{children}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  },
);

Modal.displayName = 'Modal';
