'use client';

import { useTranslations } from 'next-intl';
import { Money } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { useDailySummary } from '../reports/api';
import { ListSkeleton } from '../reports/skeletons';
import { AccountsSection } from './sections/accounts-section';
import { CollectionsSection } from './sections/collections-section';
import { CommissionSection } from './sections/commission-section';
import { CustomersSection } from './sections/customers-section';
import { ExpensesSection } from './sections/expenses-section';
import { PurchasesSection } from './sections/purchases-section';
import { SalesSection } from './sections/sales-section';
import { StockSection } from './sections/stock-section';

/**
 * The enterprise dashboard: cash opening/closing/net (`report.view`, cash part `cashbook.view`),
 * then one titled section per business area. Each section reuses that area's own KPI-card
 * component where one already exists (Sales, Purchases, Collections, Expenses), so permission
 * gating, loading and error states stay defined in exactly one place. Commission is owner-only
 * via `commission.view` itself (no separate role check needed).
 */
export function DashboardView({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership');
  const query = useDailySummary(slug, businessId);

  if (query.isPending) return <ListSkeleton />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;

  return (
    <div className="space-y-6">
      {data.cash ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-fg">{t('dashboard.sections.cash')}</h2>
          <dl className="grid gap-x-6 gap-y-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-fg-muted">
                {t('reports.dailySummary.cash.openingBalance')}
              </dt>
              <dd className="font-semibold">
                <Money value={data.cash.openingBalance} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-fg-muted">
                {t('reports.dailySummary.cash.closingBalance')}
              </dt>
              <dd className="text-lg font-bold">
                <Money value={data.cash.closingBalance} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-fg-muted">{t('reports.dailySummary.cash.net')}</dt>
              <dd className="font-semibold">
                <Money value={data.cash.net} />
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <AccountsSection slug={slug} businessId={businessId} />
      <SalesSection slug={slug} businessId={businessId} dailySummary={data} />
      <PurchasesSection slug={slug} businessId={businessId} />
      <CollectionsSection slug={slug} businessId={businessId} />
      <ExpensesSection slug={slug} businessId={businessId} />
      <CustomersSection slug={slug} businessId={businessId} />
      <StockSection slug={slug} businessId={businessId} />
      <CommissionSection slug={slug} businessId={businessId} />
    </div>
  );
}
