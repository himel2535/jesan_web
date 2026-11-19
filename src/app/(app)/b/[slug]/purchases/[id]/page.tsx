import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { PurchaseDetail } from '@/modules/dealership/purchases/purchase-detail';

export default async function PurchasePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, 'purchase.view');
  if (!gate.ok) return gate.element;
  return <PurchaseDetail slug={slug} businessId={gate.business.id} id={id} />;
}
