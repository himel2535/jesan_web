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
  /** Sold Products Purchase Cost: each bag at the price of the purchase batch it came from (FIFO). */
  cogs?: string;
  /** sales − cogs. */
  grossProfit?: string;
  netProfit?: string;
  /** Above zero, COGS is understated by an unknown amount. */
  uncostedQuantityDelivered?: string;
  uncostedQuantityOnHand?: string;
  /** Delivery lines whose cost is unknown in whole or in part. */
  uncostedDeliveryLines?: number;
  productsWithUnknownCostStock?: number;
  /** False when any bag delivered in the window had no known cost: cogs and profit are incomplete. */
  costComplete?: boolean;
  /** Absent without `purchase.view`. */
  purchaseQuantity?: string;
  openingStockQuantity?: string;
  closingStockQuantity?: string;
  openingStockValue?: string;
  closingStockValue?: string;
}

/** One window of `GET dashboard/kpis`. `purchaseQuantity` is absent without `purchase.view`. */
export interface KpiWindow {
  from: string;
  to: string;
  collection: string;
  sales: string;
  salesQuantity: string;
  purchaseQuantity?: string;
}

export interface KpisResponse {
  current: KpiWindow;
}
