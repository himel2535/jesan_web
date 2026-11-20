import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { EntryDetail } from '@/modules/dealership/commission/entry-detail';

export default async function CommissionEntryPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, 'commission.view');
  if (!gate.ok) return gate.element;
  return <EntryDetail slug={slug} businessId={gate.business.id} id={id} />;
}
