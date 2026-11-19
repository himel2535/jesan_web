'use client';

import { Ban, FilePen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { RequestChangeButton, type RequestTarget } from '@/core/approvals/request-dialog';
import { useErrorMessage } from '@/core/api/field-errors';
import { useCan } from '@/core/auth/can';
import { businessToday } from '@/core/i18n/format';
import { MONEY_PATTERN, cleanMoneyInput, sameMoney } from '@/core/lib/money';
import { Button } from '@/core/ui/button';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';
import { Modal } from '@/core/ui/modal';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { ReasonInput, TextInput, reasonError } from '../../master-data/shared/fields';
import { FormError } from '../../master-data/shared/states';
import { useCollectionMethods, useCorrectCollection, useVoidCollection } from '../api';
import { useMethodLabel } from '../shared';
import { SALES_LIMITS, type Collection, type CollectionPatch } from '../types';

/**
 * Correct or void a collection: `collection.edit` / `collection.void` directly, otherwise a
 * request. The amount may only be asked for by someone who may see it (`collection.view`).
 */
export function CollectionActions({
  slug,
  businessId,
  collection,
  onDone,
}: {
  slug: string;
  businessId: string;
  collection: Collection;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.sales.collections');
  const canEdit = useCan('collection.edit');
  const canVoid = useCan('collection.void');
  const canView = useCan('collection.view');
  const canRequest = useCan('change.request');
  const [dialog, setDialog] = useState<'void' | 'correct' | null>(null);

  const requestTarget = useMemo((): RequestTarget | null => {
    if (!canRequest || collection.status === 'void') return null;
    const fields: RequestTarget['fields'] = [];
    if (!canEdit) {
      fields.push({ key: 'collectionDate', type: 'date', current: collection.collectionDate });
      if (canView) fields.push({ key: 'amount', type: 'money', current: collection.amount });
      fields.push({
        key: 'reference',
        type: 'text',
        current: collection.reference,
        maxLength: SALES_LIMITS.reference,
      });
      fields.push({
        key: 'note',
        type: 'text',
        current: collection.note,
        maxLength: SALES_LIMITS.note,
      });
    }
    if (fields.length === 0 && canVoid) return null;
    return {
      entityType: 'collection',
      entityId: collection.id,
      name: collection.code,
      fields,
      voidable: !canVoid,
    };
  }, [canEdit, canRequest, canView, canVoid, collection]);

  if (collection.status === 'void') return null;

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
        <VoidCollectionDialog
          slug={slug}
          businessId={businessId}
          collection={collection}
          onClose={() => setDialog(null)}
          onDone={(m) => (setDialog(null), onDone(m))}
        />
      ) : null}
      {dialog === 'correct' ? (
        <CorrectCollectionDialog
          slug={slug}
          businessId={businessId}
          collection={collection}
          onClose={() => setDialog(null)}
          onDone={(m) => (setDialog(null), onDone(m))}
        />
      ) : null}
    </>
  );
}

function VoidCollectionDialog({
  slug,
  businessId,
  collection,
  onClose,
  onDone,
}: {
  slug: string;
  businessId: string;
  collection: Collection;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.sales.collections.void');
  const tc = useTranslations('dealership.common');
  const id = useId();
  const errorMessage = useErrorMessage();
  const voidCollection = useVoidCollection(slug, businessId);
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
      await voidCollection.mutateAsync({ id: collection.id, reason: reason.trim() });
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
      title={t('title', { code: collection.code })}
      confirmLabel={t('confirm')}
      cancelLabel={tc('cancel')}
      danger
      pending={voidCollection.isPending}
      pendingLabel={tc('saving')}
      error={error}
      onCancel={() => (voidCollection.isPending ? undefined : onClose())}
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

function CorrectCollectionDialog({
  slug,
  businessId,
  collection,
  onClose,
  onDone,
}: {
  slug: string;
  businessId: string;
  collection: Collection;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.sales.collections');
  const tc = useTranslations('dealership.sales.common');
  const tcom = useTranslations('dealership.common');
  const id = useId();
  const errorMessage = useErrorMessage();
  const methodLabel = useMethodLabel();
  const methods = useCollectionMethods(slug, businessId);
  const correct = useCorrectCollection(slug, businessId);
  const today = useMemo(() => businessToday(), []);
  const [date, setDate] = useState(collection.collectionDate);
  const [amount, setAmount] = useState(collection.amount);
  const [method, setMethod] = useState(collection.method);
  const [reference, setReference] = useState(collection.reference ?? '');
  const [note, setNote] = useState(collection.note ?? '');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const build = (): CollectionPatch => {
    const patch: CollectionPatch = {};
    if (date !== collection.collectionDate) patch.collectionDate = date;
    if (method !== collection.method) patch.method = method;
    const clean = cleanMoneyInput(amount);
    if (!sameMoney(clean, collection.amount)) patch.amount = clean;
    if (reference.trim() !== (collection.reference ?? '')) patch.reference = reference.trim();
    if (note.trim() !== (collection.note ?? '')) patch.note = note.trim();
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
    if (Object.keys(patch).length && reasonError(reason)) found.reason = tc('reasonNeeded');
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    if (Object.keys(patch).length === 0) return setFormError(tc('nothing'));

    inFlight.current = true;
    try {
      await correct.mutateAsync({ id: collection.id, patch });
      onDone(t('correct.done'));
    } catch (cause) {
      const split = errorMessage.split(cause, [
        'collectionDate',
        'method',
        'amount',
        'reference',
        'note',
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
      title={t('correct.title', { code: collection.code })}
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-fg-muted">{t('correct.intro')}</p>
        <FormError message={formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={fid('amount')} label={tc('amount')} error={errors.amount}>
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
          <Field id={fid('method')} label={t('method')} error={errors.method}>
            <select
              id={fid('method')}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={inputClass}
            >
              {(methods.data ?? [collection.method]).map((m) => (
                <option key={m} value={m}>
                  {methodLabel(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field id={fid('date')} label={t('collectionDate')} error={errors.collectionDate}>
            <input
              id={fid('date')}
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={Boolean(errors.collectionDate) || undefined}
              aria-describedby={describedBy(fid('date'), {
                error: Boolean(errors.collectionDate),
              })}
              className={inputClass}
            />
          </Field>
          <TextInput
            id={fid('reference')}
            label={t('reference')}
            value={reference}
            onChange={setReference}
            error={errors.reference}
            maxLength={SALES_LIMITS.reference}
          />
          <TextInput
            id={fid('note')}
            label={tc('note')}
            value={note}
            onChange={setNote}
            error={errors.note}
            maxLength={SALES_LIMITS.note}
          />
        </div>
        <ReasonInput id={fid('reason')} value={reason} onChange={setReason} error={errors.reason} />
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={correct.isPending}>
            {tcom('cancel')}
          </Button>
          <Button type="submit" disabled={correct.isPending} aria-busy={correct.isPending}>
            {correct.isPending ? tc('saving') : t('correct.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
