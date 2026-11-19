/**
 * Shapes of `/b/:slug/{orders,deliveries,collections}` and the customer ledger
 * (docs/API.md §11). Money and quantities are always strings, never numbers.
 */
import type { NamedRef } from '../purchases/types';

export type { NamedRef };

export interface CustomerRef {
  id: string;
  code: string;
  nameEn: string;
  nameBn: string | null;
}

export interface ProductRef {
  id: string;
  code: string;
  nameEn: string;
  nameBn: string;
  unitKey: string;
}

export interface OrderRef {
  id: string;
  code: string;
}

/** Urgency of an order; the API's fixed list (docs/API.md §11). */
export const DELIVERY_WINDOWS = ['today', 'two_days', 'one_week'] as const;
export type DeliveryWindow = (typeof DELIVERY_WINDOWS)[number];

export type DocumentStatus = 'active' | 'void';
export type OrderDeliveryStatus = 'pending' | 'partial' | 'delivered';
/** What `?status=` accepts on the order list. */
export const ORDER_STATUS_FILTERS = ['open', 'pending', 'partial', 'delivered', 'void'] as const;
export type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number];

export interface OrderSummary {
  id: string;
  code: string;
  customer: CustomerRef;
  /** YYYY-MM-DD in the business time zone. */
  orderDate: string;
  deliveryWindow: DeliveryWindow;
  deliverBy: string | null;
  totalQuantity: string;
  deliveredQuantity: string;
  remainingQuantity: string;
  /** Absent when the API does not send it for this viewer. */
  totalAmount?: string;
  status: DocumentStatus;
  deliveryStatus: OrderDeliveryStatus;
  createdBy: NamedRef;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  product: ProductRef;
  quantity: string;
  deliveredQuantity: string;
  remainingQuantity: string;
  /** Both absent when the API does not send prices to this viewer. */
  unitPrice?: string;
  lineTotal?: string;
}

/** The delivery summaries carried inside an order (what a salesman sees of its deliveries). */
export interface OrderDeliveryRef {
  id: string;
  code: string;
  deliveryDate: string;
  totalQuantity: string;
  totalAmount?: string;
  status: DocumentStatus;
}

export interface Order extends OrderSummary {
  note: string | null;
  version: number;
  items: OrderItem[];
  deliveries: OrderDeliveryRef[];
  voidedAt: string | null;
  voidReason: string | null;
  voidedBy: NamedRef | null;
  updatedAt: string;
}

export interface OrderFilters {
  status?: OrderStatusFilter;
  customerId?: string;
  from?: string;
  to?: string;
  page: number;
}

export interface OrderInput {
  customerId: string;
  deliveryWindow: DeliveryWindow;
  deliverBy?: string;
  orderDate?: string;
  note?: string;
  items: { productId: string; quantity: string; unitPrice: string }[];
}

export interface OrderPatch {
  orderDate?: string;
  deliveryWindow?: DeliveryWindow;
  deliverBy?: string | null;
  note?: string;
  items?: { id: string; quantity?: string; unitPrice?: string }[];
  reason?: string;
}

// ---- Deliveries ----

export interface DeliveryItem {
  id: string;
  orderItemId: string;
  product: ProductRef;
  quantity: string;
  unitPrice?: string;
  lineTotal?: string;
}

export interface DeliverySummary {
  id: string;
  code: string;
  order: OrderRef;
  customer: CustomerRef;
  deliveryDate: string;
  transportReference: string | null;
  totalQuantity: string;
  totalAmount?: string;
  /** Only with `customer.due.view`; true means the credit limit was passed (warn mode). */
  creditLimitExceeded?: boolean;
  status: DocumentStatus;
  createdBy: NamedRef;
  createdAt: string;
}

export interface Delivery extends DeliverySummary {
  note: string | null;
  version: number;
  items: DeliveryItem[];
  voidedAt: string | null;
  voidReason: string | null;
  voidedBy: NamedRef | null;
  updatedAt: string;
}

export interface DeliveryFilters {
  orderId?: string;
  customerId?: string;
  status?: DocumentStatus;
  from?: string;
  to?: string;
  page: number;
}

export interface DeliveryInput {
  orderId: string;
  deliveryDate?: string;
  transportReference?: string;
  note?: string;
  items: { orderItemId: string; quantity: string }[];
}

export interface DeliveryPatch {
  deliveryDate?: string;
  transportReference?: string;
  note?: string;
  items?: { id: string; quantity?: string }[];
  reason?: string;
}

// ---- Collections ----

export interface Collection {
  id: string;
  code: string;
  customer: CustomerRef;
  order: OrderRef | null;
  collectionDate: string;
  /** A key of the business's own list (`GET collection-methods`), never a fixed name in code. */
  method: string;
  amount: string;
  reference: string | null;
  note: string | null;
  status: DocumentStatus;
  version: number;
  createdBy: NamedRef;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  voidedBy: NamedRef | null;
  updatedAt: string;
}

export interface CollectionFilters {
  customerId?: string;
  orderId?: string;
  method?: string;
  status?: DocumentStatus;
  from?: string;
  to?: string;
  page: number;
}

export interface CollectionInput {
  customerId: string;
  orderId?: string;
  method: string;
  amount: string;
  collectionDate?: string;
  reference?: string;
  note?: string;
}

export interface CollectionPatch {
  collectionDate?: string;
  method?: string;
  amount?: string;
  reference?: string;
  note?: string;
  reason?: string;
}

// ---- Customer ledger ----

export const LEDGER_KINDS = [
  'delivery',
  'delivery_edit',
  'delivery_void',
  'collection',
  'collection_edit',
  'collection_void',
] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  /** Signed: positive means the customer owes more. */
  amount: string;
  entryDate: string;
  source: { type: 'delivery' | 'collection'; id: string; code: string };
  reason: string | null;
  createdBy: NamedRef;
  createdAt: string;
}

/** The ledger's customer summary; the server computes every number here. */
export interface LedgerCustomer {
  id: string;
  code: string;
  nameEn: string;
  nameBn?: string | null;
  openingBalance: string;
  deliveredAmount: string;
  collectedAmount: string;
  currentBalance: string;
  creditLimit: string | null;
}

export interface LedgerPage {
  customer: LedgerCustomer;
  items: LedgerEntry[];
  page: number;
  pageSize: number;
  total: number;
}

export interface LedgerFilters {
  from?: string;
  to?: string;
  page: number;
}

/** Field limits copied from the jesan-api DTOs (docs/API.md §11). */
export const SALES_LIMITS = {
  lines: 50,
  note: 500,
  reference: 64,
  transportReference: 64,
} as const;
