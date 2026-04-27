/**
 * LiveClock — Monospace-Digital-Uhr, tickt im Sekundentakt.
 *
 * Bloomberg-/Trading-Terminal-Signal. Für Teilehändler, die nach
 * Lieferantenannahmeschluss arbeiten, ist die Uhrzeit kritisch.
 *
 * @example
 * <LiveClock />
 * <LiveClock showSeconds={false} showDate />
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface LiveClockProps {
  /** Default: true — zeigt ":SS" */
  showSeconds?: boolean;
  /** Default: false — zeigt "DO 17.04" über/neben der Uhrzeit */
  showDate?: boolean;
  /** Layout: inline (eine Zeile) oder stacked (Datum über Zeit) */
  layout?: 'inline' | 'stacked';
  className?: string;
}

function pad(n: number) { return n.toString().padStart(2, '0'); }

const WEEKDAY = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];

export function LiveClock({
  showSeconds = true,
  showDate = false,
  layout = 'inline',
  className,
}: LiveClockProps) {
  const [now, setNow] = useState(() => new Date());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Align tick to next whole second, then tick every 1000ms.
    const ms = 1000 - (Date.now() % 1000);
    timeoutRef.current = setTimeout(() => {
      setNow(new Date());
      intervalRef.current = setInterval(() => setNow(new Date()), 1000);
    }, ms);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}${showSeconds ? `:${pad(now.getSeconds())}` : ''}`;
  const date = `${WEEKDAY[now.getDay()]} ${pad(now.getDate())}.${pad(now.getMonth() + 1)}`;

  if (!showDate) {
    return (
      <span
        className={cn(
          'font-mono tabular-nums text-text-primary',
          className,
        )}
        aria-label={`Uhrzeit ${time}`}
      >
        {time}
      </span>
    );
  }

  if (layout === 'stacked') {
    return (
      <div className={cn('flex flex-col items-end leading-none', className)}>
        <span className="font-mono tabular-nums text-text-primary">{time}</span>
        <span className="label-technical text-[10px] text-text-muted mt-0.5">{date}</span>
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-baseline gap-2', className)}>
      <span className="label-technical text-[10px] text-text-muted">{date}</span>
      <span className="font-mono tabular-nums text-text-primary">{time}</span>
    </div>
  );
}

export default LiveClock;
