import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { OrdersList } from '@/modules/dealership/sales/orders/orders-list';
import { PageHeader } from '@/core/ui/page-header';

export default async function OrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, { anyOf: ['sale.view.all', 'sale.view.own'] });
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.sales.orders');
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <OrdersList slug={slug} businessId={gate.business.id} />
    </>
  );
}
