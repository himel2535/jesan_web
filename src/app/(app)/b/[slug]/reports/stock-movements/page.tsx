import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { StockMovementsReport } from '@/modules/dealership/reports/stock-movements-report';
import { PageHeader } from '@/core/ui/page-header';

export default async function StockMovementsReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'report.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.reports.stockMovements');
  return (
    <>
      <PageHeader title={t('title')} />
      <StockMovementsReport slug={slug} businessId={gate.business.id} />
    </>
  );
}
