/**
 * TimelineStepper — Horizontaler Status-Fortschritt.
 *
 *  ●─────●─────●─────○─────○
 *  Neu   WIP  Angbt Conf  Lfrg
 *
 * Stream: A — Skelett.
 */

import { forwardRef, Fragment } from 'react';
import { cn } from '@/lib/utils';

export interface TimelineStep {
  key: string;
  label: string;
  status: 'done' | 'current' | 'pending';
  /** Optional: Datum/Zeit */
  at?: string;
}

export interface TimelineStepperProps {
  steps: TimelineStep[];
  className?: string;
}

export const TimelineStepper = forwardRef<HTMLDivElement, TimelineStepperProps>(
  ({ steps, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center w-full', className)}
        role="list"
      >
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const dotColor =
            step.status === 'done' ? 'bg-status-success shadow-glow-success'
            : step.status === 'current' ? 'bg-accent-500 shadow-glow-accent animate-glow-pulse'
            : 'bg-border-strong';

          return (
            <Fragment key={step.key}>
              <div role="listitem" className="flex flex-col items-center gap-1.5 min-w-0">
                <span
                  className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', dotColor)}
                  aria-hidden
                />
                <span
                  className={cn(
                    'label-technical text-xs whitespace-nowrap',
                    step.status === 'pending' ? 'text-text-muted' : 'text-text-primary',
                  )}
                >
                  {step.label}
                </span>
                {step.at && (
                  <span className="text-xs text-text-muted font-mono">{step.at}</span>
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'flex-1 h-px mx-2',
                    step.status === 'done' ? 'bg-status-success' : 'bg-border-strong',
                  )}
                  aria-hidden
                />
              )}
            </Fragment>
          );
        })}
      </div>
    );
  },
);

TimelineStepper.displayName = 'TimelineStepper';
