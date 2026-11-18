'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useErrorMessage } from '@/core/api/field-errors';
import { useCan } from '@/core/auth/can';
import {
  MONEY_PATTERN,
  SIGNED_MONEY_PATTERN,
  cleanMoneyInput,
  isNegativeMoney,
  sameMoney,
} from '@/core/lib/money';
import { normalizePhone } from '@/core/lib/phone';
import { Button } from '@/core/ui/button';
import { useSaveCustomer, type CustomerInput } from '../api';
import { Balance } from '../shared/display';
import {
  MoneyInput,
  ReasonInput,
  SensitiveSection,
  TextInput,
  reasonError,
} from '../shared/fields';
import { FormError } from '../shared/states';
import { LIMITS, type Customer } from '../types';

const FIELDS = [
  'nameEn',
  'nameBn',
  'phone',
  'address',
  'area',
  'openingBalance',
  'creditLimit',
  'reason',
] as const;
type FieldName = (typeof FIELDS)[number];

/**
 * Create (no `customer`) or edit a customer. Rules from jesan-api DTOs: English name required
 * (Bangla optional), phone required and unique in the business, address ≤ 255, area ≤ 80. Opening
 * due and credit limit need `customer.due.view` to see or set at creation, and
 * `customer.balance.edit` + a reason to change afterwards (owner level).
 */
