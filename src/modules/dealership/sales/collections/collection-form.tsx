'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { newIdempotencyKey } from '@/core/approvals/api';
import { useErrorMessage } from '@/core/api/field-errors';
import { businessToday } from '@/core/i18n/format';
import { MONEY_PATTERN, cleanMoneyInput } from '@/core/lib/money';
import { Button } from '@/core/ui/button';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { useCustomer } from '../../master-data/api';
import { useNameOf } from '../../master-data/shared/display';
import { TextInput } from '../../master-data/shared/fields';
import { FormError } from '../../master-data/shared/states';
import type { Customer } from '../../master-data/types';
import { useCollectionMethods, useCreateCollection, useOrders } from '../api';
import { FormSkeleton } from '../skeletons';
import { CustomerPicker, useMethodLabel } from '../shared';
import { SALES_LIMITS, type CollectionInput } from '../types';

type Errors = Record<string, string | undefined>;

/**
 * Take money from a customer (`collection.create`). An order can be named as a reference, but
 * money is never allocated to one (docs/API.md §11); collecting more than is due is allowed
 * and simply turns the balance into an advance. Inactive customers may still pay, so the
 * picker shows them too (step-5b decision 8).
 */
export function CollectionForm({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.sales.collections');
  const tc = useTranslations('dealership.sales.common');
  const tf = useTranslations('dealership.sales.orders.form');
  const params = useSearchParams();
  const id = useId();
  const router = useRouter();
  const nameOf = useNameOf();
  const methodLabel = useMethodLabel();
  const errorMessage = useErrorMessage();
  const presetCustomerId = params.get('customerId') ?? '';
  const presetOrderId = params.get('orderId') ?? '';
  const preset = useCustomer(slug, businessId, presetCustomerId, Boolean(presetCustomerId));
  const methods = useCollectionMethods(slug, businessId);
  const create = useCreateCollection(slug, businessId);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const inFlight = useRef(false);
  const today = useMemo(() => businessToday(), []);

  const [picked, setPicked] = useState<Customer | null>(null);
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [orderId, setOrderId] = useState(presetOrderId);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const customer = picked ?? (presetCustomerId ? (preset.data ?? null) : null);
  // Only this customer's open orders can be named, and only once one is chosen.
  const orders = useOrders(
    slug,
    businessId,
    { customerId: customer?.id, status: 'open', page: 1 },
    Boolean(customer),
  );
  const chosenMethod = method || methods.data?.[0] || '';

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found: Errors = {};
    if (!customer) found.customerId = tf('customerRequired');
    const clean = cleanMoneyInput(amount);
    if (!MONEY_PATTERN.test(clean) || !/[1-9]/.test(clean)) found.amount = t('amountInvalid');
    if (!chosenMethod) found.method = t('methodRequired');
    if (!date) found.collectionDate = tc('required');
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    const input: CollectionInput = {
      customerId: customer!.id,
      method: chosenMethod,
      amount: clean,
      collectionDate: date,
    };
    if (orderId) input.orderId = orderId;
    if (reference.trim()) input.reference = reference.trim();
    if (note.trim()) input.note = note.trim();

    inFlight.current = true;
    try {
      const saved = await create.mutateAsync({ input, idempotencyKey });
      router.push(`/b/${encodeURIComponent(slug)}/collections/${saved.id}?saved=created`);
    } catch (cause) {
      const split = errorMessage.split(cause, [
        'customerId',
        'orderId',
        'method',
        'amount',
        'collectionDate',
        'reference',
        'note',
      ]);
      setErrors(split.fields);
      setFormError(split.form);
      inFlight.current = false;
    }
  };

  if (methods.isPending || (presetCustomerId && preset.isPending)) return <FormSkeleton />;
  const fid = (key: string) => `${id}-${key}`;
  const pending = create.isPending;

  return (
    <form noValidate onSubmit={onSubmit} className="max-w-3xl space-y-6">
      <FormError message={formError} />

      <section className="space-y-3" aria-labelledby={fid('customer-heading')}>
        <h2 id={fid('customer-heading')} className="text-base font-semibold">
          {tc('customer')}
        </h2>
        {customer ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-medium">
              <span className="font-mono text-xs text-fg-muted">{customer.code}</span>{' '}
              {nameOf(customer)}
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setPicked(null);
                setOrderId('');
                router.replace(`/b/${encodeURIComponent(slug)}/collections/new`);
              }}
              disabled={pending}
            >
              {tf('changeCustomer')}
            </Button>
          </div>
        ) : (
          <div className="max-w-xl">
            {/* Inactive customers may still pay off an older order (API §11). */}
            <CustomerPicker
              slug={slug}
              businessId={businessId}
              label={tc('customer')}
              active="all"
              onPick={(c) => {
                setPicked(c);
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={fid('amount')} label={tc('amount')} hint={t('advance')} error={errors.amount}>
          <input
            id={fid('amount')}
            inputMode="decimal"
            autoComplete="off"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={Boolean(errors.amount) || undefined}
            aria-describedby={describedBy(fid('amount'), {
              hint: true,
              error: Boolean(errors.amount),
            })}
            className={inputClass}
          />
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
        <Field
          id={fid('order')}
          label={t('againstOrder')}
          hint={t('againstOrderHint')}
          error={errors.orderId}
        >
          <select
            id={fid('order')}
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            disabled={!customer}
            aria-describedby={describedBy(fid('order'), {
              hint: true,
              error: Boolean(errors.orderId),
            })}
            className={inputClass}
          >
            <option value="">{t('againstOrderNone')}</option>
            {(orders.data?.items ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.code}
              </option>
            ))}
          </select>
        </Field>
        <TextInput
          id={fid('reference')}
          label={t('reference')}
          hint={t('referenceHint')}
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
