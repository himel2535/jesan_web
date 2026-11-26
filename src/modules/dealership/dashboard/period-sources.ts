'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccountsSummary } from '../accounts/api';
import type { AccountsSummary } from '../accounts/types';
import { purchaseTotalsQuery } from '../purchases/api';
import { salesReportQuery } from '../reports/api';
import type { DayRange } from './periods';

/**
 * Every money figure of the financial panels for one window, from one source each:
 * - ledger amounts (collection, expense, commission received) from `accounts/summary`, which
 *   sums the same active rows as the cash book and the KPI cards;
 * - sales revenue from the sales report (delivered value);
 * - purchase cost from `purchases/summary`, which the API omits without `product.cost.view`;
 * - customer due, which is a current balance, not a window figure.
 */
export function usePeriodSources(slug: string, businessId: string, range: DayRange) {
  const accounts = useAccountsSummary(slug, businessId, range);
  const sales = useQuery(
    salesReportQuery(slug, businessId, { groupBy: 'date', ...range, page: 1 }),
  );
  const purchases = useQuery(purchaseTotalsQuery(slug, businessId, range));
  return { accounts, sales, purchases };
}

export type PeriodSources = ReturnType<typeof usePeriodSources>;

/** One ledger amount for a type and direction; `undefined` until the summary has loaded. */
export function ledgerAmount(
  summary: AccountsSummary | undefined,
  type: string,
  direction: 'in' | 'out',
): string | undefined {
  if (!summary) return undefined;
  const row = summary.byType.find((item) => item.type === type);
  return row ? row[direction] : '0.00';
}
