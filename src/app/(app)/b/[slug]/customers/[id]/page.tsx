import { CustomerDetail } from '@/modules/dealership/master-data/customers/customer-detail';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { CustomerTabs } from '@/modules/dealership/sales/customer/customer-tabs';

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, 'customer.view');
  if (!gate.ok) return gate.element;
  return (
    <>
      <CustomerTabs slug={slug} customerId={id} business={gate.business} />
      <CustomerDetail slug={slug} businessId={gate.business.id} id={id} />
    </>
  );
}
