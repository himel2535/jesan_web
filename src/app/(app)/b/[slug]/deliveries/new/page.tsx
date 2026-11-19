import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { DeliveryForm } from '@/modules/dealership/sales/deliveries/delivery-form';
import { PageHeader } from '@/core/ui/page-header';

export default async function NewDeliveryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'delivery.create');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.sales.deliveries');
  return (
    <>
      <PageHeader title={t('newTitle')} />
      <DeliveryForm slug={slug} businessId={gate.business.id} />
    </>
  );
}
