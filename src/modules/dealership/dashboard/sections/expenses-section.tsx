'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { useExpensesSummary } from '../../expenses/api';
import { useExpenseSummaryRanges } from '../../expenses/shared';
import { ExpensesSummaryCards } from '../../expenses/summary-cards';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

/**
 * The Expenses page's own `ExpensesSummaryCards`, unchanged (`report.view`). Checks the same
 * cached query here too so the section heading hides along with the cards on a 403.
 */
export function ExpensesSection({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership');
  const ranges = useExpenseSummaryRanges();
  const { total } = useExpensesSummary(slug, businessId, ranges);

  if (isForbidden(total.error)) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-fg">{t('nav.expenses')}</h2>
      <ExpensesSummaryCards slug={slug} businessId={businessId} ranges={ranges} />
    </section>
  );
}
