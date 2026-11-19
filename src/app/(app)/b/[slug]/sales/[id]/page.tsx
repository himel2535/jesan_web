import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { OrderDetail } from '@/modules/dealership/sales/orders/order-detail';

export default async function OrderPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, { anyOf: ['sale.view.all', 'sale.view.own'] });
  if (!gate.ok) return gate.element;
  return <OrderDetail slug={slug} businessId={gate.business.id} id={id} />;
}
