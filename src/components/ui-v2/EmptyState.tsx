/**
 * EmptyState — Leerer Zustand (keine Daten).
 *
 * Für Listen-Views wenn das Backend `[]` liefert. NICHT für Fehler (siehe ErrorState).
 */

import { forwardRef, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Kompakte Variante (vertikale Höhe minimiert) */
  compact?: boolean;
  children?: ReactNode;
  className?: string;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon: Icon, title, description, action, compact, children, className }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        className={cn(
          'flex flex-col items-center justify-center text-center',
          compact ? 'py-8 px-4' : 'py-16 px-6',
          className,
        )}
      >
        {Icon && (
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border-subtle bg-elevated">
            <Icon size={22} className="text-text-muted" strokeWidth={1.5} />
          </div>
        )}
        <h3 className="font-display text-base text-text-primary">{title}</h3>
        {description && (
          <p className="mt-1.5 max-w-md text-sm text-text-secondary leading-relaxed">{description}</p>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={cn(
              'mt-5 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium',
              'bg-accent-500 text-white hover:bg-accent-600 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
            )}
          >
            {action.label}
          </button>
        )}
        {children}
      </div>
    );
  },
);

EmptyState.displayName = 'EmptyState';
