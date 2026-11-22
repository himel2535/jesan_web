'use client';

import { useDynamicT } from '@/core/i18n/use-dynamic-t';

export { dateParam, useBusinessDay, useSetFilters, LIFETIME_FROM } from '../expenses/shared';

export function useMethodLabel() {
  const dt = useDynamicT();
  return (method: string) => dt(`dealership.accounts.methodNames.${method}`, method);
}
