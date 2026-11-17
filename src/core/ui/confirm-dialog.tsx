'use client';

import type { ReactNode } from 'react';
import { Button } from './button';
import { Modal } from './modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Red confirm button for risky actions. */
  danger?: boolean;
  /** While the action runs: the confirm button is disabled (no double submit). */
  pending?: boolean;
  pendingLabel?: string;
  /** Translated error to show inside the dialog. */
  error?: string | null;
}

/** "Are you sure?" for risky actions (remove access, deactivate, reset, leave unsaved). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
  pending = false,
  pendingLabel,
  error,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={() => (pending ? undefined : onCancel())} title={title}>
      <div className="space-y-4">
        <div className="text-sm text-fg">{children}</div>
        <div role="alert">
          {error ? (
            <p className="rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
          >
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
