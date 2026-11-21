'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import { ApiError } from '@/core/api/errors';
import { dealershipKeys } from '../master-data/api';
import type { Page } from '../master-data/types';
import { useExpensesReport } from '../reports/api';
import type { ExpenseSummaryRanges } from './shared';
import type {
  CashBookFilters,
  CashBookResponse,
  Expense,
  ExpenseCategory,
  ExpenseCategoryPatch,
  ExpenseFilters,
  ExpenseInput,
  ExpensePatch,
} from './types';

const base = (slug: string) => `/b/${encodeURIComponent(slug)}`;

/**
 * What each change touches (docs/API.md §13): an expense only ever affects the expense list, the
 * derived cash book and the Expenses-page KPI cards (`reports/expenses`, `report.view`); an
 * expense type's status shows on every expense row that uses it.
 */
export const EXPENSE_REFRESH = ['expenses', 'cashBook', 'reportsExpenses'] as const;
export const EXPENSE_CATEGORY_REFRESH = [
  'expenseCategories',
  'expenses',
  'reportsExpenses',
] as const;

function useInvalidate(businessId: string) {
  const queryClient = useQueryClient();
  return (entities: readonly string[]) =>
    Promise.all(
      entities.map((entity) =>
        queryClient.invalidateQueries({ queryKey: dealershipKeys.entity(businessId, entity) }),
      ),
    );
}

/** Only set filters reach the key and the query string. */
function clean<T extends { page: number }>(filters: T, keys: readonly (keyof T)[]) {
  const out: Record<string, string | number> = { page: filters.page };
  for (const key of keys) {
    const value = filters[key];
    if (typeof value === 'string' && value) out[String(key)] = value;
  }
  return out;
}

/** A 404 means the list on screen is stale: refresh that entity too. */
const refreshOn404 = (refresh: () => Promise<unknown>) => (error: unknown) =>
  error instanceof ApiError && error.status === 404 ? refresh() : undefined;

// ---- Expense categories ----

export function useExpenseCategories(
  slug: string,
  businessId: string,
  active: 'true' | 'false' | 'all' = 'true',
) {
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'expenseCategories', { active }),
    queryFn: ({ signal }) =>
      apiFetch<{ items: ExpenseCategory[] }>(`${base(slug)}/expense-categories`, {
        query: { active },
        signal,
      }).then((r) => r.items),
    staleTime: 5 * 60_000, // business settings: rarely change, wanted by several pages
  });
}

export function useSaveExpenseCategory(slug: string, businessId: string) {
  const invalidate = useInvalidate(businessId);
  const refresh = () => invalidate(EXPENSE_CATEGORY_REFRESH);
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: ExpenseCategoryPatch }) =>
      id
        ? apiFetch<ExpenseCategory>(`${base(slug)}/expense-categories/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body,
          })
        : apiFetch<ExpenseCategory>(`${base(slug)}/expense-categories`, { method: 'POST', body }),
    onSuccess: refresh,
    onError: refreshOn404(refresh),
  });
}

/** The business's own expense payment methods; no method name ever lives in code. */
export function useExpenseMethods(slug: string, businessId: string, enabled = true) {
  return useQuery({
    queryKey: dealershipKeys.entity(businessId, 'expenseMethods'),
    queryFn: ({ signal }) =>
      apiFetch<{ items: string[] }>(`${base(slug)}/expense-methods`, { signal }).then(
        (r) => r.items,
      ),
    staleTime: 5 * 60_000, // business settings: rarely change
    enabled,
  });
}

// ---- Expenses ----

const EXPENSE_FILTER_KEYS = ['from', 'to', 'categoryId', 'method', 'status'] as const;

export function useExpenses(
  slug: string,
  businessId: string,
  filters: ExpenseFilters,
  enabled = true,
) {
  const query = clean(filters, EXPENSE_FILTER_KEYS);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'expenses', query),
    queryFn: ({ signal }) => apiFetch<Page<Expense>>(`${base(slug)}/expenses`, { query, signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * The four KPI cards on the Expenses page. Each window reuses `GET reports/expenses` (the only
 * endpoint with a real amount total — the plain `GET expenses` list only has a row count), so it
 * needs `report.view`, not `expense.view`: a user without it gets a 403 on all four, and the page
 * hides the cards rather than erroring (see `ExpensesSummaryCards`).
 */
export function useExpensesSummary(slug: string, businessId: string, ranges: ExpenseSummaryRanges) {
  const total = useExpensesReport(slug, businessId, { groupBy: 'category', ...ranges.total });
  const today = useExpensesReport(slug, businessId, { groupBy: 'category', ...ranges.today });
  const thisMonth = useExpensesReport(slug, businessId, {
    groupBy: 'category',
    ...ranges.thisMonth,
  });
  const previousMonth = useExpensesReport(slug, businessId, {
    groupBy: 'category',
    ...ranges.previousMonth,
  });
  return { total, today, thisMonth, previousMonth };
}

export function useExpense(slug: string, businessId: string, id: string) {
  return useQuery({
    queryKey: dealershipKeys.detail(businessId, 'expenses', id),
    queryFn: ({ signal }) =>
      apiFetch<Expense>(`${base(slug)}/expenses/${encodeURIComponent(id)}`, { signal }),
  });
}

export function useCreateExpense(slug: string, businessId: string) {
  const invalidate = useInvalidate(businessId);
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: ExpenseInput; idempotencyKey: string }) =>
      apiFetch<Expense>(`${base(slug)}/expenses`, {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: () => invalidate(EXPENSE_REFRESH),
  });
}

export function useCorrectExpense(slug: string, businessId: string) {
  const invalidate = useInvalidate(businessId);
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ExpensePatch }) =>
      apiFetch<Expense>(`${base(slug)}/expenses/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => invalidate(EXPENSE_REFRESH),
  });
}

export function useVoidExpense(slug: string, businessId: string) {
  const invalidate = useInvalidate(businessId);
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch<Expense>(`${base(slug)}/expenses/${encodeURIComponent(id)}/void`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => invalidate(EXPENSE_REFRESH),
  });
}

// ---- Cash book ----

const CASH_BOOK_FILTER_KEYS = ['from', 'to'] as const;

/**
 * The daily cash book (`cashbook.view`): not a table, counted directly from collections,
 * expenses and cash purchases. `from`/`to` default to the current month on the server when left
 * out, so an empty filter here is a deliberate request for "this month", not a stale one.
 */
export function useCashBook(slug: string, businessId: string, filters: CashBookFilters) {
  const query = clean(filters, CASH_BOOK_FILTER_KEYS);
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'cashBook', query),
    queryFn: ({ signal }) =>
      apiFetch<CashBookResponse>(`${base(slug)}/cash-book`, { query, signal }),
    placeholderData: keepPreviousData,
  });
}
