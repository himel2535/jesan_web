'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { usePurchasesSummary } from '../../purchases/api';
import { usePurchaseSummaryRanges } from '../../purchases/shared';
import { PurchasesSummaryCards } from '../../purchases/summary-cards';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

/**
 * The Purchases page's own `PurchasesSummaryCards`, unchanged (`purchase.view`). Checks the same
 * cached query here too so the section heading hides along with the cards on a 403, instead of
 * showing an empty-looking "Purchases" heading above nothing.
 */
export function PurchasesSection({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership');
  const ranges = usePurchaseSummaryRanges();
  const { total } = usePurchasesSummary(slug, businessId, ranges);

  if (isForbidden(total.error)) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-fg">{t('nav.purchases')}</h2>
      <PurchasesSummaryCards slug={slug} businessId={businessId} ranges={ranges} />
    </section>
  );
}
