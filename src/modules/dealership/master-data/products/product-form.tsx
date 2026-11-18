'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { apiErrorKind } from '@/core/api/error-kind';
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

type FieldName =
  'categoryId' | 'nameEn' | 'nameBn' | 'purchasePrice' | 'defaultSalePrice' | 'reason';

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
    defaultSalePrice: product?.defaultSalePrice ?? '',
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

  const priceChanged =
    isEdit &&
    (!sameMoney(cleanMoneyInput(values.defaultSalePrice), product?.defaultSalePrice) ||
      (showCost && !sameMoney(cleanMoneyInput(values.purchasePrice), product?.purchasePrice)));

  /** The body to send: everything on create; only real changes on edit. */
  const buildBody = (): ProductInput => {
    const nameEn = values.nameEn.trim();
    const nameBn = values.nameBn.trim();
    const sale = cleanMoneyInput(values.defaultSalePrice);
    const cost = cleanMoneyInput(values.purchasePrice);
    if (!product) {
      const body: ProductInput = {
        categoryId: values.categoryId,
        nameEn,
        nameBn,
        defaultSalePrice: sale,
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
      if (!sameMoney(sale, product.defaultSalePrice)) body.defaultSalePrice = sale;
      if (showCost && !sameMoney(cost, product.purchasePrice)) body.purchasePrice = cost;
      if (body.defaultSalePrice !== undefined || body.purchasePrice !== undefined) {
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
      const sale = cleanMoneyInput(values.defaultSalePrice);
      if (!sale) found.defaultSalePrice = t('common.required');
      else if (!MONEY_PATTERN.test(sale)) found.defaultSalePrice = t('common.moneyInvalid');
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
      const kind = apiErrorKind(error);
      if (kind === 'duplicate') setErrors({ nameEn: t('products.duplicate') });
      else setServerError(t(`common.error.${kind}`));
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

        <Field id={`${id}-unit`} label={t('products.unit')}>
          <select
            id={`${id}-unit`}
            value={unitKey}
            onChange={(e) => set('unitKey')(e.target.value)}
            className={inputClass}
          >
            {(units.data?.items ?? []).map((u) => (
              <option key={u.key} value={u.key}>
                {localizedName(u, locale)}
              </option>
            ))}
          </select>
        </Field>

        {isEdit ? (
          <SensitiveSection editable={canEditPrice}>
            <PriceFields
              id={id}
              values={values}
              set={set}
              errors={errors}
              showCost={showCost}
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
          <PriceFields
            id={id}
            values={values}
            set={set}
            errors={errors}
            showCost={showCost}
            readOnly={false}
          />
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

function PriceFields({
  id,
  values,
  set,
  errors,
  showCost,
  readOnly,
}: {
  id: string;
  values: { purchasePrice: string; defaultSalePrice: string };
  set: (field: 'purchasePrice' | 'defaultSalePrice') => (value: string) => void;
  errors: Partial<Record<FieldName, string>>;
  showCost: boolean;
  readOnly: boolean;
}) {
  const t = useTranslations('dealership');
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {showCost ? (
        <MoneyInput
          id={`${id}-cost`}
          label={t('products.purchasePrice')}
          value={values.purchasePrice}
          onChange={set('purchasePrice')}
          error={errors.purchasePrice}
          readOnly={readOnly}
        />
      ) : null}
      <MoneyInput
        id={`${id}-sale`}
        label={t('products.salePrice')}
        hint={t('products.salePriceHint')}
        value={values.defaultSalePrice}
        onChange={set('defaultSalePrice')}
        error={errors.defaultSalePrice}
        readOnly={readOnly}
        required
      />
    </div>
  );
}
