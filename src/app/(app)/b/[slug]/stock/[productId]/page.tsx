import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { StockHistory } from '@/modules/dealership/stock/stock-history';

export default async function StockHistoryPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;
  const gate = await dealershipPage(slug, 'stock.view');
  if (!gate.ok) return gate.element;
  return <StockHistory slug={slug} businessId={gate.business.id} productId={productId} />;
}
