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
import { useNameOf } from '../../master-data/shared/display';
import { ReasonInput, TextInput, reasonError } from '../../master-data/shared/fields';
import { FormError } from '../../master-data/shared/states';
import { useCorrectOrder, useVoidOrder } from '../api';
import { ProductName, useSalesErrorMessage, useUnitInfo } from '../shared';
import {
  DELIVERY_WINDOWS,
  SALES_LIMITS,
  type DeliveryWindow,
  type Order,
  type OrderPatch,
} from '../types';

/**
 * Correct or void an order. Who may do what directly (docs/API.md §11): every field of an
 * order, note and urgency included, needs `sale.edit`; voiding needs `sale.void`. Whatever the
 * user may not do directly but may ASK for (`change.request`) goes into the shared request
 * dialog. Nothing at all for a void order.
 */
export function OrderActions({
  slug,
  businessId,
  order,
  onDone,
}: {
  slug: string;
  businessId: string;
  order: Order;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.sales.orders');
  const tc = useTranslations('dealership.sales.common');
  const ts = useTranslations('dealership.sales');
  const nameOf = useNameOf();
  const units = useUnitInfo(slug, businessId);
  const canEdit = useCan('sale.edit');
  const canVoid = useCan('sale.void');
  const canRequest = useCan('change.request');
  const [dialog, setDialog] = useState<'void' | 'correct' | null>(null);

  const requestTarget = useMemo((): RequestTarget | null => {
    if (!canRequest || order.status === 'void') return null;
    const fields: RequestTarget['fields'] = [];
    if (!canEdit) {
      fields.push({ key: 'orderDate', type: 'date', current: order.orderDate });
      fields.push({ key: 'deliverBy', type: 'date', current: order.deliverBy });
      fields.push({
        key: 'note',
        type: 'text',
        current: order.note,
        maxLength: SALES_LIMITS.note,
      });
      for (const item of order.items) {
        const product = `${item.product.code} ${nameOf(item.product)}`;
        fields.push({
          key: `items.${item.id}.quantity`,
          type: 'quantity',
          current: item.quantity,
          label: `${tc('quantity')} · ${product}`,
          decimals: units.decimalsOf(item.product.unitKey),
        });
        if (item.unitPrice !== undefined) {
          fields.push({
            key: `items.${item.id}.unitPrice`,
            type: 'money',
            current: item.unitPrice,
            label: `${tc('unitPrice')} · ${product}`,
          });
        }
      }
    }
    if (fields.length === 0 && canVoid) return null;
    return {
      entityType: 'sales_order',
      entityId: order.id,
      name: order.code,
      fields,
      voidable: !canVoid,
    };
    // decimalsOf depends on the units query's data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, canRequest, canVoid, order, units.decimalsOf, nameOf, tc]);

  if (order.status === 'void') return null;

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
        <VoidOrderDialog
          slug={slug}
          businessId={businessId}
          order={order}
          onClose={() => setDialog(null)}
          onDone={(m) => (setDialog(null), onDone(m))}
        />
      ) : null}
      {dialog === 'correct' ? (
        <CorrectOrderDialog
          slug={slug}
          businessId={businessId}
          order={order}
          windowLabel={(w) => ts(`window.${w}`)}
          onClose={() => setDialog(null)}
          onDone={(m) => (setDialog(null), onDone(m))}
        />
      ) : null}
    </>
  );
}

