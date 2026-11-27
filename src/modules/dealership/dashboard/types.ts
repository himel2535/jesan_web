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
  received: string;
}

export interface CommissionSeriesResponse {
  year: number;
  months: CommissionSeriesRow[];
  yearReceived: string;
  lifetimeReceived: string;
}

/** `GET dashboard/finance-summary`. Cost and profit fields need `profit.view`. */
export interface FinanceSummaryResponse {
  from: string;
  to: string;
  sales: string;
  collection: string;
  customerDue: string;
  expenses: string;
  commissionReceived: string;
  /** Absent without `profit.view`. */
  totalPurchase?: string;
  currentStockQuantity?: string;
  currentStockValue?: string;
  /** Sold Products Purchase Cost. */
  cogs?: string;
  netProfit?: string;
  /** Above zero, COGS is understated by an unknown amount. */
  uncostedQuantityDelivered?: string;
  uncostedQuantityOnHand?: string;
  uncostedDeliveryLines?: number;
}
