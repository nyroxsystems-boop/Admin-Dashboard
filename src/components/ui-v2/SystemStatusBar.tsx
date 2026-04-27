/**
 * SystemStatusBar — Live-Terminal-Leiste oben auf einer Workspace-View.
 *
 * Zeigt Uhrzeit und OPTIONAL weitere Channel-Status-Indikatoren + Right-Stats.
 *
 * Strenge Regel: es gibt keine Default-Channels. Jeder Channel muss vom
 * Caller aus echten Backend-Daten zusammengestellt werden. Diese Komponente
 * erfindet keine Status.
 */

import { type ReactNode } from 'react';
import { StatusLED, type StatusLEDStatus } from './StatusLED';
import { LiveClock } from './LiveClock';
import { cn } from '@/lib/utils';

export interface SystemChannel {
  key: string;
  label: string;
  status: StatusLEDStatus;
  /** Kurze Zusatz-Info (Mono), z.B. "LIVE", "SYNC 08:41", "42 QUEUE". Optional. */
  detail?: string;
  pulse?: boolean;
}

export interface SystemStatusBarProps {
  /** Channels aus echten Backend-Daten. Leer/undefined → nichts angezeigt. */
  channels?: SystemChannel[];
  /** Rechts zeigbare Quick-Stats, z.B. Zählerblock aus echten Stats. */
  stats?: ReactNode;
  className?: string;
}

export function SystemStatusBar({
  channels,
  stats,
  className,
}: SystemStatusBarProps) {
  const hasChannels = channels && channels.length > 0;

  return (
    <div
      role="status"
      aria-label="System-Status"
      className={cn(
        'flex items-center gap-5 h-8 px-4',
        'bg-surface border-b border-border-subtle',
        'text-[11px]',
        className,
      )}
    >
      <LiveClock showDate layout="inline" className="text-[11px]" />

      {hasChannels && (
        <>
          <div aria-hidden="true" className="w-px h-3 bg-border-subtle" />
          <div className="flex items-center gap-4 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {channels!.map((ch) => (
              <div key={ch.key} className="flex items-center gap-1.5 shrink-0">
                <StatusLED status={ch.status} size="sm" pulse={!!ch.pulse} />
                <span className="label-technical text-[10px] text-text-muted">{ch.label}</span>
                {ch.detail && (
                  <span className="font-mono tabular-nums text-[10px] text-text-secondary ml-0.5">
                    {ch.detail}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex-1" />

      {stats && (
        <div className="flex items-center gap-4 shrink-0 font-mono tabular-nums text-[11px] text-text-secondary">
          {stats}
        </div>
      )}
    </div>
  );
}

export default SystemStatusBar;
