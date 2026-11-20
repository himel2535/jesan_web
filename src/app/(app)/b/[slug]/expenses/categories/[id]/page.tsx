import { ExpenseCategoryDetail } from '@/modules/dealership/expenses/categories/expense-category-detail';
import { dealershipPage } from '@/modules/dealership/master-data/guard';

export default async function ExpenseCategoryPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, 'expense.category.manage');
  if (!gate.ok) return gate.element;
  return <ExpenseCategoryDetail slug={slug} businessId={gate.business.id} id={id} />;
}
