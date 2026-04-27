/**
 * ConfirmDialog — Lightweight confirm dialog (e.g. destructive deletes).
 *
 * Built on Radix Dialog primitives.
 */

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual tone of the confirm button. */
  tone?: 'default' | 'danger';
  onConfirm: () => void | Promise<void>;
  /** Disable confirm while async action runs. */
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  tone = 'default',
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const [busy, setBusy] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }, [onConfirm]);

  const isBusy = busy || loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {tone === 'danger' && (
              <div className="w-9 h-9 rounded-full bg-[color:var(--danger-muted,rgba(248,113,113,0.12))] text-[color:var(--danger-500,#F87171)] flex items-center justify-center shrink-0">
                <AlertTriangle size={18} aria-hidden />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isBusy}
            className={cn(
              tone === 'danger' &&
                'bg-[color:var(--danger-500,#F87171)] text-white hover:bg-[color:var(--danger-500,#F87171)]/90',
            )}
          >
            {isBusy ? 'Bitte warten…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
