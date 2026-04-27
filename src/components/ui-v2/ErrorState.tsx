/**
 * ErrorState — Backend-/Network-Fehlerzustand.
 *
 * Zeigt Fehlermeldung + Retry-Button. Nicht für 0-Items → siehe EmptyState.
 */

import { forwardRef } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  /** Kompakte Variante */
  compact?: boolean;
  className?: string;
}

function toMessage(err: unknown): string | null {
  if (!err) return null;
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return null;
  }
}

export const ErrorState = forwardRef<HTMLDivElement, ErrorStateProps>(
  ({ title = 'Daten konnten nicht geladen werden', description, error, onRetry, compact, className }, ref) => {
    const detail = description ?? toMessage(error) ?? 'Das Backend ist nicht erreichbar. Bitte erneut versuchen.';
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'flex flex-col items-center justify-center text-center',
          compact ? 'py-6 px-4' : 'py-12 px-6',
          className,
        )}
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md border border-status-danger/40 bg-status-danger-muted">
          <AlertTriangle size={22} className="text-status-danger" strokeWidth={1.5} />
        </div>
        <h3 className="font-display text-base text-text-primary">{title}</h3>
        <p className="mt-1.5 max-w-md text-sm text-text-secondary leading-relaxed">{detail}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              'mt-5 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium',
              'bg-elevated border border-border-subtle text-text-primary hover:border-border-strong transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
            )}
          >
            <RefreshCw size={14} />
            Erneut laden
          </button>
        )}
      </div>
    );
  },
);

ErrorState.displayName = 'ErrorState';
