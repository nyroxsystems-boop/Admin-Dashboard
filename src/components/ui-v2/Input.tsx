/**
 * Input — Text-Input mit Partsunion-Styling.
 *
 * Features:
 *  - Label mit htmlFor
 *  - Error-State (border-status-danger + aria-invalid + role="alert")
 *  - Hint-Text unter Input (versteckt bei Error)
 *  - Left/Right-Icon-Slots
 *  - Monospace-Variant für Zahlen (tabular-nums)
 *  - Focus-Ring auf Akzent-Blau
 *  - Disabled-State
 */

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** Zahlen-Input: tabellarische Ziffern, monospace */
  monospace?: boolean;
  /** Container-Klassen (nicht auf <input>) */
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      monospace,
      className,
      containerClassName,
      id,
      disabled,
      required,
      'aria-describedby': ariaDescribedBy,
      ...rest
    },
    ref,
  ) => {
    const reactId = useId();
    const inputId = id ?? `input-${reactId}`;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const describedBy = [
      ariaDescribedBy,
      error ? errorId : undefined,
      hint && !error ? hintId : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm text-text-secondary">
            {label}
            {required && <span className="text-status-danger ml-0.5" aria-hidden>*</span>}
          </label>
        )}
        <div className={cn('relative', className)}>
          {leftIcon && (
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none flex items-center"
              aria-hidden
            >
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            aria-required={required}
            disabled={disabled}
            required={required}
            className={cn(
              'w-full h-10 px-3 rounded-md bg-surface border transition-colors',
              'text-sm text-text-primary placeholder:text-text-muted',
              'focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error
                ? 'border-status-danger focus:border-status-danger focus:ring-status-danger'
                : 'border-border-subtle hover:border-border-strong',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              monospace && 'font-mono tabular-nums',
            )}
            {...rest}
          />
          {rightIcon && (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted flex items-center"
              aria-hidden
            >
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-xs text-status-danger">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-xs text-text-muted">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
