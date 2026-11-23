'use client';

import { KPICardsSection } from './kpi-cards-section';
import { RevenueOverview } from './revenue-overview';
import { TopCustomers } from './top-customers';
import { SalesSummaryDonut } from './sales-summary-donut';
import { TargetCommissionPanel } from './target-commission-panel';
import { StockOverview } from './stock-overview';
import { SalesDeliveryOverview } from './sales-delivery-overview';
import { RecentTransactions } from './recent-transactions';

/**
 * The dealership dashboard: 8 primary KPI cards (reference design), a Revenue Overview / Top 5
 * Customers / Sales Summary donut row, and an operational row (Target & Commission Progress,
 * Stock Overview, Sales & Delivery Overview, Recent Transactions).
 * `.dash-scope` (src/core/theme/tokens.css) scopes this page's own color tokens so no other
 * page's colors change — it's a pure CSS-variable scope, not a visual container, so the page
 * sits on the app's normal background (see DECISIONS.md "Dashboard v4").
 */
export function DashboardView({ slug, businessId }: { slug: string; businessId: string }) {
  return (
    <div className="dash-scope space-y-6">
      <KPICardsSection slug={slug} businessId={businessId} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <RevenueOverview slug={slug} businessId={businessId} />
        </div>
        <div className="lg:col-span-1">
          <TopCustomers slug={slug} businessId={businessId} />
        </div>
        <div className="lg:col-span-1">
          <SalesSummaryDonut slug={slug} businessId={businessId} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TargetCommissionPanel slug={slug} businessId={businessId} />
        <StockOverview slug={slug} businessId={businessId} />
        <SalesDeliveryOverview slug={slug} businessId={businessId} />
        <RecentTransactions slug={slug} businessId={businessId} />
      </div>
    </div>
  );
}
