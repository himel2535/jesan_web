'use client';

import { Ban, FilePen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { RequestChangeButton } from '@/core/approvals/request-dialog';
import { useErrorMessage } from '@/core/api/field-errors';
import { useCan } from '@/core/auth/can';
import { businessToday } from '@/core/i18n/format';
import { MONEY_PATTERN, cleanMoneyInput, sameMoney } from '@/core/lib/money';
import { Button } from '@/core/ui/button';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';
import { Modal } from '@/core/ui/modal';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { useNameOf } from '../master-data/shared/display';
import { ReasonInput, TextInput, reasonError } from '../master-data/shared/fields';
import { FormError } from '../master-data/shared/states';
import { useExpenseCategories, useExpenseMethods, useCorrectExpense, useVoidExpense } from './api';
import { useExpenseRequestTarget } from './correction';
import { useMethodLabel } from './shared';
import { EXPENSE_LIMITS, type Expense, type ExpensePatch } from './types';

/**
 * Correct or void an expense: `expense.edit` / `expense.void` directly, otherwise a request
 * (`categoryId` excluded there — DECISIONS.md). A category can still be changed in the correct
 * dialog, since `expense.edit` already means a direct, owner-level change.
 */
export function ExpenseActions({
  slug,
  businessId,
  expense,
  onDone,
}: {
  slug: string;
  businessId: string;
  expense: Expense;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.expenses');
  const canEdit = useCan('expense.edit');
  const canVoid = useCan('expense.void');
  const [dialog, setDialog] = useState<'void' | 'correct' | null>(null);
  const requestTarget = useExpenseRequestTarget(expense);

  if (expense.status === 'void') return null;

  return (
    <>
      {requestTarget ? (
        <RequestChangeButton slug={slug} target={requestTarget} onSent={onDone} />
      ) : null}
      {canVoid ? (
        <Button variant="danger" onClick={() => setDialog('void')}>
          <Ban aria-hidden className="size-4" />
          {t('actions.void')}
        </Button>
      ) : null}
      {canEdit ? (
        <Button onClick={() => setDialog('correct')}>
          <FilePen aria-hidden className="size-4" />
          {t('actions.correct')}
        </Button>
      ) : null}
      {dialog === 'void' ? (
        <VoidExpenseDialog
          slug={slug}
          businessId={businessId}
          expense={expense}
          onClose={() => setDialog(null)}
          onDone={(m) => (setDialog(null), onDone(m))}
        />
      ) : null}
      {dialog === 'correct' ? (
        <CorrectExpenseDialog
          slug={slug}
          businessId={businessId}
          expense={expense}
          onClose={() => setDialog(null)}
          onDone={(m) => (setDialog(null), onDone(m))}
        />
      ) : null}
    </>
  );
}

function VoidExpenseDialog({
  slug,
  businessId,
  expense,
  onClose,
  onDone,
}: {
  slug: string;
  businessId: string;
  expense: Expense;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.expenses.void');
  const tc = useTranslations('dealership.common');
  const id = useId();
  const errorMessage = useErrorMessage();
  const voidExpense = useVoidExpense(slug, businessId);
  const [reason, setReason] = useState('');
  const [showReasonError, setShowReasonError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const confirm = async () => {
    if (inFlight.current) return;
    if (reasonError(reason)) return setShowReasonError(true);
    inFlight.current = true;
    setError(null);
    try {
      await voidExpense.mutateAsync({ id: expense.id, reason: reason.trim() });
      onDone(t('done'));
    } catch (cause) {
      setError(errorMessage.message(cause));
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <ConfirmDialog
      open
      title={t('title', { code: expense.code })}
      confirmLabel={t('confirm')}
      cancelLabel={tc('cancel')}
      danger
      pending={voidExpense.isPending}
      pendingLabel={tc('saving')}
      error={error}
      onCancel={() => (voidExpense.isPending ? undefined : onClose())}
      onConfirm={() => void confirm()}
    >
      <div className="space-y-4">
        <p>{t('body')}</p>
        <ReasonInput
          id={`${id}-reason`}
          value={reason}
          onChange={setReason}
          error={showReasonError && reasonError(reason) ? tc('reasonRequired') : undefined}
        />
      </div>
    </ConfirmDialog>
  );
}

function CorrectExpenseDialog({
  slug,
  businessId,
  expense,
  onClose,
  onDone,
}: {
  slug: string;
  businessId: string;
  expense: Expense;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.expenses');
  const tc = useTranslations('dealership.common');
  const tx = useTranslations('dealership.expenses.common');
  const id = useId();
  const nameOf = useNameOf();
  const errorMessage = useErrorMessage();
  const methodLabel = useMethodLabel();
  const categories = useExpenseCategories(slug, businessId, 'true');
  const methods = useExpenseMethods(slug, businessId);
  const correct = useCorrectExpense(slug, businessId);
  const today = useMemo(() => businessToday(), []);
  const [date, setDate] = useState(expense.expenseDate);
  const [categoryId, setCategoryId] = useState(expense.category.id);
  const [method, setMethod] = useState(expense.method);
  const [amount, setAmount] = useState(expense.amount);
  const [note, setNote] = useState(expense.note ?? '');
  const [proofNote, setProofNote] = useState(expense.proofNote ?? '');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const build = (): ExpensePatch => {
    const patch: ExpensePatch = {};
    if (date !== expense.expenseDate) patch.expenseDate = date;
    if (categoryId !== expense.category.id) patch.categoryId = categoryId;
    if (method !== expense.method) patch.method = method;
    const clean = cleanMoneyInput(amount);
    if (!sameMoney(clean, expense.amount)) patch.amount = clean;
    if (note.trim() !== (expense.note ?? '')) patch.note = note.trim();
    if (proofNote.trim() !== (expense.proofNote ?? '')) patch.proofNote = proofNote.trim();
    if (Object.keys(patch).length) patch.reason = reason.trim();
    return patch;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found: Record<string, string | undefined> = {};
    const clean = cleanMoneyInput(amount);
    if (!MONEY_PATTERN.test(clean) || !/[1-9]/.test(clean)) found.amount = t('amountInvalid');
    const patch = build();
    if (Object.keys(patch).length && reasonError(reason)) found.reason = tx('reasonNeeded');
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    if (Object.keys(patch).length === 0) return setFormError(tx('nothing'));

    inFlight.current = true;
    try {
      await correct.mutateAsync({ id: expense.id, patch });
      onDone(t('correct.done'));
    } catch (cause) {
      const split = errorMessage.split(cause, [
        'expenseDate',
        'categoryId',
        'method',
        'amount',
        'note',
        'proofNote',
        'reason',
      ]);
      setErrors(split.fields);
      setFormError(split.form);
    } finally {
      inFlight.current = false;
    }
  };

  const fid = (key: string) => `${id}-${key}`;
  return (
    <Modal
      open
      onClose={() => (correct.isPending ? undefined : onClose())}
      title={t('correct.title', { code: expense.code })}
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-fg-muted">{t('correct.intro')}</p>
        <FormError message={formError} />
        <div className="grid gap-4 sm:grid-cols-2">
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
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              {(categories.data ?? [expense.category]).map((c) => (
                <option key={c.id} value={c.id}>
                  {nameOf(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field id={fid('method')} label={t('method')} error={errors.method}>
            <select
              id={fid('method')}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={inputClass}
            >
              {(methods.data ?? [expense.method]).map((m) => (
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
            value={note}
            onChange={setNote}
            error={errors.note}
            maxLength={EXPENSE_LIMITS.note}
          />
          <TextInput
            id={fid('proofNote')}
            label={t('proofNote')}
            value={proofNote}
            onChange={setProofNote}
            error={errors.proofNote}
            maxLength={EXPENSE_LIMITS.proofNote}
          />
        </div>
        <ReasonInput id={fid('reason')} value={reason} onChange={setReason} error={errors.reason} />
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={correct.isPending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={correct.isPending} aria-busy={correct.isPending}>
            {correct.isPending ? tc('saving') : t('correct.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
