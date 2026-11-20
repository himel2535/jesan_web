'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { useErrorMessage } from '@/core/api/field-errors';
import { useCan } from '@/core/auth/can';
import { localizedName } from '@/core/auth/types';
import { Button } from '@/core/ui/button';
import { Field, inputClass } from '@/core/ui/text-field';
import { useCategories, useSaveProduct, useUnits, type ProductInput } from '../api';
import { SensitiveSection, TextInput } from '../shared/fields';
import { CategoryDialog } from '../categories/category-dialog';
import { FormError, FormSkeleton, Notice } from '../shared/states';
import { useProductRequestTarget } from '../shared/correction';
import { RequestChangeButton } from '@/core/approvals/request-dialog';
import { LIMITS, type Category, type Product } from '../types';

const FIELDS = ['categoryId', 'nameEn', 'nameBn', 'unitKey'] as const;
type FieldName = (typeof FIELDS)[number];

/**
 * Create (no `product`) or edit a product. Rules from jesan-api DTOs: names 1–120 characters,
 * on edit only changed fields are sent. Products carry no hand-set price: the last purchase price
 * is read-only and comes from purchases. Deactivating lives on the detail page and the list.
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
  const canManage = useCan('product.manage');
  const [creatingCategory, setCreatingCategory] = useState(false);
  // A category made from this form is shown at once, before the refreshed list arrives.
  const [madeHere, setMadeHere] = useState<Category[]>([]);
  const categories = useCategories(slug, businessId, 'true');
  const units = useUnits(slug, businessId);
  const save = useSaveProduct(slug, businessId);
  const isEdit = Boolean(product);

  const [values, setValues] = useState({
    categoryId: product?.category.id ?? '',
    nameEn: product?.nameEn ?? '',
    nameBn: product?.nameBn ?? '',
    unitKey: product?.unitKey ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const requestTarget = useProductRequestTarget(product);
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

  /** The body to send: everything on create; only real changes on edit. */
  const buildBody = (): ProductInput => {
    const nameEn = values.nameEn.trim();
    const nameBn = values.nameBn.trim();
    if (!product) {
      const body: ProductInput = {
        categoryId: values.categoryId,
        nameEn,
        nameBn,
      };
      if (unitKey) body.unitKey = unitKey;
      return body;
    }
    const body: ProductInput = {};
    if (values.categoryId !== product.category.id) body.categoryId = values.categoryId;
    if (nameEn !== product.nameEn) body.nameEn = nameEn;
    if (nameBn !== product.nameBn) body.nameBn = nameBn;
    if (unitKey && unitKey !== product.unitKey) body.unitKey = unitKey;
    return body;
  };

  const validate = (): Partial<Record<FieldName, string>> => {
    const found: Partial<Record<FieldName, string>> = {};
    if (!values.categoryId) found.categoryId = t('common.required');
    if (!values.nameEn.trim()) found.nameEn = t('common.required');
    if (!values.nameBn.trim()) found.nameBn = t('common.required');
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

  if (categories.isPending || units.isPending) return <FormSkeleton />;
  const noCategory = !product && categoryOptions.length === 0;

  return (
    <>
      <form noValidate onSubmit={onSubmit} className="max-w-2xl space-y-5">
        <FormError
          message={
            serverError ?? (noCategory && !canManage ? t('products.noActiveCategory') : null)
          }
        />
        <Notice>{sent}</Notice>

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

        {/* Staff who may only ASK to deactivate get the request button here (owner-level box). */}
        {isEdit && requestTarget ? (
          <SensitiveSection
            editable={false}
            requestSlot={
              <RequestChangeButton slug={slug} target={requestTarget} onSent={setSent} />
            }
          >
            {null}
          </SensitiveSection>
        ) : null}

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
