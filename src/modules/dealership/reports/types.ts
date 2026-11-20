/** Shapes of the read-only reports (docs/API.md §13, jesan-api `reports/dto/responses.ts`). */
import type { Page } from '../master-data/types';

export const SALES_GROUP_BY = ['date', 'customer', 'product', 'category'] as const;
export type SalesGroupBy = (typeof SALES_GROUP_BY)[number];

export interface SalesReportRow {
  key: string;
  label: string;
  quantity: string;
  amount: string;
}

export interface SalesReportResponse extends Page<SalesReportRow> {
  from: string;
  to: string;
  groupBy: SalesGroupBy;
  totalQuantity: string;
  totalAmount: string;
}

export interface SalesReportFilters {
  groupBy: SalesGroupBy;
  from?: string;
  to?: string;
  page: number;
}

export const COLLECTIONS_GROUP_BY = ['date', 'method'] as const;
export type CollectionsGroupBy = (typeof COLLECTIONS_GROUP_BY)[number];

/** No `label`: `date` groupBy needs `useBusinessDay()(key)`, `method` needs `useMethodLabel()(key)`. */
export interface CollectionsReportRow {
  key: string;
  count: number;
  amount: string;
}

export interface CollectionsReportResponse extends Page<CollectionsReportRow> {
  from: string;
  to: string;
  groupBy: CollectionsGroupBy;
  totalAmount: string;
}

export interface CollectionsReportFilters {
  groupBy: CollectionsGroupBy;
  from?: string;
  to?: string;
  page: number;
}

export interface DuesAging {
  d0To7: string;
  d8To30: string;
  d30Plus: string;
}

export interface DuesReportRow {
  id: string;
  code: string;
  nameEn: string;
  nameBn: string | null;
  currentBalance: string;
  dueAmount: string;
  advanceAmount: string;
  aging: DuesAging;
}

export interface DuesReportResponse extends Page<DuesReportRow> {
  totalDue: string;
  totalAdvance: string;
}

export interface DuesReportFilters {
  page: number;
}

export interface StockReportRow {
  id: string;
  code: string;
  nameEn: string;
  nameBn: string;
  unitKey: string;
  currentStock: string;
  isActive: boolean;
}

export type StockReportResponse = Page<StockReportRow>;

export interface StockReportFilters {
  page: number;
}

export interface StockMovementKind {
  kind: string;
  quantity: string;
}

/** `productId`, not `id` — matches jesan-api's `StockMovementsReportRow` exactly. */
export interface StockMovementsRow {
  productId: string;
  code: string;
  nameEn: string;
  nameBn: string;
  unitKey: string;
  net: string;
  byKind: StockMovementKind[];
}

export interface StockMovementsResponse extends Page<StockMovementsRow> {
  from: string;
  to: string;
}

export interface StockMovementsFilters {
  from?: string;
  to?: string;
  page: number;
}

export const EXPENSES_REPORT_GROUP_BY = ['category', 'month'] as const;
export type ExpensesReportGroupBy = (typeof EXPENSES_REPORT_GROUP_BY)[number];

export interface ExpensesReportRow {
  key: string;
  label: string;
  count: number;
  amount: string;
}

/** No pagination: jesan-api's `ExpensesReportResponse` does not extend `PageInfo`. */
export interface ExpensesReportResponse {
  from: string;
  to: string;
  groupBy: ExpensesReportGroupBy;
  items: ExpensesReportRow[];
  totalAmount: string;
}

export interface ExpensesReportFilters {
  groupBy: ExpensesReportGroupBy;
  from?: string;
  to?: string;
}

export interface DailySummaryStat {
  count: number;
  amount: string;
}

export interface DailySummaryCash {
  openingBalance: string;
  closingBalance: string;
  net: string;
}

/** `cash` is absent (not just empty) without `cashbook.view` — the API omits it server-side. */
export interface DailySummaryResponse {
  date: string;
  orders: DailySummaryStat;
  deliveries: DailySummaryStat;
  collections: DailySummaryStat;
  expenses: DailySummaryStat;
  cash?: DailySummaryCash;
}
