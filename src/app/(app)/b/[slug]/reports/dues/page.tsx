import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { DuesReport } from '@/modules/dealership/reports/dues-report';
import { PageHeader } from '@/core/ui/page-header';

export default async function DuesReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'report.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.reports.dues');
  return (
    <>
      <PageHeader title={t('title')} />
      <DuesReport slug={slug} businessId={gate.business.id} />
    </>
  );
}
