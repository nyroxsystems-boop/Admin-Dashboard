/**
 * OEMNumber — Formatierte OEM-Nummer in Monospace mit Copy-Funktion.
 *
 * OEM-Nummern (z.B. 34116761252) sind kritische Daten im Teilehandel.
 * Immer monospace, immer copy-fähig, immer identisch gerendert.
 *
 * Stream: A — Design System
 *
 * @example
 * <OEMNumber value="34116761252" />
 * <OEMNumber value="06A115561B" copyable onCrossRefClick={openDrawer} />
 */

import { forwardRef, useCallback, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OEMNumberProps {
  value: string;
  /** Formatiert lange Nummern mit Leerzeichen-Gruppen (z.B. "341 167 612 52") */
  grouped?: boolean;
  /** Zeigt Copy-Button am Ende */
  copyable?: boolean;
  /** Klick öffnet Cross-Reference-Drawer */
  onCrossRefClick?: (oem: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function formatOEM(value: string, grouped: boolean): string {
  if (!grouped) return value;
  // Gruppe à 3 Zeichen, rückwärts
  const reversed = value.split('').reverse().join('');
  const groups = reversed.match(/.{1,3}/g) ?? [];
  return groups.map((g) => g.split('').reverse().join('')).reverse().join(' ');
}

const SIZE_CLASSES: Record<NonNullable<OEMNumberProps['size']>, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export const OEMNumber = forwardRef<HTMLSpanElement, OEMNumberProps>(
  ({ value, grouped = false, copyable = false, onCrossRefClick, size = 'md', className }, ref) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // fail silently — Clipboard kann in iframes blockiert sein
      }
    }, [value]);

    const isInteractive = !!onCrossRefClick;

    const Wrapper = isInteractive ? 'button' : 'span';

    return (
      <Wrapper
        ref={ref as never}
        type={isInteractive ? 'button' : undefined}
        onClick={isInteractive ? () => onCrossRefClick?.(value) : undefined}
        className={cn(
          'inline-flex items-center gap-2 font-mono tabular-nums',
          SIZE_CLASSES[size],
          isInteractive && 'hover:text-accent-400 cursor-pointer transition-colors',
          className,
        )}
        aria-label={`OEM-Nummer ${value}`}
      >
        <span>{formatOEM(value, grouped)}</span>
        {copyable && (
          <button
            type="button"
            onClick={handleCopy}
            className="text-text-muted hover:text-text-primary transition-colors"
            aria-label={copied ? 'Kopiert' : 'OEM-Nummer kopieren'}
          >
            {copied ? (
              <Check size={14} className="text-status-success" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        )}
      </Wrapper>
    );
  },
);

OEMNumber.displayName = 'OEMNumber';