function VoidOrderDialog({
  slug,
  businessId,
  order,
  onClose,
  onDone,
}: {
  slug: string;
  businessId: string;
  order: Order;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.sales.orders.void');
  const tc = useTranslations('dealership.common');
  const id = useId();
  const errorMessage = useErrorMessage();
  const voidOrder = useVoidOrder(slug, businessId);
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
      await voidOrder.mutateAsync({ id: order.id, reason: reason.trim() });
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
      title={t('title', { code: order.code })}
      confirmLabel={t('confirm')}
      cancelLabel={tc('cancel')}
      danger
      pending={voidOrder.isPending}
      pendingLabel={tc('saving')}
      error={error}
      onCancel={() => (voidOrder.isPending ? undefined : onClose())}
      onConfirm={() => void confirm()}
    >
      <div className="space-y-4">
        <p>{t('body')}</p>
        {/* Money already collected is never refunded automatically (API §11). */}
        <p className="rounded-lg border border-warning px-3 py-2 text-sm">{t('advanceNote')}</p>
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

function CorrectOrderDialog({
  slug,
  businessId,
  order,
  windowLabel,
  onClose,
  onDone,
}: {
  slug: string;
  businessId: string;
  order: Order;
  windowLabel: (w: DeliveryWindow) => string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.sales.orders');
  const tc = useTranslations('dealership.sales.common');
  const ts = useTranslations('dealership.sales');
  const tcom = useTranslations('dealership.common');
  const nameOf = useNameOf();
  const id = useId();
  const errorMessage = useErrorMessage();
  const salesError = useSalesErrorMessage();
  const units = useUnitInfo(slug, businessId);
  const correct = useCorrectOrder(slug, businessId);
  const today = useMemo(() => businessToday(), []);
  const [date, setDate] = useState(order.orderDate);
  const [window, setWindow] = useState<DeliveryWindow>(order.deliveryWindow);
  const [deliverBy, setDeliverBy] = useState(order.deliverBy ?? '');
  const [note, setNote] = useState(order.note ?? '');
  const [lines, setLines] = useState(() =>
    order.items.map((i) => ({ id: i.id, quantity: i.quantity, unitPrice: i.unitPrice ?? '' })),
  );
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const showPrices = order.items.some((i) => i.unitPrice !== undefined);

  /** Only real changes go into the PATCH; a reason always comes with it. */
  const build = (): OrderPatch => {
    const patch: OrderPatch = {};
    if (date !== order.orderDate) patch.orderDate = date;
    if (window !== order.deliveryWindow) patch.deliveryWindow = window;
    if (deliverBy !== (order.deliverBy ?? '')) patch.deliverBy = deliverBy || null;
    if (note.trim() !== (order.note ?? '')) patch.note = note.trim();
    const items: NonNullable<OrderPatch['items']> = [];
    order.items.forEach((orig, i) => {
      const line = lines[i]!;
      const change: { id: string; quantity?: string; unitPrice?: string } = { id: orig.id };
      const q = cleanQuantityInput(line.quantity);
      if (q !== orig.quantity) change.quantity = q;
      const price = cleanMoneyInput(line.unitPrice);
      if (orig.unitPrice !== undefined && !sameMoney(price, orig.unitPrice))
        change.unitPrice = price;
      if (change.quantity !== undefined || change.unitPrice !== undefined) items.push(change);
    });
    if (items.length) patch.items = items;
    if (Object.keys(patch).length) patch.reason = reason.trim();
    return patch;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found: Record<string, string | undefined> = {};
    order.items.forEach((orig, i) => {
      const line = lines[i]!;
      if (
        !isPositiveQuantity(
          cleanQuantityInput(line.quantity),
          units.decimalsOf(orig.product.unitKey),
        )
      )
        found[`items.${orig.id}.quantity`] = tc('quantityInvalid');
      if (orig.unitPrice !== undefined && !MONEY_PATTERN.test(cleanMoneyInput(line.unitPrice)))
        found[`items.${orig.id}.unitPrice`] = tc('priceInvalid');
    });
    const patch = build();
    if (Object.keys(patch).length && reasonError(reason)) found.reason = tc('reasonNeeded');
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    if (Object.keys(patch).length === 0) return setFormError(tc('nothing'));

    inFlight.current = true;
    try {
      await correct.mutateAsync({ id: order.id, patch });
      onDone(t('correct.done'));
    } catch (cause) {
      const fields = [
        'orderDate',
        'deliveryWindow',
        'deliverBy',
        'note',
        'reason',
        ...order.items.flatMap((i) => [`items.${i.id}.quantity`, `items.${i.id}.unitPrice`]),
      ];
      const split = errorMessage.split(cause, fields);
      const detailed = salesError(cause);
      if (detailed) {
        for (const key of Object.keys(split.fields)) split.fields[key] = detailed;
        if (Object.keys(split.fields).length === 0) split.form = detailed;
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
      title={t('correct.title', { code: order.code })}
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-fg-muted">{t('correct.intro')}</p>
        <FormError message={formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={fid('date')} label={t('orderDate')} error={errors.orderDate}>
            <input
              id={fid('date')}
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={Boolean(errors.orderDate) || undefined}
              aria-describedby={describedBy(fid('date'), { error: Boolean(errors.orderDate) })}
              className={inputClass}
            />
          </Field>
          <Field id={fid('window')} label={ts('window.label')} error={errors.deliveryWindow}>
            <select
              id={fid('window')}
              value={window}
              onChange={(e) => setWindow(e.target.value as DeliveryWindow)}
              className={inputClass}
            >
              {DELIVERY_WINDOWS.map((w) => (
                <option key={w} value={w}>
                  {windowLabel(w)}
                </option>
              ))}
            </select>
          </Field>
          <Field id={fid('deliverBy')} label={t('deliverBy')} error={errors.deliverBy}>
            <input
              id={fid('deliverBy')}
              type="date"
              min={date}
              value={deliverBy}
              onChange={(e) => setDeliverBy(e.target.value)}
              aria-invalid={Boolean(errors.deliverBy) || undefined}
              aria-describedby={describedBy(fid('deliverBy'), {
                error: Boolean(errors.deliverBy),
              })}
              className={inputClass}
            />
          </Field>
          <TextInput
            id={fid('note')}
            label={tc('note')}
            value={note}
            onChange={setNote}
            error={errors.note}
            maxLength={SALES_LIMITS.note}
          />
        </div>

        {/* Lines cannot be added or removed in a correction (step-5b decision 11). */}
        <ul className="space-y-3">
          {order.items.map((item, i) => {
            const qKey = `items.${item.id}.quantity`;
            const pKey = `items.${item.id}.unitPrice`;
            return (
              <li key={item.id} className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">
                  <ProductName product={item.product} name={nameOf(item.product)} />
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id={fid(`q${i}`)}
                    label={tc('quantityWithUnit', { unit: units.nameOf(item.product.unitKey) })}
                    error={errors[qKey]}
                  >
                    <input
                      id={fid(`q${i}`)}
                      inputMode={units.decimalsOf(item.product.unitKey) > 0 ? 'decimal' : 'numeric'}
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
                  {showPrices ? (
                    <Field id={fid(`p${i}`)} label={tc('unitPrice')} error={errors[pKey]}>
                      <input
                        id={fid(`p${i}`)}
                        inputMode="decimal"
                        autoComplete="off"
                        value={lines[i]!.unitPrice}
                        onChange={(e) =>
                          setLines((all) =>
                            all.map((l, j) => (j === i ? { ...l, unitPrice: e.target.value } : l)),
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

        <ReasonInput id={fid('reason')} value={reason} onChange={setReason} error={errors.reason} />
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={correct.isPending}>
            {tcom('cancel')}
          </Button>
          <Button type="submit" disabled={correct.isPending} aria-busy={correct.isPending}>
            {correct.isPending ? t('correct.saving') : t('correct.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
