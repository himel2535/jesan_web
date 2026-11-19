'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { newIdempotencyKey } from '@/core/approvals/api';
import { useErrorMessage } from '@/core/api/field-errors';
import { useCan } from '@/core/auth/can';
import { businessToday } from '@/core/i18n/format';
import { useFormat } from '@/core/i18n/use-format';
import { MONEY_PATTERN, cleanMoneyInput, multiplyMoney, sumMoney } from '@/core/lib/money';
import { cleanQuantityInput, isPositiveQuantity, sumQuantity } from '@/core/lib/quantity';
import { Button } from '@/core/ui/button';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { useNameOf } from '../../master-data/shared/display';
import { TextInput } from '../../master-data/shared/fields';
import { FormError } from '../../master-data/shared/states';
import type { Customer, Product } from '../../master-data/types';
import { ProductPicker } from '../../purchases/product-picker';
import { useCollectionMethods, useCreateCollection, useCreateOrder } from '../api';
import { FormSkeleton } from '../skeletons';
import { CustomerPicker, ProductName, useMethodLabel, useUnitInfo } from '../shared';
import {
  DELIVERY_WINDOWS,
  SALES_LIMITS,
  type CollectionInput,
  type DeliveryWindow,
  type OrderInput,
} from '../types';

interface Line {
  product: Pick<Product, 'id' | 'code' | 'nameEn' | 'nameBn' | 'unitKey'>;
  quantity: string;
  unitPrice: string;
}

type Errors = Record<string, string | undefined>;

/**
 * New order (`sale.create`). The price is typed per order line and is never compared with the
 * purchase price: selling below cost raises no warning (proposal). Line totals and the grand
 * total are shown for checking only, with exact decimal maths on strings.
 *
 * An advance can be collected in the same form (`collection.create`): the API has no single
 * call for both, so the order is saved first and the collection second. If the collection
 * fails the order stays and the detail page says so — safer than risking a double entry.
 */
