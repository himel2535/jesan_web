import { CustomerEdit } from '@/modules/dealership/master-data/customers/customer-detail';
import { dealershipPage } from '@/modules/dealership/master-data/guard';

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, 'customer.manage');
  if (!gate.ok) return gate.element;
  return <CustomerEdit slug={slug} businessId={gate.business.id} id={id} />;
}
