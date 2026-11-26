/** Response shapes of `GET dashboard/*` (docs/API.md §14-ক). Money is always a string. */

export interface CashBucket {
  opening: string;
  collectionsIn: string;
  in: string;
  out: string;
  closing: string;
}

export interface CashbookResponse {
  from: string;
  to: string;
  cash: CashBucket;
  bank: CashBucket;
  /** Ledger rows with no method recorded (e.g. commission receipts). Never in cash or bank. */
  unassigned: CashBucket;
  availableCashAndBank: string;
}

export interface MonthlySeriesRow {
  /** `YYYY-MM` */
  month: string;
  collection: string;
  sales: string;
  salesQuantity: string;
  purchaseQuantity: string;
  /** Absent without `product.cost.view`. */
  purchaseAmount?: string;
}

export interface MonthlySeriesResponse {
  year: number;
  months: MonthlySeriesRow[];
}

export interface CommissionSeriesRow {
  month: string;
  calculated: string;
  received: string;
}

export interface CommissionSeriesResponse {
  year: number;
  months: CommissionSeriesRow[];
  yearCalculated: string;
  yearReceived: string;
  lifetimeCalculated: string;
  lifetimeReceived: string;
  receivable: string;
}
