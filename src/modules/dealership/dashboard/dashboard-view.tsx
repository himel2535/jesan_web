'use client';

import { useCan } from '@/core/auth/useCan';
import { useDailySummary } from '../reports/api';
import { CardBlock } from './cards/card-block';
import { KPICard } from './cards/kpi-card';
import { DashboardSectionSkeleton } from './cards/skeletons';
import { AccountsSection } from './sections/accounts-section';
import { SalesSection } from './sections/sales-section';
import { PurchasesSection } from './sections/purchases-section';
import { CollectionsSection } from './sections/collections-section';
import { ExpensesSection } from './sections/expenses-section';
import { CommissionSection } from './sections/commission-section';
import { CustomersSection } from './sections/customers-section';
import { StockSection } from './sections/stock-section';

/**
 * Complete dashboard with 8 sections (Accounts, Sales, Purchases, Collections, Expenses,
 * Commission, Customers, Stock) + Cash opening/closing/net balance. All queries batch via
 * useQueries() with staggered stale times for performance.
 */
export function DashboardView({ slug, businessId }: { slug: string; businessId: string }) {
  const cashQuery = useDailySummary(slug, businessId);
  const canViewCash = useCan('cashbook.view');

  if (cashQuery.isPending) {
    return <DashboardSectionSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Cash section */}
      {canViewCash && cashQuery.data?.cash ? (
        <CardBlock title="Cash">
          <KPICard label="Opening Balance" value={cashQuery.data.cash.openingBalance} isMoney />
          <KPICard
            label="Closing Balance"
            value={cashQuery.data.cash.closingBalance}
            isMoney
            tone="positive"
          />
          <KPICard label="Net" value={cashQuery.data.cash.net} isMoney />
        </CardBlock>
      ) : null}

      {/* KPI Sections */}
      <AccountsSection slug={slug} businessId={businessId} />
      <SalesSection slug={slug} businessId={businessId} />
      <PurchasesSection slug={slug} businessId={businessId} />
      <CollectionsSection slug={slug} businessId={businessId} />
      <ExpensesSection slug={slug} businessId={businessId} />
      <CommissionSection slug={slug} businessId={businessId} />
      <CustomersSection slug={slug} businessId={businessId} />
      <StockSection slug={slug} businessId={businessId} />
    </div>
  );
}
