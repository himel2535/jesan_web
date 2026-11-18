'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { useErrorMessage } from '@/core/api/field-errors';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';
import { ReasonInput, reasonError } from './fields';

/** Deactivate/activate with the required reason (owner-level; `*.deactivate` permission). */
export function DeactivateDialog({
  open,
  name,
  currentlyActive,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  name: string;
  currentlyActive: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const t = useTranslations('dealership.common');
  const id = useId();
  const [reason, setReason] = useState('');
  const [showReasonError, setShowReasonError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonServerError, setReasonServerError] = useState<string | null>(null);
  const errorMessage = useErrorMessage();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const close = () => {
    setReason('');
    setShowReasonError(false);
    setError(null);
    setReasonServerError(null);
    onCancel();
  };

  const confirm = async () => {
    if (inFlight.current) return;
    if (reasonError(reason)) return setShowReasonError(true);
    inFlight.current = true;
    setPending(true);
    setError(null);
    setReasonServerError(null);
    try {
      await onConfirm(reason.trim());
      setReason('');
      setShowReasonError(false);
    } catch (cause) {
      const split = errorMessage.split(cause, ['reason'] as const);
      setReasonServerError(split.fields.reason ?? null);
      setError(split.form);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title={currentlyActive ? t('deactivateTitle', { name }) : t('activateTitle', { name })}
      confirmLabel={currentlyActive ? t('deactivate') : t('activate')}
      cancelLabel={t('cancel')}
      danger={currentlyActive}
      pending={pending}
      pendingLabel={t('saving')}
      error={error}
      onCancel={close}
      onConfirm={() => void confirm()}
    >
      <div className="space-y-4">
        <p>{currentlyActive ? t('deactivateBody') : t('activateBody')}</p>
        <ReasonInput
          id={`${id}-reason`}
          value={reason}
          onChange={setReason}
          error={
            showReasonError && reasonError(reason)
              ? t('reasonRequired')
              : (reasonServerError ?? undefined)
          }
        />
      </div>
    </ConfirmDialog>
  );
}
