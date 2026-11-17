import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { ProductEdit } from '@/modules/dealership/master-data/products/product-edit';

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, 'product.manage');
  if (!gate.ok) return gate.element;
  return <ProductEdit slug={slug} businessId={gate.business.id} id={id} />;
}
