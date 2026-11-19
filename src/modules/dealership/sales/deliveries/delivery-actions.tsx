'use client';

import { Ban, FilePen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { RequestChangeButton, type RequestTarget } from '@/core/approvals/request-dialog';
import { useErrorMessage } from '@/core/api/field-errors';
import { useCan } from '@/core/auth/can';
import { businessToday } from '@/core/i18n/format';
import { cleanQuantityInput, isPositiveQuantity } from '@/core/lib/quantity';
import { Button } from '@/core/ui/button';
import { ConfirmDialog } from '@/core/ui/confirm-dialog';
import { Modal } from '@/core/ui/modal';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { useNameOf } from '../../master-data/shared/display';
import { ReasonInput, TextInput, reasonError } from '../../master-data/shared/fields';
import { FormError } from '../../master-data/shared/states';
import { useCorrectDelivery, useVoidDelivery } from '../api';
import { ProductName, useSalesErrorMessage, useUnitInfo } from '../shared';
import { SALES_LIMITS, type Delivery, type DeliveryPatch } from '../types';

/**
 * Correct or void a delivery: `delivery.edit` / `delivery.void` directly, otherwise a request
 * (`change.request`). A void delivery offers nothing.
 */
export function DeliveryActions({
  slug,
  businessId,
  delivery,
  onDone,
}: {
  slug: string;
  businessId: string;
  delivery: Delivery;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.sales.deliveries');
  const tc = useTranslations('dealership.sales.common');
  const nameOf = useNameOf();
  const units = useUnitInfo(slug, businessId);
  const canEdit = useCan('delivery.edit');
  const canVoid = useCan('delivery.void');
  const canRequest = useCan('change.request');
  const [dialog, setDialog] = useState<'void' | 'correct' | null>(null);

  const requestTarget = useMemo((): RequestTarget | null => {
    if (!canRequest || delivery.status === 'void') return null;
    const fields: RequestTarget['fields'] = [];
    if (!canEdit) {
      fields.push({ key: 'deliveryDate', type: 'date', current: delivery.deliveryDate });
      fields.push({
        key: 'transportReference',
        type: 'text',
        current: delivery.transportReference,
        maxLength: SALES_LIMITS.transportReference,
      });
      fields.push({
        key: 'note',
        type: 'text',
        current: delivery.note,
        maxLength: SALES_LIMITS.note,
      });
      for (const item of delivery.items) {
        fields.push({
          key: `items.${item.id}.quantity`,
          type: 'quantity',
          current: item.quantity,
          label: `${tc('quantity')} · ${item.product.code} ${nameOf(item.product)}`,
          decimals: units.decimalsOf(item.product.unitKey),
        });
      }
    }
    if (fields.length === 0 && canVoid) return null;
    return {
      entityType: 'delivery',
      entityId: delivery.id,
      name: delivery.code,
      fields,
      voidable: !canVoid,
    };
    // decimalsOf depends on the units query's data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, canRequest, canVoid, delivery, units.decimalsOf, nameOf, tc]);

  if (delivery.status === 'void') return null;

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
        <VoidDeliveryDialog
          slug={slug}
          businessId={businessId}
          delivery={delivery}
          onClose={() => setDialog(null)}
          onDone={(m) => (setDialog(null), onDone(m))}
        />
      ) : null}
      {dialog === 'correct' ? (
        <CorrectDeliveryDialog
          slug={slug}
          businessId={businessId}
          delivery={delivery}
          onClose={() => setDialog(null)}
          onDone={(m) => (setDialog(null), onDone(m))}
        />
      ) : null}
    </>
  );
}

function VoidDeliveryDialog({
  slug,
  businessId,
  delivery,
  onClose,
  onDone,
}: {
  slug: string;
  businessId: string;
  delivery: Delivery;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.sales.deliveries.void');
  const tc = useTranslations('dealership.common');
  const id = useId();
  const errorMessage = useErrorMessage();
  const salesError = useSalesErrorMessage();
  const voidDelivery = useVoidDelivery(slug, businessId);
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
      await voidDelivery.mutateAsync({ id: delivery.id, reason: reason.trim() });
      onDone(t('done'));
    } catch (cause) {
      setError(salesError(cause) ?? errorMessage.message(cause));
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <ConfirmDialog
      open
      title={t('title', { code: delivery.code })}
      confirmLabel={t('confirm')}
      cancelLabel={tc('cancel')}
      danger
      pending={voidDelivery.isPending}
      pendingLabel={tc('saving')}
      error={error}
      onCancel={() => (voidDelivery.isPending ? undefined : onClose())}
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

function CorrectDeliveryDialog({
  slug,
  businessId,
  delivery,
  onClose,
  onDone,
}: {
  slug: string;
  businessId: string;
  delivery: Delivery;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('dealership.sales.deliveries');
  const tc = useTranslations('dealership.sales.common');
  const tcom = useTranslations('dealership.common');
  const nameOf = useNameOf();
  const id = useId();
  const errorMessage = useErrorMessage();
  const salesError = useSalesErrorMessage();
  const units = useUnitInfo(slug, businessId);
  const correct = useCorrectDelivery(slug, businessId);
  const today = useMemo(() => businessToday(), []);
  const [date, setDate] = useState(delivery.deliveryDate);
  const [transport, setTransport] = useState(delivery.transportReference ?? '');
  const [note, setNote] = useState(delivery.note ?? '');
  const [lines, setLines] = useState(() =>
    delivery.items.map((i) => ({ id: i.id, quantity: i.quantity })),
  );
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const build = (): DeliveryPatch => {
    const patch: DeliveryPatch = {};
    if (date !== delivery.deliveryDate) patch.deliveryDate = date;
    if (transport.trim() !== (delivery.transportReference ?? ''))
      patch.transportReference = transport.trim();
    if (note.trim() !== (delivery.note ?? '')) patch.note = note.trim();
    const items = delivery.items
      .map((orig, i) => ({ id: orig.id, quantity: cleanQuantityInput(lines[i]!.quantity) }))
      .filter((line, i) => line.quantity !== delivery.items[i]!.quantity);
    if (items.length) patch.items = items;
    if (Object.keys(patch).length) patch.reason = reason.trim();
    return patch;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found: Record<string, string | undefined> = {};
    delivery.items.forEach((orig, i) => {
      if (
        !isPositiveQuantity(
          cleanQuantityInput(lines[i]!.quantity),
          units.decimalsOf(orig.product.unitKey),
        )
      )
        found[`items.${orig.id}.quantity`] = tc('quantityInvalid');
    });
    const patch = build();
    if (Object.keys(patch).length && reasonError(reason)) found.reason = tc('reasonNeeded');
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    if (Object.keys(patch).length === 0) return setFormError(tc('nothing'));

    inFlight.current = true;
    try {
      await correct.mutateAsync({ id: delivery.id, patch });
      onDone(t('correct.done'));
    } catch (cause) {
      const split = errorMessage.split(cause, [
        'deliveryDate',
        'transportReference',
        'note',
        'reason',
        ...delivery.items.map((i) => `items.${i.id}.quantity`),
      ]);
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
      title={t('correct.title', { code: delivery.code })}
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-fg-muted">{t('correct.intro')}</p>
        <FormError message={formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={fid('date')} label={t('deliveryDate')} error={errors.deliveryDate}>
            <input
              id={fid('date')}
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={Boolean(errors.deliveryDate) || undefined}
              aria-describedby={describedBy(fid('date'), { error: Boolean(errors.deliveryDate) })}
              className={inputClass}
            />
          </Field>
          <TextInput
            id={fid('transport')}
            label={t('transportReference')}
            value={transport}
            onChange={setTransport}
            error={errors.transportReference}
            maxLength={SALES_LIMITS.transportReference}
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

        <ul className="space-y-3">
          {delivery.items.map((item, i) => {
            const key = `items.${item.id}.quantity`;
            return (
              <li key={item.id} className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">
                  <ProductName product={item.product} name={nameOf(item.product)} />
                </p>
                <Field
                  id={fid(`q${i}`)}
                  label={tc('quantityWithUnit', { unit: units.nameOf(item.product.unitKey) })}
                  error={errors[key]}
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
                    aria-invalid={Boolean(errors[key]) || undefined}
                    aria-describedby={errors[key] ? `${fid(`q${i}`)}-error` : undefined}
                    className={inputClass}
                  />
                </Field>
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
            {correct.isPending ? tc('saving') : t('correct.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
