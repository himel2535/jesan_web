import type { ModuleManifest } from '@/core/module-system/types';

/**
 * What every list page asks for when it is opened with no filter: one page of ten rows. The
 * module's own hooks drop unset filters before building the key, so this is the whole key
 * (`nav-prefetch.test.ts` asserts it against each hook).
 */
const FIRST_PAGE = { page: 1 } as const;

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
    {
      key: 'products',
      path: 'products',
      icon: 'package',
      permission: 'product.view',
      prefetch: 'hover',
      listPrefetch: { entity: 'products', path: 'products', params: FIRST_PAGE },
    },
    {
      key: 'customers',
      path: 'customers',
      icon: 'users',
      permission: 'customer.view',
      prefetch: 'hover',
      listPrefetch: { entity: 'customers', path: 'customers', params: FIRST_PAGE },
    },
    {
      key: 'suppliers',
      path: 'suppliers',
      icon: 'truck',
      permission: 'supplier.view',
      prefetch: 'hover',
      listPrefetch: { entity: 'suppliers', path: 'suppliers', params: FIRST_PAGE },
    },
    {
      key: 'purchases',
      path: 'purchases',
      icon: 'cart',
      permission: 'purchase.view',
      prefetch: 'hover',
      listPrefetch: { entity: 'purchases', path: 'purchases', params: FIRST_PAGE },
    },
    {
      key: 'sales',
      path: 'sales',
      icon: 'receipt',
      permission: { anyOf: ['sale.view.all', 'sale.view.own'] },
      prefetch: 'hover',
      listPrefetch: { entity: 'orders', path: 'orders', params: FIRST_PAGE },
    },
    {
      key: 'deliveries',
      path: 'deliveries',
      icon: 'truck',
      permission: 'delivery.view',
      prefetch: 'hover',
      listPrefetch: { entity: 'deliveries', path: 'deliveries', params: FIRST_PAGE },
    },
    {
      key: 'collections',
      path: 'collections',
      icon: 'wallet',
      permission: 'collection.view',
      prefetch: 'hover',
      listPrefetch: { entity: 'collections', path: 'collections', params: FIRST_PAGE },
    },
    {
      key: 'stock',
      path: 'stock',
      icon: 'boxes',
      permission: 'stock.view',
      prefetch: 'hover',
      listPrefetch: { entity: 'stock', path: 'stock', params: FIRST_PAGE },
    },
    {
      key: 'expenses',
      path: 'expenses',
      icon: 'receipt',
      permission: 'expense.view',
      prefetch: 'hover',
      listPrefetch: { entity: 'expenses', path: 'expenses', params: FIRST_PAGE },
    },
    {
      key: 'cashbook',
      path: 'cashbook',
      icon: 'wallet',
      permission: 'cashbook.view',
      prefetch: 'hover',
    },
    // Future step (proposal §7.8): one combined accounts/ledger page. Different permission and
    // scope from expenses/cashbook above, so left untouched.
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
    // A purchase changes stock and last purchase prices; a large adjustment only the stock.
    purchase: { path: 'purchases/:id', invalidate: ['purchases', 'stock', 'products'] },
    product_stock: { path: 'stock/:id', invalidate: ['stock'] },
    // An order holds the prices, so correcting one re-prices its delivered lines and the ledger.
    sales_order: {
      path: 'sales/:id',
      invalidate: ['orders', 'deliveries', 'customers', 'ledger'],
    },
    // A delivery moves stock and the customer's balance.
    delivery: {
      path: 'deliveries/:id',
      invalidate: ['deliveries', 'orders', 'stock', 'customers', 'ledger'],
    },
    collection: { path: 'collections/:id', invalidate: ['collections', 'customers', 'ledger'] },
    expense: { path: 'expenses/:id', invalidate: ['expenses', 'cashBook'] },
    // A type's status shows on every expense row that uses it.
    expense_category: {
      path: 'expenses/categories/:id',
      invalidate: ['expenseCategories', 'expenses'],
    },
  },
} as const satisfies ModuleManifest;
