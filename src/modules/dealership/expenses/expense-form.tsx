'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { newIdempotencyKey } from '@/core/approvals/api';
import { useErrorMessage } from '@/core/api/field-errors';
import { businessToday } from '@/core/i18n/format';
import { MONEY_PATTERN, cleanMoneyInput } from '@/core/lib/money';
import { Button } from '@/core/ui/button';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { useNameOf } from '../master-data/shared/display';
import { TextInput } from '../master-data/shared/fields';
import { FormError } from '../master-data/shared/states';
import { useExpenseCategories, useExpenseMethods, useCreateExpense } from './api';
import { FormSkeleton } from './skeletons';
import { useMethodLabel } from './shared';
import { EXPENSE_LIMITS, type ExpenseInput } from './types';

type Errors = Record<string, string | undefined>;

/**
 * Record an expense (`expense.create`). `expenseDate` defaults to today; the API alone enforces
 * the 7-day backdating limit for someone without `expense.edit`, so the form only blocks future
 * dates, never a specific past one.
 */
export function ExpenseForm({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.expenses');
  const tc = useTranslations('dealership.common');
  const tx = useTranslations('dealership.expenses.common');
  const id = useId();
  const router = useRouter();
  const nameOf = useNameOf();
  const methodLabel = useMethodLabel();
  const errorMessage = useErrorMessage();
  const categories = useExpenseCategories(slug, businessId, 'true');
  const methods = useExpenseMethods(slug, businessId);
  const create = useCreateExpense(slug, businessId);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const inFlight = useRef(false);
  const today = useMemo(() => businessToday(), []);

  const [date, setDate] = useState(today);
  const [categoryId, setCategoryId] = useState('');
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const chosenCategory = categoryId || categories.data?.[0]?.id || '';
  const chosenMethod = method || methods.data?.[0] || '';

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found: Errors = {};
    if (!chosenCategory) found.categoryId = t('categoryRequired');
    const clean = cleanMoneyInput(amount);
    if (!MONEY_PATTERN.test(clean) || !/[1-9]/.test(clean)) found.amount = t('amountInvalid');
    if (!chosenMethod) found.method = t('methodRequired');
    if (!date) found.expenseDate = tc('required');
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    const input: ExpenseInput = {
      categoryId: chosenCategory,
      method: chosenMethod,
      amount: clean,
      expenseDate: date,
    };
    if (note.trim()) input.note = note.trim();
    if (proofNote.trim()) input.proofNote = proofNote.trim();

    inFlight.current = true;
    try {
      const saved = await create.mutateAsync({ input, idempotencyKey });
      router.push(`/b/${encodeURIComponent(slug)}/expenses/${saved.id}?saved=created`);
    } catch (cause) {
      const split = errorMessage.split(cause, [
        'categoryId',
        'method',
        'amount',
        'expenseDate',
        'note',
        'proofNote',
      ]);
      setErrors(split.fields);
      setFormError(split.form);
      inFlight.current = false;
    }
  };

  if (categories.isPending || methods.isPending) return <FormSkeleton />;
  const fid = (key: string) => `${id}-${key}`;
  const pending = create.isPending;

  return (
    <form noValidate onSubmit={onSubmit} className="max-w-3xl space-y-6">
      <FormError message={formError} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={fid('date')} label={t('expenseDate')} error={errors.expenseDate}>
          <input
            id={fid('date')}
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={Boolean(errors.expenseDate) || undefined}
            aria-describedby={describedBy(fid('date'), { error: Boolean(errors.expenseDate) })}
            className={inputClass}
          />
        </Field>
        <Field id={fid('category')} label={t('category')} error={errors.categoryId}>
          <select
            id={fid('category')}
            value={chosenCategory}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-invalid={Boolean(errors.categoryId) || undefined}
            aria-describedby={errors.categoryId ? `${fid('category')}-error` : undefined}
            className={inputClass}
          >
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {nameOf(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field id={fid('method')} label={t('method')} error={errors.method}>
          <select
            id={fid('method')}
            value={chosenMethod}
            onChange={(e) => setMethod(e.target.value)}
            aria-invalid={Boolean(errors.method) || undefined}
            aria-describedby={errors.method ? `${fid('method')}-error` : undefined}
            className={inputClass}
          >
            {(methods.data ?? []).map((m) => (
              <option key={m} value={m}>
                {methodLabel(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field id={fid('amount')} label={tx('amount')} error={errors.amount}>
          <input
            id={fid('amount')}
            inputMode="decimal"
            autoComplete="off"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={Boolean(errors.amount) || undefined}
            aria-describedby={describedBy(fid('amount'), { error: Boolean(errors.amount) })}
            className={inputClass}
          />
        </Field>
        <TextInput
          id={fid('note')}
          label={tx('note')}
          hint={t('noteHint')}
          value={note}
          onChange={setNote}
          error={errors.note}
          maxLength={EXPENSE_LIMITS.note}
        />
        <TextInput
          id={fid('proofNote')}
          label={t('proofNote')}
          hint={t('proofNoteHint')}
          value={proofNote}
          onChange={setProofNote}
          error={errors.proofNote}
          maxLength={EXPENSE_LIMITS.proofNote}
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? tc('saving') : tc('save')}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => router.back()} disabled={pending}>
          {tc('cancel')}
        </Button>
      </div>
    </form>
  );
}
