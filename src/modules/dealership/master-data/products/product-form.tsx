'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { useErrorMessage } from '@/core/api/field-errors';
import { useCan } from '@/core/auth/can';
import { localizedName } from '@/core/auth/types';
import { MONEY_PATTERN, cleanMoneyInput, sameMoney } from '@/core/lib/money';
import { Button } from '@/core/ui/button';
import { Field, inputClass } from '@/core/ui/text-field';
import { useCategories, useSaveProduct, useUnits, type ProductInput } from '../api';
import {
  MoneyInput,
  ReasonInput,
  SensitiveSection,
  TextInput,
  reasonError,
} from '../shared/fields';
import { CategoryDialog } from '../categories/category-dialog';
import { FormError, ListSkeleton } from '../shared/states';
import { LIMITS, type Category, type Product } from '../types';

const FIELDS = ['categoryId', 'nameEn', 'nameBn', 'unitKey', 'purchasePrice', 'reason'] as const;
type FieldName = (typeof FIELDS)[number];

/**
 * Create (no `product`) or edit a product. Rules from jesan-api DTOs: names 1–120 characters,
 * money up to 12 digits and 2 decimals as a string. On edit only changed fields are sent; price
 * changes need `product.price.edit` and a reason (owner level), otherwise prices are read-only.
 */
