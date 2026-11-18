'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import { apiErrorKind } from '@/core/api/error-kind';
import { toLatinDigits } from '@/core/lib/phone';
import { Button } from '@/core/ui/button';
import { Modal } from '@/core/ui/modal';
import { useSaveCategory, type CategoryPatch } from '../api';
import { TextInput } from '../shared/fields';
import { FormError } from '../shared/states';
import { LIMITS, type Category } from '../types';

type Errors = Partial<Record<'nameEn' | 'nameBn' | 'sortOrder', string>>;

/** Create (no `category`) or edit names and order. Status is changed with its own dialog. */
export function CategoryDialog({
  category,
  onClose,
  onSaved,
  slug,
  businessId,
}: {
  category: Category | null;
  onClose: () => void;
  /** Gets the saved category too, so a caller (the product form) can select a new one at once. */
  onSaved: (message: string, saved: Category) => void;
  slug: string;
  businessId: string;
}) {
  const t = useTranslations('dealership');
  const id = useId();
  const save = useSaveCategory(slug, businessId);
  const [nameEn, setNameEn] = useState(category?.nameEn ?? '');
  const [nameBn, setNameBn] = useState(category?.nameBn ?? '');
  const [sortOrder, setSortOrder] = useState(category ? String(category.sortOrder) : '');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const en = nameEn.trim();
    const bn = nameBn.trim();
    const order = toLatinDigits(sortOrder.trim());
    const found: Errors = {};
    if (!en) found.nameEn = t('common.required');
    if (!bn) found.nameBn = t('common.required');
    if (order && (!/^\d+$/.test(order) || Number(order) > LIMITS.sortOrderMax)) {
      found.sortOrder = t('categories.sortOrderInvalid');
    }
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;

    const body: CategoryPatch = {};
    if (!category || en !== category.nameEn) body.nameEn = en;
    if (!category || bn !== category.nameBn) body.nameBn = bn;
    if (order && (!category || Number(order) !== category.sortOrder))
      body.sortOrder = Number(order);
    if (category && Object.keys(body).length === 0) {
      setServerError(t('common.nothingToChange'));
      return;
    }

    inFlight.current = true;
    try {
      const saved = await save.mutateAsync({ id: category?.id, body });
      onSaved(category ? t('common.saved') : t('common.created'), saved);
      onClose();
    } catch (error) {
      const kind = apiErrorKind(error);
      if (kind === 'duplicate') setErrors({ nameEn: t('categories.duplicate') });
      else setServerError(t(`common.error.${kind}`));
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <Modal
      open
      onClose={() => (save.isPending ? undefined : onClose())}
      title={
        category ? t('categories.editTitle', { name: category.nameEn }) : t('categories.newTitle')
      }
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={serverError} />
        <TextInput
          id={`${id}-en`}
          label={t('common.nameEn')}
          value={nameEn}
          onChange={setNameEn}
          error={errors.nameEn}
          maxLength={LIMITS.name}
          required
        />
        <TextInput
          id={`${id}-bn`}
          label={t('common.nameBn')}
          value={nameBn}
          onChange={setNameBn}
          error={errors.nameBn}
          maxLength={LIMITS.name}
          required
        />
        <TextInput
          id={`${id}-order`}
          label={t('categories.sortOrder')}
          hint={t('categories.sortOrderHint')}
          value={sortOrder}
          onChange={setSortOrder}
          error={errors.sortOrder}
          inputMode="numeric"
          maxLength={5}
        />
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={save.isPending} aria-busy={save.isPending}>
            {save.isPending ? t('common.saving') : category ? t('common.save') : t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
