import type { ModuleManifest } from '@/core/module-system/types';

/**
 * Generic dealership module (one module for every dealership business; names, units and rules
 * come from the business's data, never from code). Sidebar order follows proposal §7.
 *
 * Permissions only decide what is SHOWN; jesan-api enforces them (403 / omitted fields).
 * Commission and reports need owner-only or finance permissions, so a manager never sees them.
 */
export const dealershipManifest = {
  type: 'dealership',
  namespace: 'dealership',
  nav: [
    { key: 'dashboard', path: '', icon: 'dashboard', prefetch: 'hover' },
    { key: 'products', path: 'products', icon: 'package', permission: 'product.view' },
    { key: 'customers', path: 'customers', icon: 'users', permission: 'customer.view' },
    { key: 'suppliers', path: 'suppliers', icon: 'truck', permission: 'supplier.view' },
    { key: 'purchases', path: 'purchases', icon: 'cart', permission: 'purchase.view' },
    {
      key: 'sales',
      path: 'sales',
      icon: 'receipt',
      permission: { anyOf: ['sale.view.all', 'sale.view.own'] },
    },
    { key: 'stock', path: 'stock', icon: 'boxes', permission: 'stock.view' },
    { key: 'accounts', path: 'accounts', icon: 'wallet', permission: 'ledger.view' },
    { key: 'commission', path: 'commission', icon: 'percent', permission: 'commission.view' },
    { key: 'reports', path: 'reports', icon: 'chart', permission: 'reports.finance.view' },
    { key: 'settings', path: 'settings', icon: 'settings', permission: 'settings.view' },
  ],
  // Change requests (core approvals inbox): record page + what an approval refreshes.
  changeEntities: {
    product: { path: 'products/:id', invalidate: ['products'] },
    customer: { path: 'customers/:id', invalidate: ['customers'] },
    // A category's status shows in every product row too.
    product_category: { path: 'products/categories/:id', invalidate: ['categories', 'products'] },
  },
} as const satisfies ModuleManifest;
