/**
 * Shapes of `/b/:slug/{expense-categories,expense-methods,expenses,cash-book}` (docs/API.md §13).
 * Money is always a string; nothing here is computed in the browser.
 */
import type { NamedRef } from '../purchases/types';

export type { NamedRef };

export type DocumentStatus = 'active' | 'void';

export interface ExpenseCategory {
  id: string;
  nameEn: string;
  nameBn: string;
  sortOrder: number;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseCategoryInput = { nameEn?: string; nameBn?: string; sortOrder?: number };
export type ExpenseCategoryPatch = ExpenseCategoryInput & { isActive?: boolean; reason?: string };

export interface ExpenseCategoryRef {
  id: string;
  nameEn: string;
  nameBn: string;
}

export interface Expense {
  id: string;
  code: string;
  expenseDate: string;
  category: ExpenseCategoryRef;
  /** A key of the business's own list (`GET expense-methods`), never a fixed name in code. */
  method: string;
  amount: string;
  note: string | null;
  proofNote: string | null;
  status: DocumentStatus;
  version: number;
  createdBy: NamedRef;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  voidedBy: NamedRef | null;
  updatedAt: string;
}

export interface ExpenseFilters {
  from?: string;
  to?: string;
  categoryId?: string;
  method?: string;
  status?: DocumentStatus;
  page: number;
}

export interface ExpenseInput {
  expenseDate?: string;
  categoryId: string;
  method: string;
  amount: string;
  note?: string;
  proofNote?: string;
}

export interface ExpensePatch {
  expenseDate?: string;
  categoryId?: string;
  method?: string;
  amount?: string;
  note?: string;
  proofNote?: string;
  reason?: string;
}

// ---- Cash book ----

export interface CashBookMethodRow {
  method: string;
  /** True when this method moves physical cash (business setting: `cashMethodKeys`). */
  isCash: boolean;
  in: string;
  out: string;
  net: string;
}

export interface CashBookTotals {
  collections: string;
  expenses: string;
  purchases: string;
  in: string;
  out: string;
  net: string;
  cashIn: string;
  cashOut: string;
  cashNet: string;
}

export interface CashBookDay {
  date: string;
  opening: string;
  collections: string;
  expenses: string;
  purchases: string;
  in: string;
  out: string;
  closing: string;
}

export interface CashBookResponse {
  from: string;
  to: string;
  openingBalance: string;
  closingBalance: string;
  totals: CashBookTotals;
  byMethod: CashBookMethodRow[];
  /** Only the days something happened, oldest first; paginated 10 per page. */
  days: CashBookDay[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CashBookFilters {
  from?: string;
  to?: string;
  page: number;
}

/** Field limits copied from the jesan-api DTOs (docs/API.md §13). */
export const EXPENSE_LIMITS = {
  nameEn: 80,
  nameBn: 80,
  note: 500,
  proofNote: 200,
  method: 16,
} as const;
