'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useErrorMessage } from '@/core/api/field-errors';
import { toLatinDigits } from '@/core/lib/phone';
import { Button } from '@/core/ui/button';
import { Modal } from '@/core/ui/modal';
import { TextInput } from '../../master-data/shared/fields';
import { FormError } from '../../master-data/shared/states';
import { useSaveExpenseCategory } from '../api';
import { EXPENSE_LIMITS, type ExpenseCategory, type ExpenseCategoryPatch } from '../types';

const FIELDS = ['nameEn', 'nameBn', 'sortOrder'] as const;
type Errors = Partial<Record<(typeof FIELDS)[number], string>>;

/** Create (no `category`) or edit a type's names and order. Status has its own dialog. */
export function ExpenseCategoryDialog({
  category,
  onClose,
  onSaved,
  slug,
  businessId,
}: {
  category: ExpenseCategory | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  slug: string;
  businessId: string;
}) {
  const t = useTranslations('dealership.expenses.categories');
  const tc = useTranslations('dealership.common');
  const errorMessage = useErrorMessage();
  const id = useId();
  const save = useSaveExpenseCategory(slug, businessId);
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
    if (!en) found.nameEn = tc('required');
    if (!bn) found.nameBn = tc('required');
    if (order && !/^\d+$/.test(order)) found.sortOrder = t('sortOrderInvalid');
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;

    const body: ExpenseCategoryPatch = {};
    if (!category || en !== category.nameEn) body.nameEn = en;
    if (!category || bn !== category.nameBn) body.nameBn = bn;
    if (order && (!category || Number(order) !== category.sortOrder))
      body.sortOrder = Number(order);
    if (category && Object.keys(body).length === 0) {
      setServerError(tc('nothingToChange'));
      return;
    }

    inFlight.current = true;
    try {
      await save.mutateAsync({ id: category?.id, body });
      onSaved(category ? tc('saved') : tc('created'));
      onClose();
    } catch (error) {
      const split = errorMessage.split(error, FIELDS);
      setErrors(split.fields);
      setServerError(split.form);
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <Modal
      open
      onClose={() => (save.isPending ? undefined : onClose())}
      title={category ? t('editTitle', { name: category.nameEn }) : t('newTitle')}
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={serverError} />
        <TextInput
          id={`${id}-en`}
          label={tc('nameEn')}
          value={nameEn}
          onChange={setNameEn}
          error={errors.nameEn}
          maxLength={EXPENSE_LIMITS.nameEn}
          required
        />
        <TextInput
          id={`${id}-bn`}
          label={tc('nameBn')}
          value={nameBn}
          onChange={setNameBn}
          error={errors.nameBn}
          maxLength={EXPENSE_LIMITS.nameBn}
          required
        />
        <TextInput
          id={`${id}-order`}
          label={t('sortOrder')}
          hint={t('sortOrderHint')}
          value={sortOrder}
          onChange={setSortOrder}
          error={errors.sortOrder}
          inputMode="numeric"
          maxLength={5}
        />
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={save.isPending} aria-busy={save.isPending}>
            {save.isPending ? tc('saving') : category ? tc('save') : tc('create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
