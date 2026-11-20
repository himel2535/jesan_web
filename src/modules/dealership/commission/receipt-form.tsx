'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useErrorMessage } from '@/core/api/field-errors';
import { businessToday } from '@/core/i18n/format';
import { MONEY_PATTERN, cleanMoneyInput } from '@/core/lib/money';
import { Button } from '@/core/ui/button';
import { Modal } from '@/core/ui/modal';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { TextInput } from '../master-data/shared/fields';
import { FormError } from '../master-data/shared/states';
import { useCreateReceipt, usePatchReceipt } from './api';
import {
  COMMISSION_LIMITS,
  type CommissionReceipt,
  type ReceiptInput,
  type ReceiptPatch,
} from './types';

const FIELDS = ['amount', 'receivedDate', 'reference', 'note'] as const;
type Errors = Partial<Record<(typeof FIELDS)[number], string>>;

/** Create or edit a receipt of money received from Akij for one commission entry. */
export function ReceiptForm({
  entryId,
  receipt,
  onClose,
  onSaved,
  slug,
  businessId,
}: {
  entryId: string;
  receipt: CommissionReceipt | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  slug: string;
  businessId: string;
}) {
  const t = useTranslations('dealership.commission.receipt');
  const tc = useTranslations('dealership.common');
  const errorMessage = useErrorMessage();
  const id = useId();
  const today = businessToday();
  const create = useCreateReceipt(slug, businessId);
  const patch = usePatchReceipt(slug, businessId);
  const [amount, setAmount] = useState(receipt?.amount ?? '');
  const [receivedDate, setReceivedDate] = useState(receipt?.receivedDate ?? today);
  const [reference, setReference] = useState(receipt?.reference ?? '');
  const [note, setNote] = useState(receipt?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const cleanAmount = cleanMoneyInput(amount);
    const found: Errors = {};
    if (!MONEY_PATTERN.test(cleanAmount) || Number(cleanAmount) <= 0) {
      found.amount = t('amountInvalid');
    }
    if (!receivedDate) found.receivedDate = tc('required');
    if (receivedDate && receivedDate > today) found.receivedDate = t('dateFutureInvalid');
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    inFlight.current = true;
    try {
      if (receipt) {
        const body: ReceiptPatch = {};
        if (cleanAmount !== receipt.amount) body.amount = cleanAmount;
        if (receivedDate !== receipt.receivedDate) body.receivedDate = receivedDate;
        if (reference.trim() !== (receipt.reference ?? '')) body.reference = reference.trim();
        if (note.trim() !== (receipt.note ?? '')) body.note = note.trim();
        if (Object.keys(body).length === 0) {
          setFormError(tc('nothingToChange'));
          return;
        }
        await patch.mutateAsync({ entryId, id: receipt.id, patch: body });
        onSaved(tc('saved'));
      } else {
        const input: ReceiptInput = { amount: cleanAmount, receivedDate };
        if (reference.trim()) input.reference = reference.trim();
        if (note.trim()) input.note = note.trim();
        await create.mutateAsync({ entryId, input });
        onSaved(tc('created'));
      }
      onClose();
    } catch (error) {
      const split = errorMessage.split(error, FIELDS);
      setErrors(split.fields);
      setFormError(split.form);
    } finally {
      inFlight.current = false;
    }
  };

  const fid = (key: string) => `${id}-${key}`;
  const pending = create.isPending || patch.isPending;

  return (
    <Modal
      open
      onClose={() => (pending ? undefined : onClose())}
      title={receipt ? t('editTitle') : t('newTitle')}
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={formError} />
        <Field id={fid('amount')} label={t('amount')} error={errors.amount}>
          <input
            id={fid('amount')}
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={Boolean(errors.amount) || undefined}
            aria-describedby={describedBy(fid('amount'), { error: Boolean(errors.amount) })}
            className={inputClass}
          />
        </Field>
        <Field id={fid('date')} label={t('receivedDate')} error={errors.receivedDate}>
          <input
            id={fid('date')}
            type="date"
            required
            max={today}
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            aria-invalid={Boolean(errors.receivedDate) || undefined}
            aria-describedby={describedBy(fid('date'), { error: Boolean(errors.receivedDate) })}
            className={inputClass}
          />
        </Field>
        <TextInput
          id={fid('reference')}
          label={t('reference')}
          value={reference}
          onChange={setReference}
          error={errors.reference}
          maxLength={COMMISSION_LIMITS.reference}
        />
        <TextInput
          id={fid('note')}
          label={t('note')}
          value={note}
          onChange={setNote}
          error={errors.note}
          maxLength={COMMISSION_LIMITS.note}
        />
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? tc('saving') : receipt ? tc('save') : tc('create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
