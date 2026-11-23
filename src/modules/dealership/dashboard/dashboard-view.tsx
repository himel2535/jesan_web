'use client';

import { KPICardsSection } from './kpi-cards-section';
import { RevenueOverview } from './revenue-overview';
import { TopCustomers } from './top-customers';
import { SalesSummaryDonut } from './sales-summary-donut';

/**
 * The dealership dashboard: 7 primary KPI cards (Total Sales, Total Purchase, Total Collection,
 * Customer Due, Cash & Bank, Commission, Net Profit — reference design), followed by one row
 * of Revenue Overview, Top 5 Customers, and a Sales Summary donut.
 * `.dash-scope` (src/core/theme/tokens.css) scopes this page's own color tokens so no
 * other page's colors change.
 */
export function DashboardView({ slug, businessId }: { slug: string; businessId: string }) {
  return (
    <div className="dash-scope space-y-6 rounded-card bg-[var(--dash-bg)] p-4 sm:p-6">
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
    </div>
  );
}