export function CustomerForm({
  slug,
  businessId,
  customer,
}: {
  slug: string;
  businessId: string;
  customer?: Customer;
}) {
  const t = useTranslations('dealership');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const id = useId();
  const canSeeDue = useCan('customer.due.view');
  const canEditBalance = useCan('customer.balance.edit');
  const save = useSaveCustomer(slug, businessId);
  const isEdit = Boolean(customer);
  // The due fields exist only with the permission, and on edit only if the API sent them.
  const showDue = canSeeDue && (!customer || 'openingBalance' in customer);

  const [values, setValues] = useState({
    nameEn: customer?.nameEn ?? '',
    nameBn: customer?.nameBn ?? '',
    phone: customer?.phone ?? '',
    address: customer?.address ?? '',
    area: customer?.area ?? '',
    openingBalance: customer?.openingBalance ?? '',
    creditLimit: customer?.creditLimit ?? '',
    reason: '',
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const set = (field: keyof typeof values) => (value: string) =>
    setValues((v) => ({ ...v, [field]: value }));

  const opening = cleanMoneyInput(values.openingBalance);
  const limit = cleanMoneyInput(values.creditLimit);
  const balanceChanged =
    isEdit &&
    showDue &&
    (!sameMoney(opening || '0', customer?.openingBalance) ||
      !sameMoney(limit, customer?.creditLimit ?? null));

  const validate = () => {
    const found: Partial<Record<FieldName, string>> = {};
    if (!values.nameEn.trim()) found.nameEn = t('common.required');
    if (!values.phone.trim()) found.phone = t('common.required');
    else if (!normalizePhone(values.phone)) found.phone = t('customers.phoneInvalid');
    const balancesEditable = !isEdit || canEditBalance;
    if (showDue && balancesEditable) {
      if (opening && !SIGNED_MONEY_PATTERN.test(opening))
        found.openingBalance = t('common.signedMoneyInvalid');
      if (limit && !MONEY_PATTERN.test(limit)) found.creditLimit = t('common.moneyInvalid');
    }
    if (balanceChanged && canEditBalance && reasonError(values.reason))
      found.reason = t('common.reasonRequired');
    return found;
  };

  /** Everything filled on create; only real changes on edit (cleared optional text → null). */
  const buildBody = (): CustomerInput => {
    const text = (v: string) => v.trim();
    if (!customer) {
      const body: CustomerInput = { nameEn: text(values.nameEn), phone: text(values.phone) };
      if (text(values.nameBn)) body.nameBn = text(values.nameBn);
      if (text(values.address)) body.address = text(values.address);
      if (text(values.area)) body.area = text(values.area);
      if (showDue && opening) body.openingBalance = opening;
      if (showDue && limit) body.creditLimit = limit;
      return body;
    }
    const body: CustomerInput = {};
    const optional = (v: string) => (text(v) ? text(v) : null);
    if (text(values.nameEn) !== customer.nameEn) body.nameEn = text(values.nameEn);
    if (optional(values.nameBn) !== customer.nameBn) body.nameBn = optional(values.nameBn);
    if (normalizePhone(values.phone) !== customer.phone) body.phone = text(values.phone);
    if (optional(values.address) !== customer.address) body.address = optional(values.address);
    if (optional(values.area) !== customer.area) body.area = optional(values.area);
    if (showDue && canEditBalance) {
      if (!sameMoney(opening || '0', customer.openingBalance)) body.openingBalance = opening || '0';
      if (!sameMoney(limit, customer.creditLimit ?? null)) body.creditLimit = limit || null;
      if (body.openingBalance !== undefined || body.creditLimit !== undefined)
        body.reason = values.reason.trim();
    }
    return body;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found = validate();
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;
    const body = buildBody();
    if (customer && Object.keys(body).length === 0) {
      setServerError(t('common.nothingToChange'));
      return;
    }
    inFlight.current = true;
    try {
      const saved = await save.mutateAsync({ id: customer?.id, body });
      router.push(
        `/b/${encodeURIComponent(slug)}/customers/${saved.id}?saved=${customer ? 'updated' : 'created'}`,
      );
    } catch (error) {
      // By the API's stable code (docs/API.md §11): field errors under their field.
      const split = errorMessage.split(error, FIELDS);
      setErrors(split.fields);
      setServerError(split.form);
      inFlight.current = false;
    }
  };

  const dueFields = (readOnly: boolean) => (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-1.5">
        <MoneyInput
          id={`${id}-opening`}
          label={t('customers.openingBalance')}
          hint={t('customers.openingBalanceHint')}
          value={values.openingBalance}
          onChange={set('openingBalance')}
          error={errors.openingBalance}
          readOnly={readOnly}
        />
        {opening && SIGNED_MONEY_PATTERN.test(opening) && isNegativeMoney(opening) ? (
          <Balance value={opening} />
        ) : null}
      </div>
      <MoneyInput
        id={`${id}-limit`}
        label={t('customers.creditLimit')}
        hint={t('customers.creditLimitHint')}
        value={values.creditLimit}
        onChange={set('creditLimit')}
        error={errors.creditLimit}
        readOnly={readOnly}
      />
    </div>
  );

  return (
    <form noValidate onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <FormError message={serverError} />
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
        />
      </div>
      <TextInput
        id={`${id}-phone`}
        label={t('common.phone')}
        hint={t('customers.phoneHint')}
        value={values.phone}
        onChange={set('phone')}
        error={errors.phone}
        type="tel"
        inputMode="tel"
        maxLength={LIMITS.phone}
        required
      />
      <TextInput
        id={`${id}-address`}
        label={t('common.address')}
        value={values.address}
        onChange={set('address')}
        error={errors.address}
        maxLength={LIMITS.address}
      />
      <TextInput
        id={`${id}-area`}
        label={t('common.area')}
        value={values.area}
        onChange={set('area')}
        error={errors.area}
        maxLength={LIMITS.area}
      />

      {showDue ? (
        isEdit ? (
          <SensitiveSection editable={canEditBalance}>
            {dueFields(!canEditBalance)}
            {canEditBalance && balanceChanged ? (
              <ReasonInput
                id={`${id}-reason`}
                value={values.reason}
                onChange={set('reason')}
                error={errors.reason}
              />
            ) : null}
          </SensitiveSection>
        ) : (
          dueFields(false)
        )
      ) : null}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" size="lg" disabled={save.isPending} aria-busy={save.isPending}>
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
  );
}
