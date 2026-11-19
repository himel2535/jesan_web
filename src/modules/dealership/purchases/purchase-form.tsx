'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { newIdempotencyKey } from '@/core/approvals/api';
import { useErrorMessage } from '@/core/api/field-errors';
import { localizedName } from '@/core/auth/types';
import { businessToday } from '@/core/i18n/format';
import { useFormat } from '@/core/i18n/use-format';
import { MONEY_PATTERN, cleanMoneyInput, multiplyMoney, sumMoney } from '@/core/lib/money';
import { cleanQuantityInput, isPositiveQuantity, sumQuantity } from '@/core/lib/quantity';
import { Button } from '@/core/ui/button';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { useSuppliers, useUnits } from '../master-data/api';
import { useNameOf } from '../master-data/shared/display';
import { TextInput } from '../master-data/shared/fields';
import { FormError, ListSkeleton } from '../master-data/shared/states';
import type { Product } from '../master-data/types';
import { useCreatePurchase } from './api';
import { ProductPicker } from './product-picker';
import { PURCHASE_LIMITS, type PurchaseInput } from './types';

interface Line {
  product: Pick<Product, 'id' | 'code' | 'nameEn' | 'nameBn' | 'unitKey'>;
  quantity: string;
  unitPrice: string;
}

type Errors = Record<string, string | undefined>;

/**
 * New purchase (`purchase.create` + `product.cost.view`). Line totals and the grand total are
 * shown for checking only, with exact decimal math on strings; the server computes and stores
 * the real amounts. One Idempotency-Key per open form: a double click or a retry never creates
 * a second purchase. On failure everything typed stays.
 */
