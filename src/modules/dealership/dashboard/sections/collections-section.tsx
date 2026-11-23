'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { CollectionsSummaryCards } from '../../sales/collections/collection-summary-cards';
import { useCollectionsSummaryAmounts } from '../../sales/api';
import { useSalesSummaryRanges } from '../../sales/shared';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

/**
 * The Collections page's own `CollectionsSummaryCards`, unchanged (`report.view`). Checks the
 * same cached query here too so the section heading hides along with the cards on a 403.
 */
export function CollectionsSection({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership');
  const ranges = useSalesSummaryRanges();
  const { total } = useCollectionsSummaryAmounts(slug, businessId, ranges);

  if (isForbidden(total.error)) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-fg">{t('dashboard.sections.collections')}</h2>
      <CollectionsSummaryCards slug={slug} businessId={businessId} ranges={ranges} />
    </section>
  );
}
