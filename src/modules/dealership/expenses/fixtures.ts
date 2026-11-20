/** Test fixtures for the expense and cash-book pages. No real business's data lives here. */
import type { CashBookResponse, Expense, ExpenseCategory } from './types';

export const B = '/b/example-cement';
export const BID = 'b1';

export const categoryRef = { id: 'ec1', nameEn: 'Salaries', nameBn: 'বেতন' };

export const expenseCategory = (overrides: Partial<ExpenseCategory> = {}): ExpenseCategory => ({
  id: 'ec1',
  nameEn: 'Salaries',
  nameBn: 'বেতন',
  sortOrder: 1,
  isActive: true,
  version: 1,
  createdAt: '2026-11-17T08:38:04.236Z',
  updatedAt: '2026-11-17T08:38:04.236Z',
  ...overrides,
});

export const page = <T>(items: T[], total = items.length) => ({
  items,
  page: 1,
  pageSize: 10,
  total,
});

export const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'exp1',
  code: 'EXP-0001',
  expenseDate: '2026-11-19',
  category: categoryRef,
  method: 'cash',
  amount: '5000.00',
  note: 'November office rent',
  proofNote: 'Receipt 112',
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

export const cashBook = (overrides: Partial<CashBookResponse> = {}): CashBookResponse => ({
  from: '2026-11-01',
  to: '2026-11-19',
  openingBalance: '12000.00',
  closingBalance: '18500.00',
  totals: {
    collections: '9500.00',
    expenses: '2000.00',
    purchases: '1000.00',
    in: '9500.00',
    out: '3000.00',
    net: '6500.00',
    cashIn: '6000.00',
    cashOut: '2500.00',
    cashNet: '3500.00',
  },
  byMethod: [
    { method: 'bank', isCash: false, in: '3500.00', out: '500.00', net: '3000.00' },
    { method: 'cash', isCash: true, in: '6000.00', out: '2500.00', net: '3500.00' },
  ],
  days: [
    {
      date: '2026-11-19',
      opening: '17800.00',
      collections: '700.00',
      expenses: '0.00',
      purchases: '0.00',
      in: '700.00',
      out: '0.00',
      closing: '18500.00',
    },
  ],
  page: 1,
  pageSize: 10,
  total: 1,
  ...overrides,
});
