import * as React from 'react';

import { cn } from './utils';

/**
 * Skeleton with SHIMMER animation (not animate-pulse).
 * The shimmer keyframes/utility class `animate-shimmer` is provided by
 * the design-system CSS layer (Agent 1 — tokens/theme).
 *
 * Falls back to a static gradient when reduced-motion is active.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:bg-gradient-to-r before:from-transparent before:via-overlay/10 before:to-transparent',
        'before:animate-[shimmer_1.6s_ease-in-out_infinite]',
        'motion-reduce:before:animate-none',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
