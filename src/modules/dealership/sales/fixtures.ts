/**
 * Test fixtures for the sales pages. Two unit settings on purpose: one whole-number unit (as a
 * cement dealership uses) and one with decimals (a test-only business), so every form is tried
 * against both decimal rules. No real business's data lives here.
 */
import type {
  Collection,
  Delivery,
  DeliverySummary,
  LedgerPage,
  Order,
  OrderSummary,
} from './types';

export const B = '/b/example-cement';
export const BID = 'b1';

export interface UnitFixture {
  key: string;
  nameEn: string;
  nameBn: string;
  decimals: number;
  /** A valid quantity and one that breaks the unit's decimal rule. */
  good: string;
  bad: string;
}

export const WHOLE_UNIT: UnitFixture = {
  key: 'bag',
  nameEn: 'Bag',
  nameBn: 'বস্তা',
  decimals: 0,
  good: '100',
  bad: '10.5',
};

export const DECIMAL_UNIT: UnitFixture = {
  key: 'tonne',
  nameEn: 'Tonne',
  nameBn: 'টন',
  decimals: 3,
  good: '10.5',
  bad: '10.5555',
};

export const customerRef = {
  id: 'cu1',
  code: 'C-00001',
  nameEn: 'Sample Store One',
  nameBn: 'নমুনা স্টোর এক',
};

export const customerRecord = (overrides: Record<string, unknown> = {}) => ({
  ...customerRef,
  phone: '+8801000000001',
  address: null,
  area: 'Sample Bazar',
  openingBalance: '12500.00',
  currentBalance: '12500.00',
  creditLimit: '30000.00',
  pendingDeliveryQuantity: '0',
  deliveredAmount: '0.00',
  collectedAmount: '0.00',
  isActive: true,
  createdAt: '2026-11-17T08:38:04.236Z',
  updatedAt: '2026-11-17T08:38:04.236Z',
  ...overrides,
});

export const productRef = (unit: UnitFixture, id = 'p1', code = 'P-0001') => ({
  id,
  code,
  nameEn: 'Sample Product One',
  nameBn: 'নমুনা পণ্য এক',
  unitKey: unit.key,
});

export const productRecord = (unit: UnitFixture, id = 'p1', code = 'P-0001') => ({
  ...productRef(unit, id, code),
  category: { id: 'c1', nameEn: 'Group A', nameBn: 'দল ক' },
  isActive: true,
  createdAt: '2026-11-17T08:38:04.236Z',
  updatedAt: '2026-11-17T08:38:04.236Z',
});

export const page = <T>(items: T[], total = items.length) => ({
  items,
  page: 1,
  pageSize: 10,
  total,
});

