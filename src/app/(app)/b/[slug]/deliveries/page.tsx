import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { DeliveriesList } from '@/modules/dealership/sales/deliveries/deliveries-list';
import { PageHeader } from '@/core/ui/page-header';

/** `delivery.view` only: a salesman sees deliveries inside their own order, not as a list. */
export default async function DeliveriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'delivery.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.sales.deliveries');
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <DeliveriesList slug={slug} businessId={gate.business.id} />
    </>
  );
}
