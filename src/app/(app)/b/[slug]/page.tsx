import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { LayoutDashboard } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { makeQueryClient } from '@/core/api/query-client';
import { can } from '@/core/auth/permissions';
import { businessToday } from '@/core/i18n/format';
import { lookupBusiness } from '@/core/module-system/business-context';
import { EmptyState } from '@/core/ui/empty-state';
import { PageHeader } from '@/core/ui/page-header';
import { DashboardView } from '@/modules/dealership/dashboard/dashboard-view';
import { prefetchDashboard } from '@/modules/dealership/dashboard/prefetch';
import { dealershipManifest } from '@/modules/dealership/manifest';

/**
 * Business dashboard; access is checked in the layout. `report.view` on a dealership business
 * shows today's daily summary; anyone else (no permission, or a future non-dealership business
 * type) sees the placeholder — this page stays generic, not dealership-only.
 */
export default async function BusinessDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [lookup, t] = await Promise.all([lookupBusiness(slug), getTranslations('business')]);
  if (lookup.status !== 'ok') return null;
  const canSeeReports =
    lookup.business.type === dealershipManifest.type &&
    can(lookup.business.permissions, 'report.view');

  if (canSeeReports) {
    // The dashboard's first-paint requests start here, on the server, so the cards can arrive
    // with data instead of waiting for the browser to download, run and then ask (bounded wait;
    // see prefetchDashboard).
    const queryClient = makeQueryClient();
    try {
      await prefetchDashboard(queryClient, {
        slug,
        businessId: lookup.business.id,
        today: businessToday(),
        canCommission: can(lookup.business.permissions, 'commission.view'),
        canCashbook: can(lookup.business.permissions, 'cashbook.view'),
      });
    } catch {
      // A head start only: the browser fetches whatever the server could not.
    }
    return (
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DashboardView slug={slug} businessId={lookup.business.id} />
      </HydrationBoundary>
    );
  }

  return (
    <>
      <PageHeader title={lookup.name} />
      <EmptyState
        icon={LayoutDashboard}
        title={t('comingSoonTitle')}
        description={t('dashboardDescription')}
      />
    </>
  );
}
