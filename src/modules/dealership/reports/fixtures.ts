/** Test fixtures for the report pages. No real business's data lives here. */
import type {
  CollectionsReportResponse,
  DailySummaryResponse,
  DuesReportResponse,
  ExpensesReportResponse,
  SalesReportResponse,
  StockMovementsResponse,
  StockReportResponse,
} from './types';

export const B = '/b/example-cement';
export const BID = 'b1';

export { DECIMAL_UNIT, WHOLE_UNIT } from '../sales/fixtures';

export const salesReportResponse = (
  overrides: Partial<SalesReportResponse> = {},
): SalesReportResponse => ({
  from: '2026-11-01',
  to: '2026-11-19',
  groupBy: 'date',
  items: [
    { key: '2026-11-19', label: '2026-11-19', quantity: '120', amount: '72000.00' },
    { key: '2026-11-18', label: '2026-11-18', quantity: '80', amount: '48000.00' },
  ],
  totalQuantity: '200',
  totalAmount: '120000.00',
  page: 1,
  pageSize: 10,
  total: 2,
  ...overrides,
});

export const collectionsReportResponse = (
  overrides: Partial<CollectionsReportResponse> = {},
): CollectionsReportResponse => ({
  from: '2026-11-01',
  to: '2026-11-19',
  groupBy: 'date',
  items: [
    { key: '2026-11-19', count: 3, amount: '9500.00' },
    { key: '2026-11-18', count: 1, amount: '2000.00' },
  ],
  totalAmount: '11500.00',
  page: 1,
  pageSize: 10,
  total: 2,
  ...overrides,
});

export const duesReportResponse = (
  overrides: Partial<DuesReportResponse> = {},
): DuesReportResponse => ({
  items: [
    {
      id: 'c1',
      code: 'C-00007',
      nameEn: 'City Hardware',
      nameBn: 'সিটি হার্ডওয়্যার',
      currentBalance: '9000.00',
      dueAmount: '9000.00',
      advanceAmount: '0.00',
      aging: { d0To7: '4000.00', d8To30: '3000.00', d30Plus: '2000.00' },
    },
    {
      id: 'c2',
      code: 'C-00008',
      nameEn: 'Rahim Traders',
      nameBn: null,
      currentBalance: '-1500.00',
      dueAmount: '0.00',
      advanceAmount: '1500.00',
      aging: { d0To7: '0.00', d8To30: '0.00', d30Plus: '0.00' },
    },
  ],
  totalDue: '9000.00',
  totalAdvance: '1500.00',
  page: 1,
  pageSize: 10,
  total: 2,
  ...overrides,
});

export const stockReportResponse = (
  overrides: Partial<StockReportResponse> = {},
): StockReportResponse => ({
  items: [
    {
      id: 'p1',
      code: 'P-0001',
      nameEn: 'Portland Cement',
      nameBn: 'পোর্টল্যান্ড সিমেন্ট',
      unitKey: 'bag',
      currentStock: '540',
      isActive: true,
    },
    {
      id: 'p2',
      code: 'P-0002',
      nameEn: 'Steel Rod 12mm',
      nameBn: 'স্টিল রড ১২ মিমি',
      unitKey: 'tonne',
      currentStock: '12.500',
      isActive: false,
    },
  ],
  page: 1,
  pageSize: 10,
  total: 2,
  ...overrides,
});

export const stockMovementsResponse = (
  overrides: Partial<StockMovementsResponse> = {},
): StockMovementsResponse => ({
  from: '2026-11-01',
  to: '2026-11-19',
  items: [
    {
      productId: 'p1',
      code: 'P-0001',
      nameEn: 'Portland Cement',
      nameBn: 'পোর্টল্যান্ড সিমেন্ট',
      unitKey: 'bag',
      net: '-60',
      byKind: [
        { kind: 'purchase', quantity: '200' },
        { kind: 'delivery', quantity: '-260' },
      ],
    },
  ],
  page: 1,
  pageSize: 10,
  total: 1,
  ...overrides,
});

export const expensesReportResponse = (
  overrides: Partial<ExpensesReportResponse> = {},
): ExpensesReportResponse => ({
  from: '2026-11-01',
  to: '2026-11-19',
  groupBy: 'category',
  items: [
    { key: 'ec1', label: 'Salaries', count: 2, amount: '15000.00' },
    { key: 'ec2', label: 'Utilities', count: 3, amount: '4200.00' },
  ],
  totalAmount: '19200.00',
  ...overrides,
});

export const dailySummaryResponse = (
  overrides: Partial<DailySummaryResponse> = {},
): DailySummaryResponse => ({
  date: '2026-11-19',
  orders: { count: 4, amount: '48000.00' },
  deliveries: { count: 3, amount: '36000.00' },
  collections: { count: 2, amount: '9500.00' },
  expenses: { count: 1, amount: '2000.00' },
  cash: { openingBalance: '12000.00', closingBalance: '18500.00', net: '6500.00' },
  ...overrides,
});
