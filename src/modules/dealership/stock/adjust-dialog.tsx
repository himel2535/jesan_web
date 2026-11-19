'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChangeRequestDialog } from '@/core/approvals/request-dialog';
import { ApiError } from '@/core/api/errors';
import { useErrorMessage } from '@/core/api/field-errors';
import { useCan } from '@/core/auth/can';
import { useFormat } from '@/core/i18n/use-format';
import { signedQuantity } from '@/core/lib/quantity';
import { Button } from '@/core/ui/button';
import { cn } from '@/core/ui/cn';
import { Modal } from '@/core/ui/modal';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { FormError } from '../master-data/shared/states';
import { useStockInsufficientMessage } from '../purchases/stock-error';
import { useAdjustStock } from './api';

export interface AdjustTarget {
  productId: string;
  name: string;
  currentStock: string;
  decimals: number;
}

const REASON_MIN = 3;
const REASON_MAX = 500;

/**
 * Stock adjustment (`stock.adjust`): a signed quantity and a required reason. Above the user's
 * daily limit the API answers 403 ADJUSTMENT_APPROVAL_REQUIRED (`details.limit`, `usedToday`);
 * then, with `change.request`, the same quantity and reason go to the owner as a
 * `product_stock` request (`adjustBy`). Only `stock` refreshes after a direct adjustment.
 */
export function AdjustStockDialog({
  slug,
  businessId,
  target,
  onClose,
  onDone,
}: {
  slug: string;
  businessId: string;
  target: AdjustTarget;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.stock.adjustDialog');
  const id = useId();
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const stockMessage = useStockInsufficientMessage();
  const canRequest = useCan('change.request');
  const adjust = useAdjustStock(slug, businessId);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ quantity?: string; reason?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [overLimit, setOverLimit] = useState<{ limit: string; used: string } | null>(null);
  const [requesting, setRequesting] = useState(false);
  const inFlight = useRef(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const qty = signedQuantity(quantity, target.decimals);
    const r = reason.trim();
    const found: typeof errors = {};
    if (!qty) found.quantity = t('quantityInvalid');
    if (r.length < REASON_MIN || r.length > REASON_MAX) found.reason = t('reasonRequired');
    setErrors(found);
    setFormError(null);
    setOverLimit(null);
    if (!qty || Object.keys(found).length) return;
    inFlight.current = true;
    try {
      await adjust.mutateAsync({ productId: target.productId, quantity: qty, reason: r });
      onDone(t('done'));
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'ADJUSTMENT_APPROVAL_REQUIRED') {
        const d = (cause.body?.details ?? {}) as { limit?: unknown; usedToday?: unknown };
        setOverLimit({
          limit: typeof d.limit === 'string' ? format.quantity(d.limit) : '—',
          used: typeof d.usedToday === 'string' ? format.quantity(d.usedToday) : '—',
        });
      } else {
        const split = errorMessage.split(cause, ['quantity', 'reason'] as const);
        const stock = stockMessage(cause);
        setErrors(stock ? { ...split.fields, quantity: stock } : split.fields);
        setFormError(stock ? null : split.form);
      }
    } finally {
      inFlight.current = false;
    }
  };

  const fid = (key: string) => `${id}-${key}`;
  if (requesting) {
    // Hand the same quantity and reason to the owner as a product_stock request.
    return createPortal(
      <ChangeRequestDialog
        slug={slug}
        target={{
          entityType: 'product_stock',
          entityId: target.productId,
          name: target.name,
          fields: [
            {
              key: 'adjustBy',
              type: 'signedQuantity',
              current: null,
              decimals: target.decimals,
            },
          ],
          initial: {
            chosen: ['adjustBy'],
            values: { adjustBy: signedQuantity(quantity, target.decimals) ?? quantity },
            reason,
          },
        }}
        onClose={onClose}
        onSent={onDone}
      />,
      document.body,
    );
  }

  return (
    <Modal
      open
      onClose={() => (adjust.isPending ? undefined : onClose())}
      title={t('title', { name: target.name })}
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-fg-muted">{t('intro')}</p>
        <FormError message={formError} />
        {overLimit ? (
          <div
            role="alert"
            className="space-y-2 rounded-lg border border-warning px-3 py-2 text-sm"
          >
            <p>{t('overLimit', overLimit)}</p>
            {canRequest ? (
              <Button variant="secondary" onClick={() => setRequesting(true)}>
                {t('sendForApproval')}
              </Button>
            ) : (
              <p className="text-fg-muted">{t('noRequest')}</p>
            )}
          </div>
        ) : null}
        <Field
          id={fid('quantity')}
          label={t('quantity')}
          hint={t('quantityHint', { quantity: format.quantity(target.currentStock) })}
          error={errors.quantity}
        >
          <input
            id={fid('quantity')}
            inputMode="text"
            autoComplete="off"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-invalid={Boolean(errors.quantity) || undefined}
            aria-describedby={describedBy(fid('quantity'), {
              hint: true,
              error: Boolean(errors.quantity),
            })}
            className={inputClass}
          />
        </Field>
        <Field id={fid('reason')} label={t('reason')} hint={t('reasonHint')} error={errors.reason}>
          <textarea
            id={fid('reason')}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={Boolean(errors.reason) || undefined}
            aria-describedby={describedBy(fid('reason'), {
              hint: true,
              error: Boolean(errors.reason),
            })}
            className={cn(inputClass, 'min-h-24 py-2')}
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={adjust.isPending}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={adjust.isPending} aria-busy={adjust.isPending}>
            {adjust.isPending ? t('saving') : t('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
