/** Shapes of `/b/:slug/stock` (docs/API.md §10). Quantities and money are strings. */

export interface StockRow {
  id: string;
  code: string;
  nameEn: string;
  nameBn: string;
  unitKey: string;
  category: { id: string; nameEn: string; nameBn: string };
  currentStock: string;
  isActive: boolean;
  /** Both absent without `product.cost.view`; null before the first purchase. */
  lastPurchasePrice?: string | null;
  lastPurchasedAt?: string | null;
}

export type MovementKind = 'purchase' | 'purchase_edit' | 'purchase_void' | 'adjustment';
export const MOVEMENT_KINDS = ['purchase', 'purchase_edit', 'purchase_void', 'adjustment'] as const;

export interface Movement {
  id: string;
  kind: string;
  /** Signed. */
  quantity: string;
  balanceAfter: string;
  movementDate: string;
  source: { type: string; id: string | null; code: string | null };
  reason: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
}

export interface MovementsPage {
  product: Omit<StockRow, 'lastPurchasePrice' | 'lastPurchasedAt'>;
  items: Movement[];
  page: number;
  pageSize: number;
  total: number;
}

export interface MovementFilters {
  from?: string;
  to?: string;
  kind?: MovementKind;
  page: number;
}

export interface StockFilters {
  search?: string;
  categoryId?: string;
  active?: 'true' | 'false' | 'all';
  page?: number;
}
