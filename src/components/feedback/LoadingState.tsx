/**
 * LoadingState — Generic full-area loading indicator with optional ETA.
 */

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  /** Estimated remaining seconds; rendered as "≈ 12s". */
  etaSeconds?: number;
  /** Inline (small) variant — no padding, smaller spinner. */
  inline?: boolean;
}

export function LoadingState({
  label = 'Lade…',
  etaSeconds,
  inline,
  className,
  ...rest
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex items-center justify-center gap-3',
        inline ? 'py-2' : 'py-12',
        'text-[color:var(--text-muted,#71717A)]',
        className,
      )}
      {...rest}
    >
      <Loader2
        size={inline ? 14 : 18}
        className="animate-spin text-[color:var(--accent-500,#1D6FE8)]"
        aria-hidden
      />
      <span className={cn('text-sm', inline && 'text-xs')}>{label}</span>
      {typeof etaSeconds === 'number' && etaSeconds > 0 && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--text-muted,#71717A)]">
          ≈ {Math.ceil(etaSeconds)}s
        </span>
      )}
    </div>
  );
}
