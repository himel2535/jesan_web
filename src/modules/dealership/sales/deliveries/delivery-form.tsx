'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { newIdempotencyKey } from '@/core/approvals/api';
import { useErrorMessage } from '@/core/api/field-errors';
import { businessToday } from '@/core/i18n/format';
import { useFormat } from '@/core/i18n/use-format';
import { cleanQuantityInput, isPositiveQuantity, sumQuantity } from '@/core/lib/quantity';
import { Button } from '@/core/ui/button';
import { EmptyState } from '@/core/ui/empty-state';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { useNameOf } from '../../master-data/shared/display';
import { TextInput } from '../../master-data/shared/fields';
import { FormError, LoadError } from '../../master-data/shared/states';
import { useCreateDelivery, useOrder } from '../api';
import { FormSkeleton } from '../skeletons';
import { ProductName, useSalesErrorMessage, useUnitInfo } from '../shared';
import { SALES_LIMITS, type DeliveryInput } from '../types';
import { PackageX } from 'lucide-react';

type Errors = Record<string, string | undefined>;

/**
 * Deliver against one order (`delivery.create`). Part of an order may go out: a line left
 * empty delivers nothing of it, and what is left is shown on every line. Stock, credit-limit
 * and "more than is left" errors land under the line that caused them, with the real numbers
 * the API sent.
 */
