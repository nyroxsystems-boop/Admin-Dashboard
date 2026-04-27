/**
 * Card — Standard-Container ohne Corner-Marks.
 *
 * Für CornerMark-Styling siehe CornerMarkCard (Partsunion-Signatur).
 *
 * Stream: A — Skelett. Minimal-Impl unten, Agentur erweitert.
 */

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const VARIANT = {
  default: 'bg-surface border border-border-subtle',
  elevated: 'bg-elevated border border-border-subtle shadow-card',
  flat: 'bg-transparent',
} as const;

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', interactive = false, className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-md transition-colors duration-fast',
        VARIANT[variant],
        PADDING[padding],
        interactive && 'hover:border-border-strong cursor-pointer',
        className,
      )}
      {...rest}
    />
  ),
);

Card.displayName = 'Card';
