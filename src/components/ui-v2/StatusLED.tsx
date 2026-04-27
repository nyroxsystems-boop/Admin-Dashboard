/**
 * StatusLED — 6px-Kreis mit Glow-Schatten statt Status-Pills.
 *
 * Partsunion-Signatur-Komponente. Visuell in 2ms erfassbar,
 * schneller als farbige Pills mit Text.
 *
 * Stream: A — Design System
 *
 * @example
 * <StatusLED status="success" label="Lieferbar" />
 * <StatusLED status="warning" label="OEM-Review nötig" />
 * <StatusLED status="muted" />  // ohne Label, nur Dot
 */

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type StatusLEDStatus = 'success' | 'warning' | 'danger' | 'info' | 'muted';

export interface StatusLEDProps {
  status: StatusLEDStatus;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Animiert pulsiert — nutze sparsam (z.B. für "live"-States) */
  pulse?: boolean;
  className?: string;
}

const STATUS_CLASSES: Record<StatusLEDStatus, string> = {
  success: 'bg-status-success shadow-glow-success',
  warning: 'bg-status-warning shadow-glow-warning',
  danger: 'bg-status-danger shadow-glow-danger',
  info: 'bg-status-info',
  muted: 'bg-text-muted',
};

const SIZE_CLASSES: Record<NonNullable<StatusLEDProps['size']>, string> = {
  sm: 'w-1.5 h-1.5',   // 6px
  md: 'w-2 h-2',       // 8px
  lg: 'w-2.5 h-2.5',   // 10px
};

export const StatusLED = forwardRef<HTMLDivElement, StatusLEDProps>(
  ({ status, label, size = 'sm', pulse = false, className }, ref) => {
    const dot = (
      <span
        aria-hidden="true"
        className={cn(
          'inline-block rounded-full flex-shrink-0',
          STATUS_CLASSES[status],
          SIZE_CLASSES[size],
          pulse && 'animate-pulse-soft',
        )}
      />
    );

    if (!label) {
      return (
        <div
          ref={ref}
          role="status"
          aria-label={`Status: ${status}`}
          className={cn('inline-flex', className)}
        >
          {dot}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        role="status"
        aria-label={`${label} (${status})`}
        className={cn('inline-flex items-center gap-2', className)}
      >
        {dot}
        <span className="text-sm text-text-secondary">{label}</span>
      </div>
    );
  },
);

StatusLED.displayName = 'StatusLED';