export const unitsRoute = (unit: UnitFixture) => () =>
  new Response(
    JSON.stringify({
      defaultUnitKey: unit.key,
      items: [{ key: unit.key, nameEn: unit.nameEn, nameBn: unit.nameBn, decimals: unit.decimals }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

export const orderSummary = (
  overrides: Partial<OrderSummary> = {},
  withAmount = true,
): OrderSummary => {
  const o: OrderSummary = {
    id: 'o1',
    code: 'ORD-0001',
    customer: customerRef,
    orderDate: '2026-11-18',
    deliveryWindow: 'two_days',
    deliverBy: '2026-11-20',
    totalQuantity: '100',
    deliveredQuantity: '40',
    remainingQuantity: '60',
    totalAmount: '56500.00',
    status: 'active',
    deliveryStatus: 'partial',
    createdBy: { id: 'u2', name: 'Rahim Uddin' },
    createdAt: '2026-11-18T10:08:50.959Z',
    ...overrides,
  };
  if (!withAmount) delete o.totalAmount;
  return o;
};

export const order = (
  unit: UnitFixture,
  overrides: Partial<Order> = {},
  withAmount = true,
): Order => {
  const o: Order = {
    ...orderSummary({}, withAmount),
    note: 'Deliver to the back gate',
    version: 1,
    items: [
      {
        id: 'oi1',
        product: productRef(unit),
        quantity: '100',
        deliveredQuantity: '40',
        remainingQuantity: '60',
        unitPrice: '565.00',
        lineTotal: '56500.00',
      },
    ],
    deliveries: [
      {
        id: 'd1',
        code: 'DEL-0001',
        deliveryDate: '2026-11-19',
        totalQuantity: '40',
        totalAmount: '22600.00',
        status: 'active',
      },
    ],
    voidedAt: null,
    voidReason: null,
    voidedBy: null,
    updatedAt: '2026-11-18T10:08:50.959Z',
    ...overrides,
  };
  if (!withAmount) {
    for (const item of o.items) {
      delete item.unitPrice;
      delete item.lineTotal;
    }
    for (const d of o.deliveries) delete d.totalAmount;
  }
  return o;
};

export const deliverySummary = (overrides: Partial<DeliverySummary> = {}): DeliverySummary => ({
  id: 'd1',
  code: 'DEL-0001',
  order: { id: 'o1', code: 'ORD-0001' },
  customer: customerRef,
  deliveryDate: '2026-11-19',
  transportReference: 'Truck DHA-11-2233',
  totalQuantity: '40',
  totalAmount: '22600.00',
  status: 'active',
  createdBy: { id: 'u2', name: 'Rahim Uddin' },
  createdAt: '2026-11-19T10:08:51.071Z',
  ...overrides,
});

export const delivery = (unit: UnitFixture, overrides: Partial<Delivery> = {}): Delivery => ({
  ...deliverySummary(),
  note: null,
  version: 1,
  items: [
    {
      id: 'di1',
      orderItemId: 'oi1',
      product: productRef(unit),
      quantity: '40',
      unitPrice: '565.00',
      lineTotal: '22600.00',
    },
  ],
  voidedAt: null,
  voidReason: null,
  voidedBy: null,
  updatedAt: '2026-11-19T10:08:51.071Z',
  ...overrides,
});

export const collection = (overrides: Partial<Collection> = {}): Collection => ({
  id: 'col1',
  code: 'COL-0001',
  customer: customerRef,
  order: { id: 'o1', code: 'ORD-0001' },
  collectionDate: '2026-11-19',
  method: 'bkash',
  amount: '20000.00',
  reference: 'TRX8XK2QW',
  note: null,
  status: 'active',
  version: 1,
  createdBy: { id: 'u5', name: 'Salma Akter' },
  createdAt: '2026-11-19T10:08:51.164Z',
  voidedAt: null,
  voidReason: null,
  voidedBy: null,
  updatedAt: '2026-11-19T10:08:51.164Z',
  ...overrides,
});

export const ledgerPage = (overrides: Partial<LedgerPage> = {}): LedgerPage => ({
  customer: {
    id: 'cu1',
    code: 'C-00001',
    nameEn: 'Sample Store One',
    openingBalance: '12500.00',
    deliveredAmount: '22600.00',
    collectedAmount: '20000.00',
    currentBalance: '15100.00',
    creditLimit: '30000.00',
  },
  items: [
    {
      id: 'le2',
      kind: 'collection',
      amount: '-20000.00',
      entryDate: '2026-11-19',
      source: { type: 'collection', id: 'col1', code: 'COL-0001' },
      reason: null,
      createdBy: { id: 'u5', name: 'Salma Akter' },
      createdAt: '2026-11-19T10:08:51.171Z',
    },
    {
      id: 'le1',
      kind: 'delivery',
      amount: '22600.00',
      entryDate: '2026-11-19',
      source: { type: 'delivery', id: 'd1', code: 'DEL-0001' },
      reason: null,
      createdBy: { id: 'u2', name: 'Rahim Uddin' },
      createdAt: '2026-11-19T10:08:51.088Z',
    },
  ],
  page: 1,
  pageSize: 10,
  total: 2,
  ...overrides,
});
