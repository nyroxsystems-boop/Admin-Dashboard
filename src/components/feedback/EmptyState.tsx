/**
 * EmptyState — Premium empty state with icon, title, description, optional CTA.
 */

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-12 gap-3',
        'border border-dashed border-[color:var(--border,#252A31)] rounded-md',
        'bg-[color:var(--surface,#111418)]/50',
        className,
      )}
      {...rest}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-[color:var(--elevated,#1A1E24)] flex items-center justify-center text-[color:var(--text-muted,#71717A)]">
          <Icon size={20} aria-hidden />
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-sm">
        <h3 className="text-sm font-semibold text-[color:var(--text-primary,#E5E7EB)]">{title}</h3>
        {description && (
          <p className="text-xs text-[color:var(--text-muted,#71717A)] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-2 mt-2">
          {actionLabel && (
            <Button size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && (
            <Button size="sm" variant="outline" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
