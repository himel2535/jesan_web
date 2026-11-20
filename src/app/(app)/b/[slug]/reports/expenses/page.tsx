import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { ExpensesReport } from '@/modules/dealership/reports/expenses-report';
import { PageHeader } from '@/core/ui/page-header';

export default async function ExpensesReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'report.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.reports.expenses');
  return (
    <>
      <PageHeader title={t('title')} />
      <ExpensesReport slug={slug} businessId={gate.business.id} />
    </>
  );
}
