/** Shapes of `/b/:slug/purchases` (docs/API.md §10). Money and quantities are strings. */

export interface NamedRef {
  id: string;
  name: string;
}

export interface SupplierRef {
  id: string;
  code: string;
  nameEn: string;
  nameBn: string;
}

export type PurchaseStatus = 'active' | 'void';

export interface PurchaseSummary {
  id: string;
  code: string;
  /** YYYY-MM-DD in the business time zone. */
  purchaseDate: string;
  supplier: SupplierRef;
  paymentMethod: string;
  itemCount: number;
  totalQuantity: string;
  /** Absent without `product.cost.view`. */
  totalAmount?: string;
  status: PurchaseStatus;
  supplierReference: string | null;
  createdBy: NamedRef;
  createdAt: string;
}

export interface PurchaseItem {
  id: string;
  product: { id: string; code: string; nameEn: string; nameBn: string; unitKey: string };
  quantity: string;
  /** Both absent without `product.cost.view`. */
  unitPrice?: string;
  lineTotal?: string;
}

export interface Purchase extends PurchaseSummary {
  note: string | null;
  version: number;
  items: PurchaseItem[];
  voidedAt: string | null;
  voidReason: string | null;
  voidedBy: NamedRef | null;
  updatedAt: string;
}

export interface PurchaseFilters {
  from?: string;
  to?: string;
  supplierId?: string;
  productId?: string;
  status?: PurchaseStatus;
  page: number;
}

export interface PurchaseInput {
  purchaseDate?: string;
  supplierId?: string;
  note?: string;
  supplierReference?: string;
  items: { productId: string; quantity: string; unitPrice: string }[];
}

export interface PurchasePatch {
  purchaseDate?: string;
  note?: string;
  supplierReference?: string;
  items?: { id: string; quantity?: string; unitPrice?: string }[];
  reason?: string;
}

export const PURCHASE_LIMITS = { lines: 50, note: 500, supplierReference: 64 } as const;
