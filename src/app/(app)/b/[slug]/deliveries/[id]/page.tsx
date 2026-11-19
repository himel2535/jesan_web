import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { DeliveryDetail } from '@/modules/dealership/sales/deliveries/delivery-detail';

export default async function DeliveryPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, 'delivery.view');
  if (!gate.ok) return gate.element;
  return <DeliveryDetail slug={slug} businessId={gate.business.id} id={id} />;
}
