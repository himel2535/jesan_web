import { CategoryDetail } from '@/modules/dealership/master-data/categories/category-detail';
import { dealershipPage } from '@/modules/dealership/master-data/guard';

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, 'product.view');
  if (!gate.ok) return gate.element;
  return <CategoryDetail slug={slug} businessId={gate.business.id} id={id} />;
}
