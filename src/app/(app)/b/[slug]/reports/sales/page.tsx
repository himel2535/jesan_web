import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { SalesReport } from '@/modules/dealership/reports/sales-report';
import { PageHeader } from '@/core/ui/page-header';

export default async function SalesReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'report.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.reports.sales');
  return (
    <>
      <PageHeader title={t('title')} />
      <SalesReport slug={slug} businessId={gate.business.id} />
    </>
  );
}
