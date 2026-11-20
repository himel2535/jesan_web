'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import { newIdempotencyKey } from '@/core/approvals/api';
import { useErrorMessage } from '@/core/api/field-errors';
import { businessToday } from '@/core/i18n/format';
import { useFormat } from '@/core/i18n/use-format';
import { multiplyMoney, sumMoney } from '@/core/lib/money';
import { cleanQuantityInput, isPositiveQuantity } from '@/core/lib/quantity';
import { Button } from '@/core/ui/button';
import { Modal } from '@/core/ui/modal';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { cn } from '@/core/ui/cn';
import { TextInput } from '../master-data/shared/fields';
import { FormError } from '../master-data/shared/states';
import { useCommissionSuggestion, useCreateEntry, usePatchEntry } from './api';
import {
  COMMISSION_LIMITS,
  type CommissionEntryDetail,
  type CommissionScheme,
  type EntryInput,
  type EntryPatch,
} from './types';

const FIELDS = ['fromDate', 'toDate', 'quantity', 'note'] as const;
type Errors = Partial<Record<(typeof FIELDS)[number], string>>;

/** quantity − targetQty, clamped to 0, for the bonus preview only (both are 0–3 decimal strings). */
function extraOverTarget(quantity: string, targetQty: string): string {
  const scale = 3;
  const toUnits = (v: string) => {
    const [int = '0', frac = ''] = v.trim().split('.');
    return BigInt(`${int || '0'}${frac.padEnd(scale, '0').slice(0, scale)}`);
  };
  const diff = toUnits(quantity) - toUnits(targetQty);
  if (diff <= 0n) return '0';
  const s = diff.toString().padStart(scale + 1, '0');
  const int = s.slice(0, -scale);
  const frac = s.slice(-scale).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

/**
 * Create or edit a commission entry (`commission.manage`, owner-only). The preview below is
 * display only, computed the same way as jesan-api (base + bonus over target, half-up to 2
 * decimals) — the real `calculatedAmount` always comes from the server.
 */
export function EntryForm({
  entry,
  scheme,
  unitName,
  onClose,
  onSaved,
  slug,
  businessId,
}: {
  entry: CommissionEntryDetail | null;
  scheme: CommissionScheme | null;
  unitName: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  slug: string;
  businessId: string;
}) {
  const t = useTranslations('dealership.commission.entry');
  const tc = useTranslations('dealership.common');
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const id = useId();
  const today = businessToday();
  const create = useCreateEntry(slug, businessId);
  const patch = usePatchEntry(slug, businessId);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [fromDate, setFromDate] = useState(entry?.fromDate ?? '');
  const [toDate, setToDate] = useState(entry?.toDate ?? '');
  const [quantity, setQuantity] = useState(entry?.quantity ?? '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const dateRangeOk = Boolean(fromDate && toDate && fromDate <= toDate);
  const suggestion = useCommissionSuggestion(
    slug,
    businessId,
    dateRangeOk ? fromDate : undefined,
    dateRangeOk ? toDate : undefined,
  );

  const cleanQty = cleanQuantityInput(quantity);
  const validQty = isPositiveQuantity(cleanQty, 3);
  const base = scheme && validQty ? multiplyMoney(cleanQty, scheme.rateBase) : null;
  const extra = scheme && validQty ? extraOverTarget(cleanQty, scheme.targetQty) : '0';
  const hasBonus = extra !== '0';
  const bonus = scheme && hasBonus ? multiplyMoney(extra, scheme.bonusRate) : null;
  const total =
    base !== null ? sumMoney(hasBonus && bonus !== null ? [base, bonus] : [base]) : null;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found: Errors = {};
    if (!fromDate) found.fromDate = tc('required');
    if (!toDate) found.toDate = tc('required');
    if (fromDate && toDate && fromDate > toDate) found.toDate = t('dateRangeInvalid');
    if (toDate && toDate > today) found.toDate = t('dateFutureInvalid');
    if (!validQty) found.quantity = t('quantityInvalid');
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    inFlight.current = true;
    try {
      if (entry) {
        const body: EntryPatch = {};
        if (fromDate !== entry.fromDate) body.fromDate = fromDate;
        if (toDate !== entry.toDate) body.toDate = toDate;
        if (cleanQty !== entry.quantity) body.quantity = cleanQty;
        if (note.trim() !== (entry.note ?? '')) body.note = note.trim();
        if (Object.keys(body).length === 0) {
          setFormError(tc('nothingToChange'));
          return;
        }
        await patch.mutateAsync({ id: entry.id, patch: body });
        onSaved(tc('saved'));
      } else {
        const input: EntryInput = { fromDate, toDate, quantity: cleanQty };
        if (note.trim()) input.note = note.trim();
        await create.mutateAsync({ input, idempotencyKey });
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
        {!scheme ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {t('schemeNotSet')}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={fid('from')} label={t('fromDate')} error={errors.fromDate}>
            <input
              id={fid('from')}
              type="date"
              required
              max={toDate || undefined}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-invalid={Boolean(errors.fromDate) || undefined}
              aria-describedby={describedBy(fid('from'), { error: Boolean(errors.fromDate) })}
              className={inputClass}
            />
          </Field>
          <Field id={fid('to')} label={t('toDate')} error={errors.toDate}>
            <input
              id={fid('to')}
              type="date"
              required
              min={fromDate || undefined}
              max={today}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-invalid={Boolean(errors.toDate) || undefined}
              aria-describedby={describedBy(fid('to'), { error: Boolean(errors.toDate) })}
              className={inputClass}
            />
          </Field>
        </div>

        {dateRangeOk && suggestion.data ? (
          <p className="rounded-lg border border-border px-3 py-2 text-sm">
            {t('suggestion', {
              quantity: format.quantity(suggestion.data.quantity),
              unit: unitName,
            })}{' '}
            <button
              type="button"
              onClick={() => setQuantity(suggestion.data!.quantity)}
              className="font-medium underline"
            >
              {t('useSuggestion')}
            </button>
          </p>
        ) : null}

        <Field
          id={fid('quantity')}
          label={t('quantity', { unit: unitName })}
          error={errors.quantity}
        >
          <input
            id={fid('quantity')}
            inputMode="decimal"
            autoComplete="off"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-invalid={Boolean(errors.quantity) || undefined}
            aria-describedby={describedBy(fid('quantity'), { error: Boolean(errors.quantity) })}
            className={inputClass}
          />
        </Field>

        {scheme && validQty ? (
          <dl
            aria-live="polite"
            className="space-y-1 rounded-card border border-border bg-surface p-4 text-sm"
          >
            <p className="font-medium">{t('preview.title')}</p>
            {base !== null ? (
              <p className={cn('tabular-nums')}>
                {t('preview.base', {
                  qty: format.quantity(cleanQty),
                  unit: unitName,
                  rate: format.money(scheme.rateBase),
                  amount: format.money(base),
                })}
              </p>
            ) : null}
            {hasBonus && bonus !== null ? (
              <p className="tabular-nums">
                {t('preview.bonus', {
                  extra: format.quantity(extra),
                  unit: unitName,
                  rate: format.money(scheme.bonusRate),
                  amount: format.money(bonus),
                })}
              </p>
            ) : null}
            {total !== null ? (
              <p className="text-base font-semibold tabular-nums">
                {t('preview.total', { amount: format.money(total) })}
              </p>
            ) : null}
          </dl>
        ) : null}

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
          <Button type="submit" disabled={pending || !scheme} aria-busy={pending}>
            {pending ? tc('saving') : entry ? tc('save') : tc('create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