export function ProductForm({
  slug,
  businessId,
  product,
}: {
  slug: string;
  businessId: string;
  product?: Product;
}) {
  const t = useTranslations('dealership');
  const errorMessage = useErrorMessage();
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const canSeeCost = useCan('product.cost.view');
  const canEditPrice = useCan('product.price.edit');
  const canManage = useCan('product.manage');
  const [creatingCategory, setCreatingCategory] = useState(false);
  // A category made from this form is shown at once, before the refreshed list arrives.
  const [madeHere, setMadeHere] = useState<Category[]>([]);
  const categories = useCategories(slug, businessId, 'true');
  const units = useUnits(slug, businessId);
  const save = useSaveProduct(slug, businessId);
  const isEdit = Boolean(product);
  const pricesEditable = !isEdit || canEditPrice;
  // Purchase price: only with cost permission, and only if the API sent it (edit).
  const showCost = canSeeCost && (!product || 'purchasePrice' in product);

  const [values, setValues] = useState({
    categoryId: product?.category.id ?? '',
    nameEn: product?.nameEn ?? '',
    nameBn: product?.nameBn ?? '',
    unitKey: product?.unitKey ?? '',
    purchasePrice: product?.purchasePrice ?? '',
    reason: '',
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const set = (field: keyof typeof values) => (value: string) =>
    setValues((v) => ({ ...v, [field]: value }));

  const unitKey = values.unitKey || units.data?.defaultUnitKey || '';
  // On edit the current category stays selectable even if it has been deactivated since.
  const categoryOptions = useMemo(() => {
    const fetched = categories.data ?? [];
    const list = [...fetched, ...madeHere.filter((m) => !fetched.some((c) => c.id === m.id))];
    if (product && !list.some((c) => c.id === product.category.id)) {
      return [{ ...product.category, id: product.category.id }, ...list];
    }
    return list;
  }, [categories.data, madeHere, product]);

  // Products have no sale price (set per sale on the invoice); the only price is the purchase price.
  const priceChanged =
    isEdit && showCost && !sameMoney(cleanMoneyInput(values.purchasePrice), product?.purchasePrice);

  /** The body to send: everything on create; only real changes on edit. */
  const buildBody = (): ProductInput => {
    const nameEn = values.nameEn.trim();
    const nameBn = values.nameBn.trim();
    const cost = cleanMoneyInput(values.purchasePrice);
    if (!product) {
      const body: ProductInput = {
        categoryId: values.categoryId,
        nameEn,
        nameBn,
      };
      if (unitKey) body.unitKey = unitKey;
      if (showCost && cost) body.purchasePrice = cost;
      return body;
    }
    const body: ProductInput = {};
    if (values.categoryId !== product.category.id) body.categoryId = values.categoryId;
    if (nameEn !== product.nameEn) body.nameEn = nameEn;
    if (nameBn !== product.nameBn) body.nameBn = nameBn;
    if (unitKey && unitKey !== product.unitKey) body.unitKey = unitKey;
    if (canEditPrice) {
      if (showCost && !sameMoney(cost, product.purchasePrice)) {
        body.purchasePrice = cost;
        body.reason = values.reason.trim();
      }
    }
    return body;
  };

  const validate = (): Partial<Record<FieldName, string>> => {
    const found: Partial<Record<FieldName, string>> = {};
    if (!values.categoryId) found.categoryId = t('common.required');
    if (!values.nameEn.trim()) found.nameEn = t('common.required');
    if (!values.nameBn.trim()) found.nameBn = t('common.required');
    if (pricesEditable) {
      const cost = cleanMoneyInput(values.purchasePrice);
      if (showCost && cost && !MONEY_PATTERN.test(cost))
        found.purchasePrice = t('common.moneyInvalid');
      if (showCost && isEdit && !cost) found.purchasePrice = t('common.required');
    }
    if (priceChanged && canEditPrice && reasonError(values.reason)) {
      found.reason = t('common.reasonRequired');
    }
    return found;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found = validate();
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;
    const body = buildBody();
    if (product && Object.keys(body).length === 0) {
      setServerError(t('common.nothingToChange'));
      return;
    }

    inFlight.current = true;
    try {
      const saved = await save.mutateAsync({ id: product?.id, body });
      router.push(
        `/b/${encodeURIComponent(slug)}/products/${saved.id}?saved=${product ? 'updated' : 'created'}`,
      );
    } catch (error) {
      // By the API's stable code (docs/API.md §11): duplicate name, inactive category, unknown
      // unit and the like appear under their own field; anything else above the form.
      const split = errorMessage.split(error, FIELDS);
      setErrors(split.fields);
      setServerError(split.form);
      inFlight.current = false;
    }
  };

  if (categories.isPending || units.isPending) return <ListSkeleton rows={4} />;
  const noCategory = !product && categoryOptions.length === 0;

  return (
    <>
      <form noValidate onSubmit={onSubmit} className="max-w-2xl space-y-5">
        <FormError
          message={
            serverError ?? (noCategory && !canManage ? t('products.noActiveCategory') : null)
          }
        />

        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Field id={`${id}-category`} label={t('products.category')} error={errors.categoryId}>
              <select
                id={`${id}-category`}
                value={values.categoryId}
                onChange={(e) => set('categoryId')(e.target.value)}
                required
                aria-invalid={Boolean(errors.categoryId) || undefined}
                aria-describedby={errors.categoryId ? `${id}-category-error` : undefined}
                className={inputClass}
              >
                <option value="" disabled>
                  {t('products.category')}
                </option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {localizedName(c, locale)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {canManage ? (
            <Button variant="secondary" onClick={() => setCreatingCategory(true)} className="mt-7">
              {t('categories.newInline')}
            </Button>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput
            id={`${id}-en`}
            label={t('common.nameEn')}
            value={values.nameEn}
            onChange={set('nameEn')}
            error={errors.nameEn}
            maxLength={LIMITS.name}
            required
          />
          <TextInput
            id={`${id}-bn`}
            label={t('common.nameBn')}
            value={values.nameBn}
            onChange={set('nameBn')}
            error={errors.nameBn}
            maxLength={LIMITS.name}
            required
          />
        </div>

        <Field id={`${id}-unit`} label={t('products.unit')} error={errors.unitKey}>
          <select
            id={`${id}-unit`}
            value={unitKey}
            onChange={(e) => set('unitKey')(e.target.value)}
            aria-invalid={Boolean(errors.unitKey) || undefined}
            aria-describedby={errors.unitKey ? `${id}-unit-error` : undefined}
            className={inputClass}
          >
            {(units.data?.items ?? []).map((u) => (
              <option key={u.key} value={u.key}>
                {localizedName(u, locale)}
              </option>
            ))}
          </select>
        </Field>

        {!showCost ? null : isEdit ? (
          <SensitiveSection editable={canEditPrice}>
            <PriceFields
              id={id}
              values={values}
              set={set}
              errors={errors}
              readOnly={!canEditPrice}
            />
            {canEditPrice && priceChanged ? (
              <ReasonInput
                id={`${id}-reason`}
                value={values.reason}
                onChange={set('reason')}
                error={errors.reason}
              />
            ) : null}
          </SensitiveSection>
        ) : (
          <PriceFields id={id} values={values} set={set} errors={errors} readOnly={false} />
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="submit"
            size="lg"
            disabled={save.isPending || noCategory}
            aria-busy={save.isPending}
          >
            {save.isPending ? t('common.saving') : isEdit ? t('common.save') : t('common.create')}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => router.back()}
            disabled={save.isPending}
          >
            {t('common.cancel')}
          </Button>
        </div>
      </form>
      {creatingCategory ? (
        <CategoryDialog
          category={null}
          onClose={() => setCreatingCategory(false)}
          onSaved={(_message, created) => {
            setMadeHere((list) => [...list, created]);
            setValues((v) => ({ ...v, categoryId: created.id }));
            setErrors((e) => ({ ...e, categoryId: undefined }));
          }}
          slug={slug}
          businessId={businessId}
        />
      ) : null}
    </>
  );
}

/** Only the purchase price (shown only with `product.cost.view` and when the API sent it). */
function PriceFields({
  id,
  values,
  set,
  errors,
  readOnly,
}: {
  id: string;
  values: { purchasePrice: string };
  set: (field: 'purchasePrice') => (value: string) => void;
  errors: Partial<Record<FieldName, string>>;
  readOnly: boolean;
}) {
  const t = useTranslations('dealership');
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <MoneyInput
        id={`${id}-cost`}
        label={t('products.purchasePrice')}
        value={values.purchasePrice}
        onChange={set('purchasePrice')}
        error={errors.purchasePrice}
        readOnly={readOnly}
      />
    </div>
  );
}
