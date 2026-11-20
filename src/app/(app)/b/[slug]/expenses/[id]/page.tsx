import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { ExpenseDetail } from '@/modules/dealership/expenses/expense-detail';

export default async function ExpensePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, 'expense.view');
  if (!gate.ok) return gate.element;
  return <ExpenseDetail slug={slug} businessId={gate.business.id} id={id} />;
}
