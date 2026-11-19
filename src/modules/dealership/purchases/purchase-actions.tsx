'use client';

import { Ban, FilePen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { RequestChangeButton, type RequestTarget } from '@/core/approvals/request-dialog';
import { useErrorMessage } from '@/core/api/field-errors';
import { useCan } from '@/core/auth/can';
import { businessToday } from '@/core/i18n/format';
import { MONEY_PATTERN, cleanMoneyInput, sameMoney } from '@/core/lib/money';
import { cleanQuantityInput, isPositiveQuantity } from '@/core/lib/quantity';
import { Button } from '@/core/ui/button';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';
import { Modal } from '@/core/ui/modal';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { useUnits } from '../master-data/api';
import { useNameOf } from '../master-data/shared/display';
import { ReasonInput, TextInput, reasonError } from '../master-data/shared/fields';
import { FormError } from '../master-data/shared/states';
import { useCorrectPurchase, useVoidPurchase } from './api';
import { useStockInsufficientMessage } from './stock-error';
import { PURCHASE_LIMITS, type Purchase, type PurchasePatch } from './types';

/**
 * Void / correct a purchase. Who may do what directly (docs/API.md §10):
 * - void: `purchase.void` · date and bags: `purchase.edit` · prices: `purchase.edit` +
 *   `product.cost.view` · note and paper number: `purchase.create`.
 * Anything the user may not do directly but may ASK for (`change.request`) goes into one
 * "Request a correction" button (4d dialog). Nothing for a void purchase.
 */
export function PurchaseActions({
  slug,
  businessId,
  purchase,
  onDone,
}: {
  slug: string;
  businessId: string;
  purchase: Purchase;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.purchases');
  const nameOf = useNameOf();
  const units = useUnits(slug, businessId);
  const canVoid = useCan('purchase.void');
  const canEdit = useCan('purchase.edit');
  const canCreate = useCan('purchase.create');
  const canSeeCost = useCan('product.cost.view');
  const canRequest = useCan('change.request');
  const [dialog, setDialog] = useState<'void' | 'correct' | null>(null);
  const showPrices = purchase.items.some((i) => i.unitPrice !== undefined);
  const decimalsOf = (key: string) => units.data?.items.find((u) => u.key === key)?.decimals ?? 0;

  const requestTarget = useMemo((): RequestTarget | null => {
    if (!canRequest || purchase.status === 'void') return null;
    const fields: RequestTarget['fields'] = [];
    if (!canEdit) {
      fields.push({ key: 'purchaseDate', type: 'date', current: purchase.purchaseDate });
      for (const item of purchase.items) {
        const product = `${item.product.code} ${nameOf(item.product)}`;
        fields.push({
          key: `items.${item.id}.quantity`,
          type: 'quantity',
          current: item.quantity,
          label: `${t('form.quantity')} · ${product}`,
          decimals: decimalsOf(item.product.unitKey),
        });
        if (canSeeCost && item.unitPrice !== undefined) {
          fields.push({
            key: `items.${item.id}.unitPrice`,
            type: 'money',
            current: item.unitPrice,
            label: `${t('form.unitPrice')} · ${product}`,
          });
        }
      }
    }
    if (!canCreate) {
      fields.push({
        key: 'supplierReference',
        type: 'text',
        current: purchase.supplierReference,
        maxLength: PURCHASE_LIMITS.supplierReference,
      });
      fields.push({
        key: 'note',
        type: 'text',
        current: purchase.note,
        maxLength: PURCHASE_LIMITS.note,
      });
    }
    if (fields.length === 0 && canVoid) return null;
    return {
      entityType: 'purchase',
      entityId: purchase.id,
      name: purchase.code,
      fields,
      voidable: !canVoid,
    };
    // decimalsOf depends on units data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCreate, canEdit, canRequest, canSeeCost, canVoid, purchase, units.data, t]);

  if (purchase.status === 'void') return null;
  const canCorrect = canEdit || canCreate;

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
      {canCorrect ? (
        <Button onClick={() => setDialog('correct')}>
          <FilePen aria-hidden className="size-4" />
          {t('actions.correct')}
        </Button>
      ) : null}
      {dialog === 'void' ? (
        <VoidDialog
          slug={slug}
          businessId={businessId}
          purchase={purchase}
          onClose={() => setDialog(null)}
          onDone={(m) => (setDialog(null), onDone(m))}
        />
      ) : null}
      {dialog === 'correct' ? (
        <CorrectDialog
          slug={slug}
          businessId={businessId}
          purchase={purchase}
          canEdit={canEdit}
          canCreate={canCreate}
          canEditPrice={canEdit && canSeeCost && showPrices}
          decimalsOf={decimalsOf}
          onClose={() => setDialog(null)}
          onDone={(m) => (setDialog(null), onDone(m))}
        />
      ) : null}
    </>
  );
}

function VoidDialog({
  slug,
  businessId,
  purchase,
  onClose,
  onDone,
}: {
  slug: string;
  businessId: string;
  purchase: Purchase;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.purchases');
  const tc = useTranslations('dealership.common');
  const id = useId();
  const errorMessage = useErrorMessage();
  const stockMessage = useStockInsufficientMessage();
  const voidPurchase = useVoidPurchase(slug, businessId);
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
      await voidPurchase.mutateAsync({ id: purchase.id, reason: reason.trim() });
      onDone(t('void.done'));
    } catch (cause) {
      setError(stockMessage(cause) ?? errorMessage.message(cause));
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <ConfirmDialog
      open
      title={t('void.title', { code: purchase.code })}
      confirmLabel={t('void.confirm')}
      cancelLabel={tc('cancel')}
      danger
      pending={voidPurchase.isPending}
      pendingLabel={tc('saving')}
      error={error}
      onCancel={() => (voidPurchase.isPending ? undefined : onClose())}
      onConfirm={() => void confirm()}
    >
      <div className="space-y-4">
        <p>{t('void.body')}</p>
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

function CorrectDialog({
  slug,
  businessId,
  purchase,
  canEdit,
  canCreate,
  canEditPrice,
  decimalsOf,
  onClose,
  onDone,
}: {
  slug: string;
  businessId: string;
  purchase: Purchase;
  canEdit: boolean;
  canCreate: boolean;
  canEditPrice: boolean;
  decimalsOf: (unitKey: string) => number;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.purchases');
  const tc = useTranslations('dealership.common');
  const nameOf = useNameOf();
  const id = useId();
  const errorMessage = useErrorMessage();
  const stockMessage = useStockInsufficientMessage();
  const correct = useCorrectPurchase(slug, businessId);
  const today = useMemo(() => businessToday(), []);
  const [date, setDate] = useState(purchase.purchaseDate);
  const [lines, setLines] = useState(() =>
    purchase.items.map((i) => ({ id: i.id, quantity: i.quantity, unitPrice: i.unitPrice ?? '' })),
  );
  const [note, setNote] = useState(purchase.note ?? '');
  const [reference, setReference] = useState(purchase.supplierReference ?? '');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inFlight = useRef(false);

  /** Only real changes; a reason when the date, bags or prices change. */
  const build = (): { patch: PurchasePatch; needsReason: boolean } => {
    const patch: PurchasePatch = {};
    if (canEdit && date !== purchase.purchaseDate) patch.purchaseDate = date;
    const items: NonNullable<PurchasePatch['items']> = [];
    purchase.items.forEach((orig, i) => {
      const line = lines[i]!;
      const change: { id: string; quantity?: string; unitPrice?: string } = { id: orig.id };
      const q = cleanQuantityInput(line.quantity);
      if (canEdit && q !== orig.quantity) change.quantity = q;
      const pr = cleanMoneyInput(line.unitPrice);
      if (canEditPrice && !sameMoney(pr, orig.unitPrice)) change.unitPrice = pr;
      if (change.quantity !== undefined || change.unitPrice !== undefined) items.push(change);
    });
    if (items.length) patch.items = items;
    if (canCreate && note.trim() !== (purchase.note ?? '')) patch.note = note.trim();
    if (canCreate && reference.trim() !== (purchase.supplierReference ?? ''))
      patch.supplierReference = reference.trim();
    const needsReason = Boolean(patch.purchaseDate || patch.items);
    if (needsReason) patch.reason = reason.trim();
    return { patch, needsReason };
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found: Record<string, string | undefined> = {};
    purchase.items.forEach((orig, i) => {
      const line = lines[i]!;
      if (
        canEdit &&
        !isPositiveQuantity(cleanQuantityInput(line.quantity), decimalsOf(orig.product.unitKey))
      )
        found[`items.${orig.id}.quantity`] = t('form.quantityInvalid');
      if (canEditPrice && !MONEY_PATTERN.test(cleanMoneyInput(line.unitPrice)))
        found[`items.${orig.id}.unitPrice`] = t('form.priceInvalid');
    });
    const { patch, needsReason } = build();
    if (needsReason && reasonError(reason)) found.reason = t('correct.reasonNeeded');
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    if (Object.keys(patch).length === 0) return setFormError(t('correct.nothing'));

    inFlight.current = true;
    try {
      await correct.mutateAsync({ id: purchase.id, patch });
      onDone(t('correct.done'));
    } catch (cause) {
      const fields = [
        'purchaseDate',
        'note',
        'supplierReference',
        'reason',
        ...purchase.items.flatMap((i) => [`items.${i.id}.quantity`, `items.${i.id}.unitPrice`]),
      ];
      const split = errorMessage.split(cause, fields);
      const stock = stockMessage(cause);
      // STOCK_INSUFFICIENT names the line (items.<id>.quantity): say how much there is.
      if (stock) {
        for (const key of Object.keys(split.fields)) split.fields[key] = stock;
        if (Object.keys(split.fields).length === 0) split.form = stock;
      }
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
      title={t('correct.title', { code: purchase.code })}
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-fg-muted">{t('correct.intro')}</p>
        <FormError message={formError} />
        {canEdit ? (
          <Field id={fid('date')} label={t('date')} error={errors.purchaseDate}>
            <input
              id={fid('date')}
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={Boolean(errors.purchaseDate) || undefined}
              aria-describedby={describedBy(fid('date'), { error: Boolean(errors.purchaseDate) })}
              className={inputClass}
            />
          </Field>
        ) : null}
        {canEdit || canEditPrice ? (
          <ul className="space-y-3">
            {purchase.items.map((item, i) => {
              const qKey = `items.${item.id}.quantity`;
              const pKey = `items.${item.id}.unitPrice`;
              return (
                <li key={item.id} className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">
                    <span className="font-mono text-xs text-fg-muted">{item.product.code}</span>{' '}
                    {nameOf(item.product)}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {canEdit ? (
                      <Field id={fid(`q${i}`)} label={t('form.quantity')} error={errors[qKey]}>
                        <input
                          id={fid(`q${i}`)}
                          inputMode="decimal"
                          autoComplete="off"
                          value={lines[i]!.quantity}
                          onChange={(e) =>
                            setLines((all) =>
                              all.map((l, j) => (j === i ? { ...l, quantity: e.target.value } : l)),
                            )
                          }
                          aria-invalid={Boolean(errors[qKey]) || undefined}
                          aria-describedby={errors[qKey] ? `${fid(`q${i}`)}-error` : undefined}
                          className={inputClass}
                        />
                      </Field>
                    ) : null}
                    {canEditPrice ? (
                      <Field id={fid(`p${i}`)} label={t('form.unitPrice')} error={errors[pKey]}>
                        <input
                          id={fid(`p${i}`)}
                          inputMode="decimal"
                          autoComplete="off"
                          value={lines[i]!.unitPrice}
                          onChange={(e) =>
                            setLines((all) =>
                              all.map((l, j) =>
                                j === i ? { ...l, unitPrice: e.target.value } : l,
                              ),
                            )
                          }
                          aria-invalid={Boolean(errors[pKey]) || undefined}
                          aria-describedby={errors[pKey] ? `${fid(`p${i}`)}-error` : undefined}
                          className={inputClass}
                        />
                      </Field>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        {canCreate ? (
          <>
            <TextInput
              id={fid('reference')}
              label={t('supplierReference')}
              value={reference}
              onChange={setReference}
              error={errors.supplierReference}
              maxLength={PURCHASE_LIMITS.supplierReference}
            />
            <TextInput
              id={fid('note')}
              label={t('note')}
              value={note}
              onChange={setNote}
              error={errors.note}
              maxLength={PURCHASE_LIMITS.note}
            />
          </>
        ) : null}
        {canEdit ? (
          <ReasonInput
            id={fid('reason')}
            value={reason}
            onChange={setReason}
            error={errors.reason}
          />
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={correct.isPending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={correct.isPending} aria-busy={correct.isPending}>
            {correct.isPending ? t('correct.saving') : t('correct.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
