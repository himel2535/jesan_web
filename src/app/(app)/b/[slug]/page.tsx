import { LayoutDashboard } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { can } from '@/core/auth/permissions';
import { lookupBusiness } from '@/core/module-system/business-context';
import { EmptyState } from '@/core/ui/empty-state';
import { PageHeader } from '@/core/ui/page-header';
import { DashboardView } from '@/modules/dealership/dashboard/dashboard-view';
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
    return <DashboardView slug={slug} businessId={lookup.business.id} />;
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
