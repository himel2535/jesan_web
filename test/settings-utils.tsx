import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import bn from '../messages/bn.json';
import en from '../messages/en.json';
import { BusinessProvider, SessionProvider } from '@/core/auth/session-context';
import type { Me } from '@/core/auth/types';
import type { RolesMatrix } from '@/core/settings/types';
import { MANAGER_PERMISSIONS, OWNER_PERMISSIONS } from './fixtures/me';

/** Renders inside Query + intl + session + the first business, like a /b/[slug] page. */
export function renderInBusiness(
  ui: ReactElement,
  { me, locale = 'en' }: { me: Me; locale?: 'en' | 'bn' },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const result = render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale={locale}
        messages={locale === 'en' ? en : bn}
        timeZone="Asia/Dhaka"
      >
        <SessionProvider me={me}>
          <BusinessProvider business={me.businesses[0]!}>{ui}</BusinessProvider>
        </SessionProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { ...result, queryClient, invalidate };
}

type Handler = (init: RequestInit & { url: string }) => Response | Promise<Response>;

/** fetch mock routed by "METHOD /path" (path without /api/v1 and query). Records every call. */
export function mockApi(routes: Record<string, Handler>) {
  const calls: { method: string; path: string; url: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const path = url.replace(/^\/api\/v1/, '').split('?')[0]!;
    calls.push({ method, path, url, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const handler = routes[`${method} ${path}`];
    if (!handler) return new Response(JSON.stringify({ statusCode: 404 }), { status: 404 });
    return handler({ ...init, url });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

export const json = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const ALL: [string, string, boolean][] = [
  ['settings.view', 'core', false],
  ['settings.manage', 'core', true],
  ['users.view', 'core', false],
  ['users.manage', 'core', true],
  ['roles.manage', 'core', true],
  ['audit.view', 'core', true],
  ['change.request', 'core', false],
  ['change.view.own', 'core', false],
  ['change.view.all', 'core', false],
  ['change.approve', 'core', false],
  ['product.view', 'dealership', false],
  ['product.manage', 'dealership', false],
  ['product.cost.view', 'dealership', false],
  ['product.price.edit', 'dealership', false],
  ['product.deactivate', 'dealership', false],
  ['customer.view', 'dealership', false],
  ['customer.manage', 'dealership', false],
  ['customer.due.view', 'dealership', false],
  ['customer.balance.edit', 'dealership', false],
  ['customer.deactivate', 'dealership', false],
  ['collection.create', 'dealership', false],
  ['supplier.view', 'dealership', false],
  ['purchase.view', 'dealership', false],
  ['purchase.create', 'dealership', false],
  ['purchase.void', 'dealership', false],
  ['stock.view', 'dealership', false],
  ['stock.adjust', 'dealership', false],
  ['sale.create', 'dealership', false],
  ['sale.view.all', 'dealership', false],
  ['sale.view.own', 'dealership', false],
  ['sale.void', 'dealership', false],
  ['ledger.view', 'dealership', false],
  ['ledger.entry.create', 'dealership', false],
  ['payment.create', 'dealership', false],
  ['expense.create', 'dealership', false],
  ['summary.finance.view', 'dealership', false],
  ['reports.finance.view', 'dealership', false],
  ['commission.view', 'dealership', true],
  ['commission.manage', 'dealership', true],
  ['profit.view', 'dealership', true],
];

/** GET roles/permissions as in docs/API.md §8 (all 32 permissions, 4 roles). */
export function rolesMatrix(): RolesMatrix {
  return {
    permissions: ALL.map(([key, module, ownerOnly]) => ({ key, module, ownerOnly })),
    roles: [
      {
        key: 'owner',
        nameEn: 'Owner',
        nameBn: 'মালিক',
        locked: true,
        permissions: OWNER_PERMISSIONS.filter((p) => !ALL.find((a) => a[0] === p)?.[2]),
      },
      {
        key: 'manager',
        nameEn: 'Manager',
        nameBn: 'ম্যানেজার',
        locked: false,
        permissions: [...MANAGER_PERMISSIONS],
      },
      {
        key: 'accountant',
        nameEn: 'Accountant',
        nameBn: 'হিসাবরক্ষক',
        locked: false,
        permissions: [
          'collection.create',
          'customer.due.view',
          'customer.view',
          'expense.create',
          'ledger.entry.create',
          'ledger.view',
          'payment.create',
          'settings.view',
        ],
      },
      {
        key: 'salesman',
        nameEn: 'Salesman',
        nameBn: 'বিক্রয়কর্মী',
        locked: false,
        permissions: [
          'customer.manage',
          'customer.view',
          'product.view',
          'sale.create',
          'sale.view.own',
          'stock.view',
        ],
      },
    ],
  };
}

export const ALL_PERMISSION_KEYS = ALL.map(([key]) => key);

/** An error response in the API's §11 shape: stable `code`, optional `field` and `errors[]`. */
export const apiError = (
  status: number,
  code: string,
  field?: string,
  errors?: { field: string; code: string }[],
) =>
  json(status, {
    statusCode: status,
    message: 'English developer text that the UI must not show',
    code,
    ...(field ? { field } : {}),
    ...(errors || field
      ? { errors: (errors ?? [{ field: field!, code }]).map((e) => ({ ...e, message: 'x' })) }
      : {}),
  });
