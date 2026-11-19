/** Shapes of the master-data API (docs/API.md §9). Money is always a string. */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type ActiveFilter = 'true' | 'false' | 'all';

export interface Unit {
  key: string;
  nameEn: string;
  nameBn: string;
  /** Decimal places allowed in quantities (bag: 0 = whole numbers). */
  decimals: number;
}

export interface UnitsResponse {
  defaultUnitKey: string;
  items: Unit[];
}

export interface Category {
  id: string;
  nameEn: string;
  nameBn: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  code: string;
  category: { id: string; nameEn: string; nameBn: string };
  nameEn: string;
  nameBn: string;
  unitKey: string;
  /**
   * Read-only: price and time of the last valid purchase (set by purchases, never by hand).
   * Both null until the first purchase; both absent (not null) without `product.cost.view`.
   */
  lastPurchasePrice?: string | null;
  lastPurchasedAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  code: string;
  nameEn: string;
  nameBn: string | null;
  phone: string;
  address: string | null;
  area: string | null;
  /** The three below are absent without `customer.due.view`. Negative = advance. */
  openingBalance?: string;
  currentBalance?: string;
  /** null = no limit. */
  creditLimit?: string | null;
  /** Bags still to deliver on active orders; everyone with `customer.view` sees it (§11). */
  pendingDeliveryQuantity?: string;
  /** Both absent without `customer.due.view`. */
  deliveredAmount?: string;
  collectedAmount?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  code: string;
  nameEn: string;
  nameBn: string;
  phone: string | null;
  address: string | null;
  isPrincipal: boolean;
  isActive: boolean;
}

export interface ListParams {
  search?: string;
  active?: ActiveFilter;
  page?: number;
  categoryId?: string;
}

/** Field limits copied from jesan-api DTOs (master-data/dto/requests.ts). */
export const LIMITS = {
  name: 120,
  phone: 20,
  address: 255,
  area: 80,
  search: 100,
  reasonMin: 3,
  reasonMax: 500,
  sortOrderMax: 10000,
} as const;
