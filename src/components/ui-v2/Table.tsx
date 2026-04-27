/**
 * Table — Dichte Datentabelle im Bloomberg-Stil.
 *
 * Stream: A — Skelett. Agentur: Virtualized-Support für 1000+ Rows.
 *
 * TODO:
 *  - Sortable columns (click on header)
 *  - Sticky-Header beim Scroll
 *  - Row-Selection mit Checkbox-Column
 *  - Inline-Edit (double-click) — Pattern für Stream C
 *  - Virtualization mit @tanstack/react-virtual für große Listen
 */

import { forwardRef, type HTMLAttributes, type TableHTMLAttributes, type ThHTMLAttributes, type TdHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  dense?: boolean;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ dense, className, ...rest }, ref) => (
    <div className="overflow-x-auto rounded-md border border-border-subtle">
      <table
        ref={ref}
        className={cn(
          'w-full border-collapse',
          dense ? 'text-xs' : 'text-sm',
          className,
        )}
        {...rest}
      />
    </div>
  ),
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...rest }, ref) => (
    <thead
      ref={ref}
      className={cn('bg-elevated label-technical text-text-muted', className)}
      {...rest}
    />
  ),
);
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...rest }, ref) => (
    <tbody ref={ref} className={cn('divide-y divide-border-subtle', className)} {...rest} />
  ),
);
TableBody.displayName = 'TableBody';

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
}
export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ selected, className, ...rest }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'hover:bg-elevated transition-colors duration-fast',
        selected && 'bg-accent-500/10',
        className,
      )}
      {...rest}
    />
  ),
);
TableRow.displayName = 'TableRow';

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center';
  monospace?: boolean;
}
export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ align = 'left', monospace, className, ...rest }, ref) => (
    <td
      ref={ref}
      className={cn(
        'px-3 py-2.5',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        monospace && 'font-mono tabular-nums',
        className,
      )}
      {...rest}
    />
  ),
);
TableCell.displayName = 'TableCell';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...rest }, ref) => (
    <th
      ref={ref}
      className={cn('px-3 py-2 text-left font-medium', className)}
      {...rest}
    />
  ),
);
TableHead.displayName = 'TableHead';