export function DeliveryForm({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.sales.deliveries');
  const tf = useTranslations('dealership.sales.deliveries.form');
  const tc = useTranslations('dealership.sales.common');
  const to = useTranslations('dealership.sales.orders');
  const format = useFormat();
  const nameOf = useNameOf();
  const router = useRouter();
  const id = useId();
  const orderId = useSearchParams().get('orderId') ?? '';
  const errorMessage = useErrorMessage();
  const salesError = useSalesErrorMessage();
  const units = useUnitInfo(slug, businessId);
  const order = useOrder(slug, businessId, orderId);
  const create = useCreateDelivery(slug, businessId);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const inFlight = useRef(false);
  const today = useMemo(() => businessToday(), []);

  const [date, setDate] = useState(today);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [transport, setTransport] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (!orderId) {
    return <EmptyState icon={PackageX} title={t('newTitle')} description={tf('orderRequired')} />;
  }
  if (order.isPending || units.isPending) return <FormSkeleton />;
  if (order.isError) return <LoadError error={order.error} onRetry={() => void order.refetch()} />;

  const o = order.data;
  const open = o.items.filter((i) => i.remainingQuantity !== '0');
  const typed = o.items
    .map((i) => ({ item: i, value: cleanQuantityInput(quantities[i.id] ?? '') }))
    .filter((l) => l.value !== '');
  const totalQuantity = typed.every((l) =>
    isPositiveQuantity(l.value, units.decimalsOf(l.item.product.unitKey)),
  )
    ? sumQuantity(typed.map((l) => l.value))
    : null;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found: Errors = {};
    if (!date) found.deliveryDate = tc('required');
    if (typed.length === 0) found.items = tf('noLines');
    for (const { item, value } of typed) {
      const key = `items.${item.id}.quantity`;
      if (!isPositiveQuantity(value, units.decimalsOf(item.product.unitKey)))
        found[key] = tc('quantityInvalid');
      // What is left is a plain decimal string on both sides: compare without floats.
      else if (moreThan(value, item.remainingQuantity)) found[key] = tf('tooLarge');
    }
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    const input: DeliveryInput = {
      orderId: o.id,
      deliveryDate: date,
      items: typed.map((l) => ({ orderItemId: l.item.id, quantity: l.value })),
    };
    if (transport.trim()) input.transportReference = transport.trim();
    if (note.trim()) input.note = note.trim();

    inFlight.current = true;
    try {
      const saved = await create.mutateAsync({ input, idempotencyKey });
      router.push(`/b/${encodeURIComponent(slug)}/deliveries/${saved.id}?saved=created`);
    } catch (cause) {
      // The API numbers delivery lines by their position in the request, not by order-item id.
      const indexed = typed.map((l, i) => ({ key: `items.${i}.quantity`, id: l.item.id }));
      const split = errorMessage.split(cause, [
        'deliveryDate',
        'transportReference',
        'note',
        'items',
        ...indexed.map((x) => x.key),
        ...indexed.map((x) => `items.${x.id}.quantity`),
      ]);
      const fields: Errors = {};
      let formMessage = split.form;
      for (const [key, message] of Object.entries(split.fields)) {
        const hit = indexed.find((x) => x.key === key);
        const line = hit ? typed.find((l) => l.item.id === hit.id) : undefined;
        const detailed = salesError(cause, line ? units.nameOf(line.item.product.unitKey) : '');
        fields[hit ? `items.${hit.id}.quantity` : key] = detailed ?? message;
      }
      if (Object.keys(fields).length === 0) formMessage = salesError(cause) ?? split.form;
      setErrors(fields);
      setFormError(formMessage);
      inFlight.current = false;
    }
  };

  const fid = (key: string) => `${id}-${key}`;
  const pending = create.isPending;

  return (
    <form noValidate onSubmit={onSubmit} className="max-w-4xl space-y-6">
      <FormError message={formError} />
      <p className="text-sm text-fg-muted">{tf('intro')}</p>
      <dl className="grid gap-x-6 gap-y-1 rounded-card border border-border bg-surface p-4 sm:grid-cols-[auto_1fr]">
        <dt className="text-sm text-fg-muted">{tc('order')}</dt>
        <dd className="font-mono font-medium">{o.code}</dd>
        <dt className="text-sm text-fg-muted">{tc('customer')}</dt>
        <dd className="font-medium">{nameOf(o.customer)}</dd>
      </dl>

      <Field id={fid('date')} label={t('deliveryDate')} error={errors.deliveryDate}>
        <input
          id={fid('date')}
          type="date"
          required
          max={today}
          min={o.orderDate}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={Boolean(errors.deliveryDate) || undefined}
          aria-describedby={describedBy(fid('date'), { error: Boolean(errors.deliveryDate) })}
          className={inputClass}
        />
      </Field>

      <section className="space-y-3" aria-labelledby={fid('lines')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={fid('lines')} className="text-base font-semibold">
            {to('detail.items')}
          </h2>
          {open.length > 0 ? (
            <Button
              variant="secondary"
              onClick={() =>
                setQuantities(Object.fromEntries(open.map((i) => [i.id, i.remainingQuantity])))
              }
              disabled={pending}
            >
              {tf('fillAll')}
            </Button>
          ) : null}
        </div>
        {errors.items ? (
          <p className="text-sm font-medium text-danger" role="alert">
            {errors.items}
          </p>
        ) : null}
        {open.length === 0 ? (
          <p className="text-sm text-fg-muted">{tf('nothingLeft')}</p>
        ) : (
          <ul className="space-y-3">
            {open.map((item, i) => {
              const key = `items.${item.id}.quantity`;
              const decimals = units.decimalsOf(item.product.unitKey);
              return (
                <li
                  key={item.id}
                  className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-[minmax(0,2fr)_auto_minmax(0,1fr)] sm:items-start"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-fg-muted">{tc('product')}</p>
                    <p className="font-medium">
                      <ProductName product={item.product} name={nameOf(item.product)} />
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-sm text-fg-muted">{tf('remaining')}</p>
                    <p className="py-2 font-semibold tabular-nums">
                      {format.quantity(item.remainingQuantity)}{' '}
                      <span className="text-xs font-normal text-fg-muted">
                        {units.nameOf(item.product.unitKey)}
                      </span>
                    </p>
                  </div>
                  <Field
                    id={fid(`q${i}`)}
                    label={tc('quantityWithUnit', { unit: units.nameOf(item.product.unitKey) })}
                    error={errors[key]}
                  >
                    <input
                      id={fid(`q${i}`)}
                      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
                      autoComplete="off"
                      value={quantities[item.id] ?? ''}
                      onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: e.target.value }))}
                      aria-invalid={Boolean(errors[key]) || undefined}
                      aria-describedby={errors[key] ? `${fid(`q${i}`)}-error` : undefined}
                      className={inputClass}
                    />
                  </Field>
                </li>
              );
            })}
          </ul>
        )}
        <dl className="grid gap-x-6 gap-y-1 rounded-card border border-border bg-surface p-4 sm:grid-cols-[auto_1fr]">
          <dt className="text-sm text-fg-muted">{tc('totalQuantity')}</dt>
          <dd className="font-semibold tabular-nums" aria-live="polite">
            {totalQuantity !== null && typed.length > 0 ? format.quantity(totalQuantity) : '—'}
          </dd>
        </dl>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          id={fid('transport')}
          label={t('transportReference')}
          hint={t('transportReferenceHint')}
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

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" size="lg" disabled={pending || open.length === 0} aria-busy={pending}>
          {pending ? tc('saving') : tc('save')}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => router.back()} disabled={pending}>
          {tc('cancel')}
        </Button>
      </div>
    </form>
  );
}

/** `a > b` for two non-negative decimal strings, compared digit by digit (no floats). */
export function moreThan(a: string, b: string): boolean {
  const pad = (v: string) => {
    const [int = '0', frac = ''] = v.split('.');
    return { int: int.replace(/^0+(?=\d)/, ''), frac };
  };
  const x = pad(a);
  const y = pad(b);
  if (x.int.length !== y.int.length) return x.int.length > y.int.length;
  if (x.int !== y.int) return x.int > y.int;
  const width = Math.max(x.frac.length, y.frac.length);
  return x.frac.padEnd(width, '0') > y.frac.padEnd(width, '0');
}