export function PurchaseForm({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.purchases');
  const locale = useLocale();
  const format = useFormat();
  const nameOf = useNameOf();
  const router = useRouter();
  const id = useId();
  const errorMessage = useErrorMessage();
  const units = useUnits(slug, businessId);
  const suppliers = useSuppliers(slug, businessId, { active: 'true', page: 1 });
  const create = useCreatePurchase(slug, businessId);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const inFlight = useRef(false);
  const today = useMemo(() => businessToday(), []);

  const [date, setDate] = useState(today);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Default supplier: the principal one (from data; no business name in code).
  const principal = suppliers.data?.items.find((s) => s.isPrincipal);
  const chosenSupplier = supplierId || principal?.id || '';

  const unitOf = (key: string) => units.data?.items.find((u) => u.key === key);
  const decimalsOf = (key: string) => unitOf(key)?.decimals ?? 0;
  const unitName = (key: string) => {
    const unit = unitOf(key);
    return unit ? localizedName(unit, locale) : key;
  };

  const lineTotals = lines.map((l) =>
    multiplyMoney(cleanQuantityInput(l.quantity), cleanMoneyInput(l.unitPrice)),
  );
  const grandTotal =
    lines.length > 0 && lineTotals.every((v) => v !== null)
      ? sumMoney(lineTotals as string[])
      : null;
  const totalQuantity = lines.every((l) =>
    isPositiveQuantity(cleanQuantityInput(l.quantity), decimalsOf(l.product.unitKey)),
  )
    ? sumQuantity(lines.map((l) => cleanQuantityInput(l.quantity)))
    : null;

  const setLine = (index: number, change: Partial<Line>) =>
    setLines((all) => all.map((l, i) => (i === index ? { ...l, ...change } : l)));

  const validate = (): Errors => {
    const found: Errors = {};
    if (!date) found.purchaseDate = t('form.required');
    if (lines.length === 0) found.lines = t('form.noLines');
    if (lines.length > PURCHASE_LIMITS.lines) found.lines = t('form.tooManyLines');
    lines.forEach((l, i) => {
      if (!isPositiveQuantity(cleanQuantityInput(l.quantity), decimalsOf(l.product.unitKey)))
        found[`items.${i}.quantity`] = t('form.quantityInvalid');
      if (!MONEY_PATTERN.test(cleanMoneyInput(l.unitPrice)))
        found[`items.${i}.unitPrice`] = t('form.priceInvalid');
    });
    return found;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    const input: PurchaseInput = {
      purchaseDate: date,
      items: lines.map((l) => ({
        productId: l.product.id,
        quantity: cleanQuantityInput(l.quantity),
        unitPrice: cleanMoneyInput(l.unitPrice),
      })),
    };
    if (chosenSupplier) input.supplierId = chosenSupplier;
    if (note.trim()) input.note = note.trim();
    if (reference.trim()) input.supplierReference = reference.trim();

    inFlight.current = true;
    try {
      const saved = await create.mutateAsync({ input, idempotencyKey });
      router.push(`/b/${encodeURIComponent(slug)}/purchases/${saved.id}?saved=created`);
    } catch (error) {
      // Field errors under their field (items.<n>.* under that line); everything typed stays.
      const fields = [
        'purchaseDate',
        'supplierId',
        'note',
        'supplierReference',
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
    }
  };

  if (units.isPending || suppliers.isPending) return <ListSkeleton rows={4} />;
  const fid = (key: string) => `${id}-${key}`;
  const pending = create.isPending;

  return (
    <form noValidate onSubmit={onSubmit} className="max-w-4xl space-y-6">
      <FormError message={formError} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={fid('date')}
          label={t('date')}
          hint={t('form.dateHint')}
          error={errors.purchaseDate}
        >
          <input
            id={fid('date')}
            type="date"
            required
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={Boolean(errors.purchaseDate) || undefined}
            aria-describedby={describedBy(fid('date'), {
              hint: true,
              error: Boolean(errors.purchaseDate),
            })}
            className={inputClass}
          />
        </Field>
        <Field id={fid('supplier')} label={t('supplier')} error={errors.supplierId}>
          <select
            id={fid('supplier')}
            value={chosenSupplier}
            onChange={(e) => setSupplierId(e.target.value)}
            aria-invalid={Boolean(errors.supplierId) || undefined}
            aria-describedby={errors.supplierId ? `${fid('supplier')}-error` : undefined}
            className={inputClass}
          >
            {(suppliers.data?.items ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.isPrincipal ? t('form.supplierPrincipal', { name: nameOf(s) }) : nameOf(s)}
              </option>
            ))}
          </select>
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
              const qtyError = errors[`items.${i}.quantity`];
              const priceError = errors[`items.${i}.unitPrice`];
              const productError = errors[`items.${i}.productId`];
              return (
                <li
                  key={line.product.id}
                  className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-start"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-fg-muted">{t('form.product')}</p>
                    <p className="font-medium">
                      <span className="font-mono text-xs text-fg-muted">{line.product.code}</span>{' '}
                      {name}
                    </p>
                    {productError ? (
                      <p className="text-sm font-medium text-danger">{productError}</p>
                    ) : null}
                  </div>
                  <Field
                    id={fid(`q${i}`)}
                    label={`${t('form.quantity')} (${unitName(line.product.unitKey)})`}
                    error={qtyError}
                  >
                    <input
                      id={fid(`q${i}`)}
                      inputMode={decimalsOf(line.product.unitKey) > 0 ? 'decimal' : 'numeric'}
                      autoComplete="off"
                      value={line.quantity}
                      onChange={(e) => setLine(i, { quantity: e.target.value })}
                      aria-invalid={Boolean(qtyError) || undefined}
                      aria-describedby={qtyError ? `${fid(`q${i}`)}-error` : undefined}
                      className={inputClass}
                    />
                  </Field>
                  <Field id={fid(`p${i}`)} label={t('form.unitPrice')} error={priceError}>
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
                    <p className="text-sm text-fg-muted">{t('form.lineTotal')}</p>
                    <p className="min-h-10 py-2 font-semibold tabular-nums" aria-live="polite">
                      {lineTotals[i] !== null ? format.money(lineTotals[i]!) : '—'}
                    </p>
                  </div>
                  <div className="sm:pt-6">
                    <Button
                      variant="ghost"
                      onClick={() => setLines((all) => all.filter((_, j) => j !== i))}
                      aria-label={t('form.remove', { name })}
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

        {lines.length < PURCHASE_LIMITS.lines ? (
          <div className="max-w-xl">
            <ProductPicker
              slug={slug}
              businessId={businessId}
              label={t('form.addProduct')}
              excludeIds={lines.map((l) => l.product.id)}
              onPick={(product) => {
                setLines((all) => [...all, { product, quantity: '', unitPrice: '' }]);
                setErrors((e) => ({ ...e, lines: undefined }));
              }}
            />
          </div>
        ) : null}

        <dl className="grid gap-x-6 gap-y-1 rounded-card border border-border bg-surface p-4 sm:grid-cols-[auto_1fr]">
          <dt className="text-sm text-fg-muted">{t('form.totalQuantity')}</dt>
          <dd className="font-semibold tabular-nums">
            {totalQuantity !== null && lines.length > 0 ? format.quantity(totalQuantity) : '—'}
          </dd>
          <dt className="text-sm text-fg-muted">{t('form.grandTotal')}</dt>
          <dd className="text-lg font-bold tabular-nums">
            {grandTotal !== null ? format.money(grandTotal) : '—'}
          </dd>
        </dl>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          id={fid('reference')}
          label={t('supplierReference')}
          hint={t('supplierReferenceHint')}
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
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? t('form.saving') : t('form.save')}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => router.back()} disabled={pending}>
          {t('form.cancel')}
        </Button>
      </div>
    </form>
  );
}
