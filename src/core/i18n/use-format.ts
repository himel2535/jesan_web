'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import {
  formatDate,
  formatMoney,
  formatMoneyRounded,
  formatNumber,
  formatQuantity,
  type NumericInput,
} from './format';

/** Client-side access to the shared format helpers, bound to the current locale. */
export function useFormat() {
  const locale = useLocale();
  return useMemo(
    () => ({
      number: (value: NumericInput, options?: Intl.NumberFormatOptions) =>
        formatNumber(value, locale, options),
      money: (value: NumericInput) => formatMoney(value, locale),
      /** Headline amounts with no paisa (dashboard tiles). */
      moneyRounded: (value: NumericInput) => formatMoneyRounded(value, locale),
      quantity: (value: NumericInput, maxFractionDigits?: number) =>
        formatQuantity(value, locale, maxFractionDigits),
      date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
        formatDate(value, locale, options),
    }),
    [locale],
  );
}
