import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { StockReport } from '@/modules/dealership/reports/stock-report';
import { PageHeader } from '@/core/ui/page-header';

export default async function StockReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'report.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.reports.stock');
  return (
    <>
      <PageHeader title={t('title')} />
      <StockReport slug={slug} businessId={gate.business.id} />
    </>
  );
}
