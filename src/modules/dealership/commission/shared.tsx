'use client';

import { useLocale } from 'next-intl';
import { localizedName } from '@/core/auth/types';
import { useUnits } from '../master-data/api';

/**
 * Commission isn't tied to a product, so it uses the business's own default unit (বস্তা for
 * Akij Cement) instead of a per-line unit like purchases/sales.
 */
export function useDefaultUnit(slug: string, businessId: string) {
  const locale = useLocale();
  const units = useUnits(slug, businessId);
  const unit = units.data?.items.find((u) => u.key === units.data?.defaultUnitKey);
  return {
    isPending: units.isPending,
    name: unit ? localizedName(unit, locale) : '',
  };
}
