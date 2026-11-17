import type { Me, MeBusiness } from '@/core/auth/types';

// Shapes from docs/API.md §7 (example values only).
export const OWNER_PERMISSIONS = [
  'audit.view',
  'collection.create',
  'commission.manage',
  'commission.view',
  'customer.balance.edit',
  'customer.deactivate',
  'customer.due.view',
  'customer.manage',
  'customer.view',
  'expense.create',
  'ledger.entry.create',
  'ledger.view',
  'payment.create',
  'product.cost.view',
  'product.deactivate',
  'product.manage',
  'product.price.edit',
  'product.view',
  'profit.view',
  'purchase.create',
  'purchase.view',
  'purchase.void',
  'reports.finance.view',
  'roles.manage',
  'sale.create',
  'sale.view.all',
  'sale.view.own',
  'sale.void',
  'settings.manage',
  'settings.view',
  'stock.adjust',
  'stock.view',
  'summary.finance.view',
  'supplier.view',
  'users.manage',
  'users.view',
];

export const MANAGER_PERMISSIONS = [
  'collection.create',
  'customer.due.view',
  'customer.manage',
  'customer.view',
  'product.cost.view',
  'product.manage',
  'product.view',
  'purchase.create',
  'purchase.view',
  'sale.create',
  'sale.view.all',
  'settings.view',
  'stock.adjust',
  'stock.view',
  'supplier.view',
  'users.view',
];

export const SALESMAN_PERMISSIONS = [
  'customer.manage',
  'customer.view',
  'product.view',
  'sale.create',
  'sale.view.own',
  'stock.view',
];

export function business(overrides: Partial<MeBusiness> = {}): MeBusiness {
  return {
    id: 'b1',
    slug: 'example-cement',
    nameEn: 'Example Cement',
    nameBn: 'উদাহরণ সিমেন্ট',
    type: 'dealership',
    role: { id: 'r2', key: 'manager', nameEn: 'Manager', nameBn: 'ম্যানেজার' },
    permissions: MANAGER_PERMISSIONS,
    ...overrides,
  };
}

export const managerMe: Me = {
  user: {
    id: 'u2',
    name: 'Rahim Uddin',
    email: 'manager@example.com',
    phone: '+8801712345678',
    isActive: true,
    isPlatformOwner: false,
  },
  businesses: [
    business(),
    business({
      id: 'b2',
      slug: 'example-rod',
      nameEn: 'Example Rod',
      nameBn: 'উদাহরণ রড',
      role: { id: 'r3', key: 'accountant', nameEn: 'Accountant', nameBn: 'হিসাবরক্ষক' },
      permissions: ['customer.view', 'ledger.view', 'settings.view'],
    }),
  ],
};

export const ownerMe: Me = {
  user: {
    ...managerMe.user,
    id: 'u1',
    name: 'Jesan Owner',
    email: 'owner@example.com',
    phone: null,
    isPlatformOwner: true,
  },
  businesses: [
    business({
      role: { id: 'r1', key: 'owner', nameEn: 'Owner', nameBn: 'মালিক' },
      permissions: OWNER_PERMISSIONS,
    }),
  ],
};
