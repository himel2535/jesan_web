import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { OrderForm } from '@/modules/dealership/sales/orders/order-form';
import { PageHeader } from '@/core/ui/page-header';

export default async function NewOrderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'sale.create');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.sales.orders');
  return (
    <>
      <PageHeader title={t('newTitle')} />
      <OrderForm slug={slug} businessId={gate.business.id} />
    </>
  );
}
