import { getTranslations } from 'next-intl/server';
import { ExpenseCategoriesPanel } from '@/modules/dealership/expenses/categories/expense-categories-panel';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { PageHeader } from '@/core/ui/page-header';

export default async function ExpenseCategoriesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'expense.category.manage');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.expenses.categories');
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <ExpenseCategoriesPanel slug={slug} businessId={gate.business.id} />
    </>
  );
}
