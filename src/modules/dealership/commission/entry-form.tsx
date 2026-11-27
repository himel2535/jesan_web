'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import { newIdempotencyKey } from '@/core/approvals/api';
import { useErrorMessage } from '@/core/api/field-errors';
import { businessToday } from '@/core/i18n/format';
import { MONEY_PATTERN, cleanMoneyInput, sameMoney } from '@/core/lib/money';
import { Button } from '@/core/ui/button';
import { Modal } from '@/core/ui/modal';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { MoneyInput, TextInput } from '../master-data/shared/fields';
import { FormError } from '../master-data/shared/states';
import { useCreateEntry, usePatchEntry } from './api';
import { COMMISSION_LIMITS, type CommissionEntry, type EntryPatch } from './types';

const FIELDS = ['amount', 'receivedDate', 'note'] as const;
type Errors = Partial<Record<(typeof FIELDS)[number], string>>;

/**
 * Record (or correct) commission received: how much, when, and why. Nothing is calculated; the
 * owner types the number. `commission.manage`, owner-only.
 */
export function EntryForm({
  entry,
  onClose,
  onSaved,
  slug,
  businessId,
}: {
  entry: CommissionEntry | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  slug: string;
  businessId: string;
}) {
  const t = useTranslations('dealership.commission.entry');
  const tc = useTranslations('dealership.common');
  const errorMessage = useErrorMessage();
  const id = useId();
  const today = businessToday();
  const create = useCreateEntry(slug, businessId);
  const patch = usePatchEntry(slug, businessId);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [amount, setAmount] = useState(entry?.amount ?? '');
  const [receivedDate, setReceivedDate] = useState(entry?.receivedDate ?? today);
  const [note, setNote] = useState(entry?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const cleanAmount = cleanMoneyInput(amount);
    const cleanNote = note.trim();
    const found: Errors = {};
    if (!MONEY_PATTERN.test(cleanAmount) || !/[1-9]/.test(cleanAmount)) {
      found.amount = t('amountInvalid');
    }
    if (!receivedDate) found.receivedDate = tc('required');
    else if (receivedDate > today) found.receivedDate = t('dateFutureInvalid');
    if (!cleanNote) found.note = t('noteRequired');
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    inFlight.current = true;
    try {
      if (entry) {
        const body: EntryPatch = {};
        if (!sameMoney(cleanAmount, entry.amount)) body.amount = cleanAmount;
        if (receivedDate !== entry.receivedDate) body.receivedDate = receivedDate;
        if (cleanNote !== (entry.note ?? '')) body.note = cleanNote;
        if (Object.keys(body).length === 0) {
          setFormError(tc('nothingToChange'));
          return;
        }
        await patch.mutateAsync({ id: entry.id, patch: body });
        onSaved(tc('saved'));
      } else {
        await create.mutateAsync({
          input: { amount: cleanAmount, receivedDate, note: cleanNote },
          idempotencyKey,
        });
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
      title={entry ? t('editTitle') : t('newTitle')}
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={formError} />
        <MoneyInput
          id={fid('amount')}
          label={t('amount')}
          value={amount}
          onChange={setAmount}
          error={errors.amount}
          required
        />
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
          id={fid('note')}
          label={t('note')}
          hint={t('noteHint')}
          value={note}
          onChange={setNote}
          error={errors.note}
          maxLength={COMMISSION_LIMITS.note}
          required
        />
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? tc('saving') : entry ? tc('save') : tc('create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
