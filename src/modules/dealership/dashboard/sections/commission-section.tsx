'use client';

import { useTranslations } from 'next-intl';
import { useCan } from '@/core/auth/can';
import { businessToday } from '@/core/i18n/format';
import { useCommissionSummary } from '../../commission/api';
import { Money } from '../../master-data/shared/display';

/** Yearly commission totals (`commission.view`, owner-only — the permission itself is the gate). */
export function CommissionSection({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership');
  const canView = useCan('commission.view');
  const year = Number(businessToday().slice(0, 4));
  const query = useCommissionSummary(slug, businessId, year);

  if (!canView) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-fg">{t('nav.commission')}</h2>
      <dl className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-3">
        {query.isPending ? (
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
              <div className="h-6 w-28 animate-pulse rounded bg-surface-muted" />
            </div>
          ))
        ) : query.data ? (
          <>
            <div>
              <dt className="text-sm text-fg-muted">{t('commission.summary.totalCalculated')}</dt>
              <dd className="font-semibold">
                <Money value={query.data.totalCalculated} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-fg-muted">{t('commission.summary.totalReceived')}</dt>
              <dd className="font-semibold text-success">
                <Money value={query.data.totalReceived} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-fg-muted">{t('commission.summary.totalPending')}</dt>
              <dd className="font-semibold text-warning">
                <Money value={query.data.totalPending} />
              </dd>
            </div>
          </>
        ) : null}
      </dl>
    </section>
  );
}
