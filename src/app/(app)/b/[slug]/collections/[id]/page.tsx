import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { CollectionDetail } from '@/modules/dealership/sales/collections/collection-detail';

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, 'collection.view');
  if (!gate.ok) return gate.element;
  return <CollectionDetail slug={slug} businessId={gate.business.id} id={id} />;
}
