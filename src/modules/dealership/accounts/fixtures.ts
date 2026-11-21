import type { AccountsSummary, LedgerItem, LedgerResponse } from './types';

export const SUMMARY: AccountsSummary = {
  from: '2025-01-01',
  to: '2025-01-31',
  totalIn: '250000.00',
  totalOut: '180000.00',
  net: '70000.00',
  totalDue: '45000.00',
  totalAdvance: '12000.00',
  byType: [
    { type: 'collection', in: '200000.00', out: '0.00' },
    { type: 'expense', in: '0.00', out: '50000.00' },
    { type: 'purchase', in: '0.00', out: '120000.00' },
    { type: 'manual', in: '50000.00', out: '10000.00' },
  ],
};

export const NEGATIVE_SUMMARY: AccountsSummary = {
  ...SUMMARY,
  net: '-5000.00',
};

export const LEDGER_ITEMS: LedgerItem[] = [
  {
    id: 'le-1',
    type: 'collection',
    direction: 'in',
    amount: '50000.00',
    method: 'cash',
    referenceType: 'collection',
    referenceId: 'col-1',
    entryDate: '2025-01-15',
    note: 'Monthly collection',
    status: 'active',
    createdBy: { id: 'u1', name: 'Admin' },
    createdAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 'le-2',
    type: 'expense',
    direction: 'out',
    amount: '10000.00',
    method: 'bkash',
    referenceType: 'expense',
    referenceId: 'exp-1',
    entryDate: '2025-01-16',
    note: null,
    status: 'active',
    createdBy: { id: 'u1', name: 'Admin' },
    createdAt: '2025-01-16T11:00:00Z',
  },
  {
    id: 'le-3',
    type: 'manual',
    direction: 'in',
    amount: '5000.00',
    method: null,
    referenceType: null,
    referenceId: null,
    entryDate: '2025-01-17',
    note: 'Misc income',
    status: 'void',
    createdBy: { id: 'u1', name: 'Admin' },
    createdAt: '2025-01-17T09:00:00Z',
  },
];

export const LEDGER_RESPONSE: LedgerResponse = {
  items: LEDGER_ITEMS,
  page: 1,
  pageSize: 10,
  total: 3,
};

export const COLLECTION_METHODS = { items: ['cash', 'bkash', 'nagad', 'bank'] };
