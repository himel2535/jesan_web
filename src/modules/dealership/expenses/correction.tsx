'use client';

import type { RequestTarget } from '@/core/approvals/request-dialog';
import { useCan } from '@/core/auth/can';
import { useNameOf } from '../master-data/shared/display';
import { EXPENSE_LIMITS, type Expense, type ExpenseCategory } from './types';

/**
 * What a user may ASK to change (docs/API.md §13): only with `change.request`, only what they
 * cannot change directly. `categoryId` is a correctable field on the API, but nothing in the UI
 * can offer a safe way to type a new category id, so it is left off this list (DECISIONS.md) —
 * someone who needs it corrected asks a manager, who has `expense.edit` and can pick it directly.
 */
export function useExpenseRequestTarget(expense: Expense): RequestTarget | null {
  const canRequest = useCan('change.request');
  const canEdit = useCan('expense.edit');
  const canVoid = useCan('expense.void');
  if (!canRequest || expense.status === 'void') return null;
  const fields: RequestTarget['fields'] = [];
  if (!canEdit) {
    fields.push({ key: 'expenseDate', type: 'date', current: expense.expenseDate });
    fields.push({
      key: 'method',
      type: 'text',
      current: expense.method,
      maxLength: EXPENSE_LIMITS.method,
    });
    fields.push({ key: 'amount', type: 'money', current: expense.amount });
    fields.push({
      key: 'note',
      type: 'text',
      current: expense.note,
      maxLength: EXPENSE_LIMITS.note,
    });
    fields.push({
      key: 'proofNote',
      type: 'text',
      current: expense.proofNote,
      maxLength: EXPENSE_LIMITS.proofNote,
    });
  }
  if (fields.length === 0 && canVoid) return null;
  return {
    entityType: 'expense',
    entityId: expense.id,
    name: expense.code,
    fields,
    voidable: !canVoid,
  };
}

/** The same "ask to deactivate/activate" shape as a master-data category. */
export function useExpenseCategoryRequestTarget(): (c: ExpenseCategory) => RequestTarget | null {
  const nameOf = useNameOf();
  const canRequest = useCan('change.request');
  const canManage = useCan('expense.category.manage');
  return (c) => {
    if (!canRequest || canManage) return null;
    return {
      entityType: 'expense_category',
      entityId: c.id,
      name: nameOf(c),
      fields: [],
      status: { currentlyActive: c.isActive },
    };
  };
}
