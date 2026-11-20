'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useErrorMessage } from '@/core/api/field-errors';
import { MONEY_PATTERN, cleanMoneyInput } from '@/core/lib/money';
import { cleanQuantityInput, isPositiveQuantity } from '@/core/lib/quantity';
import { Button } from '@/core/ui/button';
import { Modal } from '@/core/ui/modal';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { FormError } from '../master-data/shared/states';
import { useUpsertScheme } from './api';
import type { CommissionScheme, SchemeInput } from './types';

const FIELDS = ['rateBase', 'targetQty', 'bonusRate'] as const;
type Errors = Partial<Record<(typeof FIELDS)[number], string>>;

/**
 * Upsert the commission scheme (`commission.manage`, owner-only). No scheme snapshot is kept:
 * past entries keep their already-calculated amount; only new/edited entries use this scheme.
 */
export function SchemeForm({
  scheme,
  unitName,
  onClose,
  onSaved,
  slug,
  businessId,
}: {
  scheme: CommissionScheme | null;
  unitName: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  slug: string;
  businessId: string;
}) {
  const t = useTranslations('dealership.commission.scheme');
  const tc = useTranslations('dealership.common');
  const errorMessage = useErrorMessage();
  const id = useId();
  const upsert = useUpsertScheme(slug, businessId);
  const [rateBase, setRateBase] = useState(scheme?.rateBase ?? '');
  const [targetQty, setTargetQty] = useState(scheme?.targetQty ?? '');
  const [bonusRate, setBonusRate] = useState(scheme?.bonusRate ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const rate = cleanMoneyInput(rateBase);
    const target = cleanQuantityInput(targetQty);
    const bonus = cleanMoneyInput(bonusRate);
    const found: Errors = {};
    if (!MONEY_PATTERN.test(rate) || rate === '0' || Number(rate) <= 0) {
      found.rateBase = t('rateBaseInvalid');
    }
    if (!isPositiveQuantity(target, 3)) found.targetQty = t('targetQtyInvalid');
    if (!MONEY_PATTERN.test(bonus)) found.bonusRate = t('bonusRateInvalid');
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    const input: SchemeInput = { rateBase: rate, targetQty: target, bonusRate: bonus };
    inFlight.current = true;
    try {
      await upsert.mutateAsync(input);
      onSaved(tc('saved'));
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
  const pending = upsert.isPending;

  return (
    <Modal
      open
      onClose={() => (pending ? undefined : onClose())}
      title={scheme ? t('editTitle') : t('newTitle')}
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={formError} />
        <Field
          id={fid('rateBase')}
          label={t('rateBase', { unit: unitName })}
          error={errors.rateBase}
        >
          <input
            id={fid('rateBase')}
            inputMode="decimal"
            autoComplete="off"
            value={rateBase}
            onChange={(e) => setRateBase(e.target.value)}
            aria-invalid={Boolean(errors.rateBase) || undefined}
            aria-describedby={describedBy(fid('rateBase'), { error: Boolean(errors.rateBase) })}
            className={inputClass}
          />
        </Field>
        <Field
          id={fid('targetQty')}
          label={t('targetQty', { unit: unitName })}
          error={errors.targetQty}
        >
          <input
            id={fid('targetQty')}
            inputMode="decimal"
            autoComplete="off"
            value={targetQty}
            onChange={(e) => setTargetQty(e.target.value)}
            aria-invalid={Boolean(errors.targetQty) || undefined}
            aria-describedby={describedBy(fid('targetQty'), { error: Boolean(errors.targetQty) })}
            className={inputClass}
          />
        </Field>
        <Field
          id={fid('bonusRate')}
          label={t('bonusRate', { unit: unitName })}
          error={errors.bonusRate}
        >
          <input
            id={fid('bonusRate')}
            inputMode="decimal"
            autoComplete="off"
            value={bonusRate}
            onChange={(e) => setBonusRate(e.target.value)}
            aria-invalid={Boolean(errors.bonusRate) || undefined}
            aria-describedby={describedBy(fid('bonusRate'), { error: Boolean(errors.bonusRate) })}
            className={inputClass}
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? tc('saving') : tc('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
