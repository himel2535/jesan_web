'use client';

import { KPICardsSection } from './kpi-cards-section';

/**
 * The dealership dashboard displaying 20 unified KPI cards in a 4-column grid.
 * Cards include cash, accounts, sales, purchases, inventory, and commission metrics.
 */
export function DashboardView({ slug, businessId }: { slug: string; businessId: string }) {
  return <KPICardsSection slug={slug} businessId={businessId} />;
}
