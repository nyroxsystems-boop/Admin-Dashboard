/**
 * MonoMetric — KPI mit großer Monospace-Zahl + Label.
 *
 * Bloomberg-Terminal-Stil für Dashboard-KPIs. Zahlen sind Daten,
 * in Mono werden sie in Tabellen-ähnlicher Präzision lesbar.
 *
 * Stream: A — Design System
 *
 * @example
 * <MonoMetric value="23.440 €" label="Offene Posten" size="lg" />
 * <MonoMetric value="67%" label="Konversion heute" trend="up" delta="+12%" />
 */

import { forwardRef, type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MonoMetricProps {
  value: ReactNode;
  label: string;
  /** Optionale Ergänzung unter dem Label */
  sublabel?: string;
  /** Trend-Indikator relativ zu vorherigem Zeitraum */
  trend?: 'up' | 'down' | 'flat';
  /** Delta-Wert, z.B. "+12%" oder "-430 €" */
  delta?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Monospace-Akzent durch Farbe hervorheben */
  emphasized?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<MonoMetricProps['size']>, { value: string; label: string }> = {
  sm: { value: 'text-kpi-sm', label: 'text-xs' },
  md: { value: 'text-kpi', label: 'text-sm' },
  lg: { value: 'text-kpi-lg', label: 'text-sm' },
};

const TREND_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
} as const;

const TREND_COLOR = {
  up: 'text-status-success',
  down: 'text-status-danger',
  flat: 'text-text-muted',
} as const;

export const MonoMetric = forwardRef<HTMLDivElement, MonoMetricProps>(
  ({ value, label, sublabel, trend, delta, size = 'md', emphasized = false, className }, ref) => {
    const TrendIcon = trend ? TREND_ICON[trend] : null;

    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-1', className)}
      >
        <div className="flex items-baseline gap-3">
          <span
            className={cn(
              'font-mono tabular-nums',
              SIZE_CLASSES[size].value,
              emphasized ? 'text-accent-500' : 'text-text-primary',
            )}
          >
            {value}
          </span>
          {trend && delta && (
            <span className={cn('inline-flex items-center gap-1 text-xs font-mono', TREND_COLOR[trend])}>
              {TrendIcon && <TrendIcon size={12} />}
              {delta}
            </span>
          )}
        </div>
        <div className="label-technical text-text-muted">
          {label}
        </div>
        {sublabel && (
          <div className="text-xs text-text-muted">{sublabel}</div>
        )}
      </div>
    );
  },
);

MonoMetric.displayName = 'MonoMetric';