export function OrderForm({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.sales.orders');
  const tf = useTranslations('dealership.sales.orders.form');
  const tc = useTranslations('dealership.sales.common');
  const ts = useTranslations('dealership.sales');
  const tcol = useTranslations('dealership.sales.collections');
  const format = useFormat();
  const nameOf = useNameOf();
  const router = useRouter();
  const id = useId();
  const errorMessage = useErrorMessage();
  const units = useUnitInfo(slug, businessId);
  const methodLabel = useMethodLabel();
  const canCollect = useCan('collection.create');
  const methods = useCollectionMethods(slug, businessId, canCollect);
  const create = useCreateOrder(slug, businessId);
  const collect = useCreateCollection(slug, businessId);
  const [orderKey] = useState(newIdempotencyKey);
  const [collectionKey] = useState(newIdempotencyKey);
  const inFlight = useRef(false);
  const today = useMemo(() => businessToday(), []);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [date, setDate] = useState(today);
  const [window, setWindow] = useState<DeliveryWindow>('two_days');
  const [deliverBy, setDeliverBy] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');
  const [takeAdvance, setTakeAdvance] = useState(false);
  const [advance, setAdvance] = useState('');
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const lineTotals = lines.map((l) =>
    multiplyMoney(cleanQuantityInput(l.quantity), cleanMoneyInput(l.unitPrice)),
  );
  const grandTotal =
    lines.length > 0 && lineTotals.every((v) => v !== null)
      ? sumMoney(lineTotals as string[])
      : null;
  const totalQuantity = lines.every((l) =>
    isPositiveQuantity(cleanQuantityInput(l.quantity), units.decimalsOf(l.product.unitKey)),
  )
    ? sumQuantity(lines.map((l) => cleanQuantityInput(l.quantity)))
    : null;

  const setLine = (index: number, change: Partial<Line>) =>
    setLines((all) => all.map((l, i) => (i === index ? { ...l, ...change } : l)));

  const chosenMethod = method || methods.data?.[0] || '';

  const validate = (): Errors => {
    const found: Errors = {};
    if (!customer) found.customerId = tf('customerRequired');
    if (!date) found.orderDate = tc('required');
    if (lines.length === 0) found.lines = tf('noLines');
    if (lines.length > SALES_LIMITS.lines) found.lines = tf('tooManyLines');
    lines.forEach((l, i) => {
      if (!isPositiveQuantity(cleanQuantityInput(l.quantity), units.decimalsOf(l.product.unitKey)))
        found[`items.${i}.quantity`] = tc('quantityInvalid');
      if (!MONEY_PATTERN.test(cleanMoneyInput(l.unitPrice)))
        found[`items.${i}.unitPrice`] = tc('priceInvalid');
    });
    if (takeAdvance) {
      const amount = cleanMoneyInput(advance);
      if (!MONEY_PATTERN.test(amount) || !/[1-9]/.test(amount))
        found.amount = tcol('amountInvalid');
      if (!chosenMethod) found.method = tcol('methodRequired');
    }
    return found;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    const input: OrderInput = {
      customerId: customer!.id,
      deliveryWindow: window,
      orderDate: date,
      items: lines.map((l) => ({
        productId: l.product.id,
        quantity: cleanQuantityInput(l.quantity),
        unitPrice: cleanMoneyInput(l.unitPrice),
      })),
    };
    if (deliverBy) input.deliverBy = deliverBy;
    if (note.trim()) input.note = note.trim();

    inFlight.current = true;
    const base = `/b/${encodeURIComponent(slug)}/sales`;
    let orderId: string;
    try {
      const saved = await create.mutateAsync({ input, idempotencyKey: orderKey });
      orderId = saved.id;
    } catch (error) {
      const fields = [
        'customerId',
        'orderDate',
        'deliveryWindow',
        'deliverBy',
        'note',
        ...lines.flatMap((_, i) => [
          `items.${i}.productId`,
          `items.${i}.quantity`,
          `items.${i}.unitPrice`,
        ]),
      ];
      const split = errorMessage.split(error, fields);
      setErrors(split.fields);
      setFormError(split.form);
      inFlight.current = false;
      return;
    }

    if (takeAdvance) {
      const collection: CollectionInput = {
        customerId: customer!.id,
        orderId,
        method: chosenMethod,
        amount: cleanMoneyInput(advance),
      };
      if (reference.trim()) collection.reference = reference.trim();
      try {
        await collect.mutateAsync({ input: collection, idempotencyKey: collectionKey });
      } catch (error) {
        // The order is saved; say exactly what failed instead of risking a second attempt.
        const reason = errorMessage.message(error);
        router.push(
          `${base}/${orderId}?saved=created-no-advance&reason=${encodeURIComponent(reason)}`,
        );
        return;
      }
    }
    router.push(`${base}/${orderId}?saved=created`);
  };

  if (units.isPending) return <FormSkeleton />;
  const fid = (key: string) => `${id}-${key}`;
  const pending = create.isPending || collect.isPending;

  return (
    <form noValidate onSubmit={onSubmit} className="max-w-4xl space-y-6">
      <FormError message={formError} />

      <section className="space-y-3" aria-labelledby={fid('customer-heading')}>
        <h2 id={fid('customer-heading')} className="text-base font-semibold">
          {tf('customer')}
        </h2>
        {customer ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-medium">
              <span className="font-mono text-xs text-fg-muted">{customer.code}</span>{' '}
              {nameOf(customer)}
            </p>
            <Button variant="secondary" onClick={() => setCustomer(null)} disabled={pending}>
              {tf('changeCustomer')}
            </Button>
          </div>
        ) : (
          <div className="max-w-xl">
            {/* Only active customers: no new order for an inactive one (API §11). */}
            <CustomerPicker
              slug={slug}
              businessId={businessId}
              label={tf('customer')}
              active="true"
              onPick={(c) => {
                setCustomer(c);
                setErrors((e) => ({ ...e, customerId: undefined }));
              }}
            />
          </div>
        )}
        {errors.customerId ? (
          <p className="text-sm font-medium text-danger" role="alert">
            {errors.customerId}
          </p>
        ) : null}
      </section>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          id={fid('date')}
          label={t('orderDate')}
          hint={tf('dateHint')}
          error={errors.orderDate}
        >
          <input
            id={fid('date')}
            type="date"
            required
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={Boolean(errors.orderDate) || undefined}
            aria-describedby={describedBy(fid('date'), {
              hint: true,
              error: Boolean(errors.orderDate),
            })}
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
                {ts(`window.${w}`)}
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
            aria-describedby={describedBy(fid('deliverBy'), { error: Boolean(errors.deliverBy) })}
            className={inputClass}
          />
        </Field>
      </div>

      <section className="space-y-3" aria-labelledby={fid('lines')}>
        <h2 id={fid('lines')} className="text-base font-semibold">
          {t('detail.items')}
        </h2>
        {errors.lines ? (
          <p className="text-sm font-medium text-danger" role="alert">
            {errors.lines}
          </p>
        ) : null}
        {lines.length > 0 ? (
          <ul className="space-y-3">
            {lines.map((line, i) => {
              const name = nameOf(line.product);
              const decimals = units.decimalsOf(line.product.unitKey);
              const qtyError = errors[`items.${i}.quantity`];
              const priceError = errors[`items.${i}.unitPrice`];
              return (
                <li
                  key={line.product.id}
                  className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-start"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-fg-muted">{tc('product')}</p>
                    <p className="font-medium">
                      <ProductName
                        product={{ ...line.product, nameBn: line.product.nameBn }}
                        name={name}
                      />
                    </p>
                  </div>
                  <Field
                    id={fid(`q${i}`)}
                    label={tc('quantityWithUnit', { unit: units.nameOf(line.product.unitKey) })}
                    error={qtyError}
                  >
                    <input
                      id={fid(`q${i}`)}
                      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
                      autoComplete="off"
                      value={line.quantity}
                      onChange={(e) => setLine(i, { quantity: e.target.value })}
                      aria-invalid={Boolean(qtyError) || undefined}
                      aria-describedby={qtyError ? `${fid(`q${i}`)}-error` : undefined}
                      className={inputClass}
                    />
                  </Field>
                  <Field id={fid(`p${i}`)} label={tc('unitPrice')} error={priceError}>
                    <input
                      id={fid(`p${i}`)}
                      inputMode="decimal"
                      autoComplete="off"
                      value={line.unitPrice}
                      onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                      aria-invalid={Boolean(priceError) || undefined}
                      aria-describedby={priceError ? `${fid(`p${i}`)}-error` : undefined}
                      className={inputClass}
                    />
                  </Field>
                  <div className="sm:text-right">
                    <p className="text-sm text-fg-muted">{tc('lineTotal')}</p>
                    <p className="min-h-10 py-2 font-semibold tabular-nums" aria-live="polite">
                      {lineTotals[i] !== null ? format.money(lineTotals[i]!) : '—'}
                    </p>
                  </div>
                  <div className="sm:pt-6">
                    <Button
                      variant="ghost"
                      onClick={() => setLines((all) => all.filter((_, j) => j !== i))}
                      aria-label={tf('remove', { name })}
                      disabled={pending}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {lines.length < SALES_LIMITS.lines ? (
          <div className="max-w-xl">
            <ProductPicker
              slug={slug}
              businessId={businessId}
              label={tf('addProduct')}
              excludeIds={lines.map((l) => l.product.id)}
              onPick={(product) => {
                setLines((all) => [...all, { product, quantity: '', unitPrice: '' }]);
                setErrors((e) => ({ ...e, lines: undefined }));
              }}
            />
          </div>
        ) : null}

        <dl className="grid gap-x-6 gap-y-1 rounded-card border border-border bg-surface p-4 sm:grid-cols-[auto_1fr]">
          <dt className="text-sm text-fg-muted">{tc('totalQuantity')}</dt>
          <dd className="font-semibold tabular-nums">
            {totalQuantity !== null && lines.length > 0 ? format.quantity(totalQuantity) : '—'}
          </dd>
          <dt className="text-sm text-fg-muted">{tf('grandTotal')}</dt>
          <dd className="text-lg font-bold tabular-nums">
            {grandTotal !== null ? format.money(grandTotal) : '—'}
          </dd>
        </dl>
      </section>

      <TextInput
        id={fid('note')}
        label={tc('note')}
        value={note}
        onChange={setNote}
        error={errors.note}
        maxLength={SALES_LIMITS.note}
      />

      {canCollect ? (
        <fieldset className="space-y-4 rounded-card border border-border p-4">
          <legend className="px-1 text-sm font-semibold">{tf('advanceTitle')}</legend>
          <label className="flex min-h-10 items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="size-5"
              checked={takeAdvance}
              onChange={(e) => setTakeAdvance(e.target.checked)}
            />
            {tf('advanceToggle')}
          </label>
          <p className="text-sm text-fg-muted">{tf('advanceHint')}</p>
          {takeAdvance ? (
            <div className="grid gap-5 sm:grid-cols-3">
              <Field id={fid('amount')} label={tc('amount')} error={errors.amount}>
                <input
                  id={fid('amount')}
                  inputMode="decimal"
                  autoComplete="off"
                  value={advance}
                  onChange={(e) => setAdvance(e.target.value)}
                  aria-invalid={Boolean(errors.amount) || undefined}
                  aria-describedby={errors.amount ? `${fid('amount')}-error` : undefined}
                  className={inputClass}
                />
              </Field>
              <Field id={fid('method')} label={tcol('method')} error={errors.method}>
                <select
                  id={fid('method')}
                  value={chosenMethod}
                  onChange={(e) => setMethod(e.target.value)}
                  className={inputClass}
                >
                  {(methods.data ?? []).map((m) => (
                    <option key={m} value={m}>
                      {methodLabel(m)}
                    </option>
                  ))}
                </select>
              </Field>
              <TextInput
                id={fid('reference')}
                label={tcol('reference')}
                value={reference}
                onChange={setReference}
                error={errors.reference}
                maxLength={SALES_LIMITS.reference}
              />
            </div>
          ) : null}
        </fieldset>
      ) : null}

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
