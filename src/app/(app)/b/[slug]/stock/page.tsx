import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { StockList } from '@/modules/dealership/stock/stock-list';
import { PageHeader } from '@/core/ui/page-header';

export default async function StockPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'stock.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.stock');
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <StockList slug={slug} businessId={gate.business.id} />
    </>
  );
}
