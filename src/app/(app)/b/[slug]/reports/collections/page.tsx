import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { CollectionsReport } from '@/modules/dealership/reports/collections-report';
import { PageHeader } from '@/core/ui/page-header';

export default async function CollectionsReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'report.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.reports.collections');
  return (
    <>
      <PageHeader title={t('title')} />
      <CollectionsReport slug={slug} businessId={gate.business.id} />
    </>
  );
}
