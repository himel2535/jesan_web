'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { ApiError } from '@/core/api/errors';
import { localizedName } from '@/core/auth/types';
import { useDynamicT } from '@/core/i18n/use-dynamic-t';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import { inputClass } from '@/core/ui/text-field';
import { useCustomers, useUnits } from '../master-data/api';
import type { Customer } from '../master-data/types';
import type { DocumentStatus, OrderDeliveryStatus, ProductRef } from './types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A `YYYY-MM-DD` business day from the API → a localized date. */
export function useBusinessDay() {
  const format = useFormat();
  return (day: string) => format.date(`${day}T00:00:00+06:00`);
}

/** Reads a date from the URL, ignoring anything that is not YYYY-MM-DD. */
export function dateParam(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value && DATE.test(value) ? value : undefined;
}

/** Writes filters to the URL and always returns to page 1. */
export function useSetFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('page');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
}

/** The unit's name and decimals, from the business's own settings — never from code. */
export function useUnitInfo(slug: string, businessId: string) {
  const locale = useLocale();
  const units = useUnits(slug, businessId);
  return {
    isPending: units.isPending,
    decimalsOf: (unitKey: string) =>
      units.data?.items.find((u) => u.key === unitKey)?.decimals ?? 0,
    nameOf: (unitKey: string) => {
      const unit = units.data?.items.find((u) => u.key === unitKey);
      return unit ? localizedName(unit, locale) : unitKey;
    },
  };
}

/**
 * A payment method's label. The list of methods is the business's own (`GET collection-methods`),
 * so a key with no translation yet shows as itself instead of breaking the page.
 */
/** Without a unit name the sentence would keep its double space. */
const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

export function useMethodLabel() {
  const dt = useDynamicT();
  return (method: string) => dt(`dealership.sales.collections.methodNames.${method}`, method);
}

export function StatusText({ status }: { status: DocumentStatus }) {
  const t = useTranslations('dealership.sales.status');
  return (
    <span className={cn('text-sm font-medium', status === 'void' ? 'text-danger' : 'text-success')}>
      {t(status)}
    </span>
  );
}

export function DeliveryProgress({ status }: { status: OrderDeliveryStatus }) {
  const t = useTranslations('dealership.sales.deliveryStatus');
  const tone =
    status === 'delivered'
      ? 'text-success'
      : status === 'partial'
        ? 'text-warning'
        : 'text-fg-muted';
  return <span className={cn('text-sm font-medium', tone)}>{t(status)}</span>;
}

/** Product name with its code, as every line shows it. */
export function ProductName({ product, name }: { product: ProductRef; name: string }) {
  return (
    <>
      <span className="font-mono text-xs text-fg-muted">{product.code}</span> {name}
    </>
  );
}

/**
 * Search customers (name, code or phone, 300 ms debounce) and pick one. `active` decides
 * whether inactive customers can be chosen: new orders may not use them, but deliveries and
 * collections on their older orders may (docs/plans/step-5b.md decision 8).
 */
export function CustomerPicker({
  slug,
  businessId,
  label,
  active = 'true',
  onPick,
}: {
  slug: string;
  businessId: string;
  label: string;
  active?: 'true' | 'all';
  onPick: (customer: Customer) => void;
}) {
  const t = useTranslations('dealership.sales.pick');
  const id = useId();
  const locale = useLocale();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const query = useCustomers(slug, businessId, { search: search || undefined, active });
  const items = query.data?.items ?? [];

  return (
    <div className="space-y-2">
      <label htmlFor={`${id}-search`} className="block text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
        />
        <input
          id={`${id}-search`}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('searchCustomers')}
          aria-describedby={`${id}-hint`}
          autoComplete="off"
          className={cn(inputClass, 'pl-9')}
        />
      </div>
      <p id={`${id}-hint`} className="text-sm text-fg-muted">
        {t('searchHint')}
      </p>
      <ul
        aria-label={label}
        aria-busy={query.isFetching}
        className="max-h-64 space-y-1 overflow-y-auto rounded-card border border-border bg-surface p-1"
      >
        {query.isSuccess && items.length === 0 ? (
          <li className="px-3 py-2 text-sm text-fg-muted">{t('noCustomers')}</li>
        ) : null}
        {items.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm hover:bg-surface-muted"
            >
              <span>
                <span className="font-mono text-xs text-fg-muted">{c.code}</span>{' '}
                <span className="font-medium">
                  {localizedName({ nameEn: c.nameEn, nameBn: c.nameBn ?? c.nameEn }, locale)}
                </span>
              </span>
              {c.isActive ? null : (
                <span className="text-xs text-danger">{t('inactiveCustomer')}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The three errors that carry `details` (docs/API.md §11) read better with their numbers:
 * what is left on the line, what is in stock, and the credit limit that would be passed.
 * Returns null for anything else, so the caller falls back to the code's general message.
 */
export function useSalesErrorMessage() {
  const t = useTranslations('dealership.sales.errors');
  const format = useFormat();
  /** `unitName` names the unit of the line the error is about, when the caller knows it. */
  return (error: unknown, unitName = ''): string | null => {
    if (!(error instanceof ApiError)) return null;
    const details = error.body?.details as Record<string, unknown> | undefined;
    const text = (key: string) => (typeof details?.[key] === 'string' ? details[key] : null);
    if (error.code === 'DELIVERY_QUANTITY_TOO_LARGE') {
      const remaining = text('remaining');
      return remaining === null
        ? null
        : collapse(t('remainingOnly', { remaining: format.quantity(remaining), unit: unitName }));
    }
    if (error.code === 'STOCK_INSUFFICIENT') {
      const available = text('available');
      return available === null
        ? null
        : collapse(t('stockOnly', { available: format.quantity(available), unit: unitName }));
    }
    if (error.code === 'CREDIT_LIMIT_EXCEEDED') {
      const limit = text('creditLimit');
      const after = text('balanceAfter');
      return limit === null || after === null
        ? null
        : t('creditLimit', { limit: format.money(limit), after: format.money(after) });
    }
    return null;
  };
}

/**
 * The customer filter of a list: a chip with the chosen customer, or a search panel. The URL
 * keeps only the id, so the name is read from the chosen record while this page lives.
 */
export function CustomerFilter({
  slug,
  businessId,
  customerId,
}: {
  slug: string;
  businessId: string;
  customerId: string | undefined;
}) {
  const t = useTranslations('dealership.sales.filters');
  const locale = useLocale();
  const setFilters = useSetFilters();
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {customerId ? (
          <>
            <span className="rounded-full border border-border px-3 py-1">
              {t('chip', { name: pickedName ?? t('unknown') })}
            </span>
            <button
              type="button"
              onClick={() => {
                setPickedName(null);
                setFilters({ customerId: undefined });
              }}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 font-medium underline"
            >
              <X aria-hidden className="size-4" />
              {t('clearCustomer')}
            </button>
          </>
        ) : (
          <button
            type="button"
            aria-expanded={picking}
            onClick={() => setPicking((v) => !v)}
            className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 font-medium hover:bg-surface-muted"
          >
            {t('customer')}
          </button>
        )}
      </div>
      {picking && !customerId ? (
        <div className="max-w-xl">
          <CustomerPicker
            slug={slug}
            businessId={businessId}
            label={t('customer')}
            active="all"
            onPick={(c) => {
              setPickedName(
                localizedName({ nameEn: c.nameEn, nameBn: c.nameBn ?? c.nameEn }, locale),
              );
              setPicking(false);
              setFilters({ customerId: c.id });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
