import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { SupplierDetail } from '@/modules/dealership/master-data/suppliers/suppliers';

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, 'supplier.view');
  if (!gate.ok) return gate.element;
  return <SupplierDetail slug={slug} businessId={gate.business.id} id={id} />;
}
