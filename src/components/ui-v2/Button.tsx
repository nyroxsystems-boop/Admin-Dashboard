/**
 * Button — Die ein-Akzent-Regel in Code.
 *
 * `variant="primary"` = accent-500 Blau. EIN Button pro Screen darf das sein.
 * Alle anderen Buttons sind `secondary` oder `ghost`.
 *
 * Stream: A — Design System
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base
  'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-fast ' +
    'disabled:opacity-50 disabled:cursor-not-allowed ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
  {
    variants: {
      variant: {
        /** DIE eine Primary-Action pro Screen. accent-500 Blau. */
        primary: 'bg-accent-500 text-white hover:bg-accent-600 shadow-glow-accent',
        /** Default für alle anderen Aktionen. Neutral, kein Blau. */
        secondary: 'bg-elevated text-text-primary border border-border-subtle hover:border-border-strong hover:bg-[#202530]',
        /** Für destruktive Aktionen. */
        danger: 'bg-status-danger-muted text-status-danger border border-status-danger/40 hover:bg-status-danger hover:text-white',
        /** Minimal, nur Text. Für Sekundär-Aktionen in Dropdowns oder Cards. */
        ghost: 'text-text-secondary hover:text-text-primary hover:bg-elevated',
        /** Link-Style. */
        link: 'text-accent-400 hover:text-accent-500 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-md',
        md: 'h-10 px-4 text-sm rounded-md',
        lg: 'h-12 px-6 text-base rounded-md',
        icon: 'h-9 w-9 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, leftIcon, rightIcon, children, disabled, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...rest}
      >
        {isLoading ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
