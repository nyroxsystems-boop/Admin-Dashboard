/**
 * Badge — Uppercase-Technical-Label.
 *
 * Für Status-Bezeichnungen wie `NEU`, `OFFEN`, `AUTOFLOW`.
 * Monospace, uppercase, wide letter-spacing.
 *
 * Stream: A — Skelett.
 */

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
}

const VARIANT = {
  default: 'text-text-muted',
  accent: 'text-accent-400',
  success: 'text-status-success',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
} as const;

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', className, ...rest }, ref) => (
    <span
      ref={ref}
      className={cn('label-technical', VARIANT[variant], className)}
      {...rest}
    />
  ),
);

Badge.displayName = 'Badge';
