/**
 * Skeleton — generic loading placeholder with SHIMMER animation.
 *
 * Reuses the design-system `animate-shimmer` keyframes (Agent 1) but
 * falls back to a static gradient when reduced-motion is requested.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width — number = px, string = passthrough. */
  width?: number | string;
  /** Height — number = px, string = passthrough. */
  height?: number | string;
  /** If true, render as a circle. */
  circle?: boolean;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, width, height, circle, style, ...props }, ref) => {
    const inlineStyle: React.CSSProperties = {
      ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : null),
      ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : null),
      ...style,
    };
    return (
      <div
        ref={ref}
        data-slot="skeleton"
        aria-hidden="true"
        style={inlineStyle}
        className={cn(
          'relative overflow-hidden bg-surface',
          circle ? 'rounded-full' : 'rounded-md',
          'before:absolute before:inset-0 before:-translate-x-full',
          'before:bg-gradient-to-r before:from-transparent before:via-overlay/[0.06] before:to-transparent',
          'before:animate-[shimmer_1.6s_ease-in-out_infinite]',
          'motion-reduce:before:animate-none',
          className,
        )}
        {...props}
      />
    );
  },
);
Skeleton.displayName = 'Skeleton';

/** Convenience: stack of N text-line skeletons. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          className={i === lines - 1 ? 'w-3/5' : 'w-full'}
        />
      ))}
    </div>
  );
}
