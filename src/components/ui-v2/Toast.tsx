/**
 * Toast + useToast — Benachrichtigungen via sonner.
 *
 * Exportiert:
 *  - <Toaster /> (hier nicht nochmal; bitte im App-Root einbinden)
 *  - useToast() Hook mit variant-spezifischen Shortcuts
 *  - <Toast /> Komponente (fallback-rendering für inline-toasts, non-sonner)
 */

import { forwardRef, useMemo, type ReactNode } from 'react';
import { toast as sonnerToast } from 'sonner';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface ToastProps {
  title: string;
  description?: ReactNode;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

const VARIANT_ICON = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
  default: null,
} as const;

const VARIANT_BORDER = {
  success: 'border-status-success/40',
  warning: 'border-status-warning/40',
  danger: 'border-status-danger/40',
  info: 'border-status-info/40',
  default: 'border-border-subtle',
} as const;

const VARIANT_ICON_COLOR = {
  success: 'text-status-success',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
  info: 'text-status-info',
  default: 'text-text-muted',
} as const;

/**
 * <Toast /> — Inline-rendered toast card. Für Custom-UI wo sonner nicht passt.
 * Für global-triggered toasts nutze useToast().toast().
 */
export const Toast = forwardRef<HTMLDivElement, ToastProps>(
  ({ title, description, variant = 'default', action }, ref) => {
    const Icon = VARIANT_ICON[variant];
    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(
          'flex items-start gap-3 bg-elevated border rounded-md p-4 shadow-card',
          VARIANT_BORDER[variant],
        )}
      >
        {Icon && (
          <Icon size={18} className={cn('flex-shrink-0 mt-0.5', VARIANT_ICON_COLOR[variant])} />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-text-primary">{title}</div>
          {description && (
            <div className="text-sm text-text-secondary mt-1">{description}</div>
          )}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="text-xs text-accent-400 hover:text-accent-500 mt-2 font-medium"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    );
  },
);
Toast.displayName = 'Toast';

function showToast({
  title,
  description,
  variant = 'default',
  duration,
  action,
}: ToastProps): string | number {
  const opts = {
    description,
    duration,
    action: action
      ? { label: action.label, onClick: action.onClick }
      : undefined,
  };

  switch (variant) {
    case 'success':
      return sonnerToast.success(title, opts);
    case 'warning':
      return sonnerToast.warning(title, opts);
    case 'danger':
      return sonnerToast.error(title, opts);
    case 'info':
      return sonnerToast.info(title, opts);
    case 'default':
    default:
      return sonnerToast(title, opts);
  }
}

/**
 * useToast — Hook für imperative Toast-API.
 *
 * @example
 *  const { toast, success, danger } = useToast();
 *  success({ title: 'Auftrag gespeichert' });
 *  danger({ title: 'Konnte nicht speichern', description: err.message });
 */
export function useToast() {
  return useMemo(
    () => ({
      toast: (props: ToastProps) => showToast(props),
      success: (props: Omit<ToastProps, 'variant'>) =>
        showToast({ ...props, variant: 'success' }),
      warning: (props: Omit<ToastProps, 'variant'>) =>
        showToast({ ...props, variant: 'warning' }),
      danger: (props: Omit<ToastProps, 'variant'>) =>
        showToast({ ...props, variant: 'danger' }),
      info: (props: Omit<ToastProps, 'variant'>) =>
        showToast({ ...props, variant: 'info' }),
      dismiss: (id?: string | number) => sonnerToast.dismiss(id),
    }),
    [],
  );
}
