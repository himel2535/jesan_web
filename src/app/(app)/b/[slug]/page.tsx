import { LayoutDashboard } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { lookupBusiness } from '@/core/module-system/business-context';
import { EmptyState } from '@/core/ui/empty-state';
import { PageHeader } from '@/core/ui/page-header';

/** Business dashboard. No money cards yet (later phase); access is checked in the layout. */
export default async function BusinessDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [lookup, t] = await Promise.all([lookupBusiness(slug), getTranslations('business')]);
  if (lookup.status !== 'ok') return null;

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
