'use client';

import { useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { newIdempotencyKey } from '@/core/approvals/api';
import { ApiError } from '@/core/api/errors';
import { useErrorMessage } from '@/core/api/field-errors';
import { businessToday } from '@/core/i18n/format';
import { MONEY_PATTERN, cleanMoneyInput } from '@/core/lib/money';
import { Button } from '@/core/ui/button';
import { cn } from '@/core/ui/cn';
import { Modal } from '@/core/ui/modal';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { FormError } from '../master-data/shared/states';
import { useCollectionMethods, useCreateSupplierPayment } from './api';
import { useMethodLabel } from './shared';
import { ACCOUNTS_LIMITS, type SupplierPaymentInput } from './types';

const FIELDS = ['amount', 'method', 'paymentDate', 'note'] as const;

export function SupplierPaymentDialog({
  slug,
  businessId,
  onClose,
  onDone,
}: {
  slug: string;
  businessId: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.accounts.payment');
  const tc = useTranslations('dealership.common');
  const errorMessage = useErrorMessage();
  const id = useId();
  const today = useMemo(() => businessToday(), []);
  const methodLabel = useMethodLabel();
  const methods = useCollectionMethods(slug, businessId);
  const mutation = useCreateSupplierPayment(slug, businessId);
  const [idempotencyKey] = useState(newIdempotencyKey);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Partial<Record<(typeof FIELDS)[number], string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;

    const cleanAmount = cleanMoneyInput(amount);
    const found: typeof errors = {};
    if (!cleanAmount || !MONEY_PATTERN.test(cleanAmount) || !/[1-9]/.test(cleanAmount)) {
      found.amount = t('amount') + ' ✗';
    }
    if (!method) found.method = t('method') + ' ✗';
    if (!paymentDate) found.paymentDate = t('paymentDate') + ' ✗';
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    const input: SupplierPaymentInput = {
      amount: cleanAmount!,
      method,
      paymentDate,
    };
    const trimNote = note.trim();
    if (trimNote) input.note = trimNote;

    inFlight.current = true;
    try {
      await mutation.mutateAsync({ input, idempotencyKey });
      onDone(t('title'));
    } catch (cause) {
      if (cause instanceof ApiError) {
        const split = errorMessage.split(cause, FIELDS);
        setErrors(split.fields);
        setFormError(split.form);
      } else {
        setFormError(errorMessage.message(cause));
      }
    } finally {
      inFlight.current = false;
    }
  };

  const fid = (key: string) => `${id}-${key}`;

  return (
    <Modal open onClose={() => (mutation.isPending ? undefined : onClose())} title={t('title')}>
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={formError} />

        <Field id={fid('amount')} label={t('amount')} error={errors.amount}>
          <input
            id={fid('amount')}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={Boolean(errors.amount) || undefined}
            aria-describedby={describedBy(fid('amount'), { error: Boolean(errors.amount) })}
            className={inputClass}
          />
        </Field>

        <Field id={fid('method')} label={t('method')} error={errors.method}>
          <select
            id={fid('method')}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            aria-invalid={Boolean(errors.method) || undefined}
            aria-describedby={describedBy(fid('method'), { error: Boolean(errors.method) })}
            className={inputClass}
          >
            <option value="">{t('method')}</option>
            {methods.data?.map((m) => (
              <option key={m} value={m}>
                {methodLabel(m)}
              </option>
            ))}
          </select>
        </Field>

        <Field id={fid('paymentDate')} label={t('paymentDate')} error={errors.paymentDate}>
          <input
            id={fid('paymentDate')}
            type="date"
            value={paymentDate}
            max={today}
            onChange={(e) => setPaymentDate(e.target.value)}
            aria-invalid={Boolean(errors.paymentDate) || undefined}
            aria-describedby={describedBy(fid('paymentDate'), {
              error: Boolean(errors.paymentDate),
            })}
            className={inputClass}
          />
        </Field>

        <Field id={fid('note')} label={t('note')} hint={t('noteOptional')} error={errors.note}>
          <textarea
            id={fid('note')}
            rows={3}
            maxLength={ACCOUNTS_LIMITS.note}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={Boolean(errors.note) || undefined}
            aria-describedby={describedBy(fid('note'), {
              hint: true,
              error: Boolean(errors.note),
            })}
            className={cn(inputClass, 'min-h-24 py-2')}
          />
        </Field>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending} aria-busy={mutation.isPending}>
            {mutation.isPending ? t('submitting') : t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
