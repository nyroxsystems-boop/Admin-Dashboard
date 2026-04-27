/**
 * ErrorState — Premium error display with retry button.
 */

import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  /** Detailed error (shown in <details> for power users). */
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'Etwas ist schiefgelaufen',
  message = 'Die angeforderten Daten konnten nicht geladen werden.',
  detail,
  onRetry,
  retryLabel = 'Erneut versuchen',
  className,
  ...rest
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-12 gap-3',
        'border border-[color:var(--danger-muted,rgba(248,113,113,0.12))]',
        'rounded-md bg-[color:var(--danger-muted,rgba(248,113,113,0.06))]',
        className,
      )}
      {...rest}
    >
      <div className="w-12 h-12 rounded-full bg-[color:var(--danger-muted,rgba(248,113,113,0.12))] flex items-center justify-center text-[color:var(--danger-500,#F87171)]">
        <AlertTriangle size={20} aria-hidden />
      </div>
      <div className="flex flex-col gap-1 max-w-md">
        <h3 className="text-sm font-semibold text-[color:var(--text-primary,#E5E7EB)]">{title}</h3>
        <p className="text-xs text-[color:var(--text-muted,#71717A)] leading-relaxed">{message}</p>
      </div>
      {detail && (
        <details className="text-left max-w-md w-full">
          <summary className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--text-muted,#71717A)] cursor-pointer">
            Details anzeigen
          </summary>
          <pre className="mt-2 p-3 rounded-md bg-[color:var(--canvas,#0A0B0D)] border border-[color:var(--border,#252A31)] text-[10px] font-mono text-[color:var(--text-secondary,#A1A1AA)] whitespace-pre-wrap break-words">
            {detail}
          </pre>
        </details>
      )}
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-2 gap-1.5">
          <RefreshCw size={14} aria-hidden />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
