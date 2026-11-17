import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { ProductDetail } from '@/modules/dealership/master-data/products/product-detail';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, 'product.view');
  if (!gate.ok) return gate.element;
  return <ProductDetail slug={slug} businessId={gate.business.id} id={id} />;
}
