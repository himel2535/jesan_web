'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { isNegativeMoney } from '@/core/lib/money';
import { cn } from '@/core/ui/cn';
import { useAccountsSummaryRanges } from '../../accounts/api';
import { useAccountsDashboardRanges } from '../../accounts/shared';
import { Money } from '../../master-data/shared/display';
import { LoadError } from '../../master-data/shared/states';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

function Skeleton() {
  return (
    <div className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-surface-muted" />
          <div className="h-6 w-28 animate-pulse rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

/**
 * Three accounts KPI windows (`ledger.view`, same `accounts/summary` endpoint as the Accounts
 * page). `totalDue`/`totalAdvance` are date-range independent, so shown once underneath rather
 * than once per window.
 */
export function AccountsSection({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership');
  const ranges = useAccountsDashboardRanges();
  const { total, today, thisMonth } = useAccountsSummaryRanges(slug, businessId, ranges);
  const queries = [total, today, thisMonth];
  const firstError = queries.find((q) => q.error)?.error;

  if (isForbidden(firstError)) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-fg">{t('nav.accounts')}</h2>
      {queries.some((q) => q.isPending) ? (
        <Skeleton />
      ) : firstError ? (
        <LoadError error={firstError} onRetry={() => queries.forEach((q) => void q.refetch())} />
      ) : total.data && today.data && thisMonth.data ? (
        <div className="space-y-3">
          <dl className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-3">
            {[
              { label: t('dashboard.periods.total'), data: total.data },
              { label: t('dashboard.periods.today'), data: today.data },
              { label: t('dashboard.periods.thisMonth'), data: thisMonth.data },
            ].map(({ label, data }) => (
              <div key={label} className="space-y-2">
                <p className="text-sm font-medium text-fg">{label}</p>
                <div>
                  <dt className="text-sm text-fg-muted">{t('accounts.summary.totalIn')}</dt>
                  <dd className="font-semibold text-success">
                    <Money value={data.totalIn} />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-fg-muted">{t('accounts.summary.totalOut')}</dt>
                  <dd className="font-semibold text-danger">
                    <Money value={data.totalOut} />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-fg-muted">{t('accounts.summary.net')}</dt>
                  <dd
                    className={cn(
                      'font-semibold',
                      isNegativeMoney(data.net) ? 'text-danger' : 'text-success',
                    )}
                  >
                    <Money value={data.net} />
                  </dd>
                </div>
              </div>
            ))}
          </dl>
          <dl className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-fg-muted">{t('accounts.summary.totalDue')}</dt>
              <dd className="font-semibold text-warning">
                <Money value={total.data.totalDue} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-fg-muted">{t('accounts.summary.totalAdvance')}</dt>
              <dd className="font-semibold text-focus">
                <Money value={total.data.totalAdvance} />
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
