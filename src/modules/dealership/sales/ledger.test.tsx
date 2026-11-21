import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/core/auth/types';
import {
  MANAGER_PERMISSIONS,
  SALESMAN_PERMISSIONS,
  business,
  managerMe,
} from '../../../../test/fixtures/me';
import { json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import { B, BID, deliverySummary, ledgerPage, orderSummary, page } from './fixtures';
import { CustomerActivity } from './customer/customer-activity';
import { CustomerLedger } from './customer/ledger';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn(), prefetch: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: nav.replace,
    push: vi.fn(),
    back: vi.fn(),
    prefetch: nav.prefetch,
    refresh: vi.fn(),
  }),
  usePathname: () => '/b/example-cement/customers/cu1/ledger',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
beforeEach(() => {
  nav.search = '';
  nav.replace.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const meWith = (permissions: string[]): Me => ({
  ...managerMe,
  businesses: [business({ permissions })],
});
const managerP = meWith(MANAGER_PERMISSIONS);
const salesmanP = meWith(SALESMAN_PERMISSIONS);
const LEDGER = `GET ${B}/customers/cu1/ledger`;

describe('<CustomerLedger>', () => {
  it('the summary and the entries, with signed amounts and document links', async () => {
    const { calls } = mockApi({ [LEDGER]: () => json(200, ledgerPage()) });
    const { container } = renderInBusiness(
      <CustomerLedger slug="example-cement" businessId={BID} customerId="cu1" />,
      { me: managerP },
    );
    expect(await screen.findByText('৳12,500.00')).toBeInTheDocument(); // opening due
    expect(screen.getByText('৳22,600.00')).toBeInTheDocument(); // delivered
    expect(screen.getByText('৳20,000.00')).toBeInTheDocument(); // collected
    expect(screen.getByText('৳15,100.00')).toBeInTheDocument(); // current due
    expect(screen.getByText('৳30,000.00')).toBeInTheDocument(); // credit limit
    const row = (await screen.findByRole('rowheader', { name: 'COL-0001' })).closest('tr')!;
    expect(row).toHaveTextContent('Collection');
    expect(row).toHaveTextContent('+৳20,000.00');
    expect(screen.getByRole('link', { name: 'DEL-0001' })).toHaveAttribute(
      'href',
      `${B}/deliveries/d1`,
    );
    expect(screen.getByRole('link', { name: 'COL-0001' })).toHaveAttribute(
      'href',
      `${B}/collections/col1`,
    );
    // No running-balance column: the API stores none (step-5b decision 2).
    expect(screen.queryByRole('columnheader', { name: /Current due/ })).not.toBeInTheDocument();
    expect(calls[0]!.url).toBe('/api/v1/b/example-cement/customers/cu1/ledger?page=1');
    await expectNoA11yViolations(container);
  });

  it('a negative balance reads as an advance, in both languages', async () => {
    const advance = ledgerPage({
      customer: { ...ledgerPage().customer, currentBalance: '-4900.00', creditLimit: null },
    });
    mockApi({ [LEDGER]: () => json(200, advance) });
    const { unmount } = renderInBusiness(
      <CustomerLedger slug="example-cement" businessId={BID} customerId="cu1" />,
      { me: managerP },
    );
    expect(await screen.findByText('Advance')).toBeInTheDocument();
    expect(screen.getByText('৳4,900.00')).toBeInTheDocument();
    expect(screen.getByText('No limit')).toBeInTheDocument();
    unmount();
    mockApi({ [LEDGER]: () => json(200, advance) });
    renderInBusiness(<CustomerLedger slug="example-cement" businessId={BID} customerId="cu1" />, {
      me: managerP,
      locale: 'bn',
    });
    expect(await screen.findByText('অগ্রিম')).toBeInTheDocument();
  });

  it('every entry kind has a label, and void entries read as such', async () => {
    mockApi({
      [LEDGER]: () =>
        json(
          200,
          ledgerPage({
            items: [
              {
                id: 'le3',
                kind: 'collection_void',
                amount: '20000.00',
                entryDate: '2026-11-21',
                source: { type: 'collection', id: 'col1', code: 'COL-0001' },
                reason: 'Money refunded',
                createdBy: { id: 'u1', name: 'Jesan Owner' },
                createdAt: '2026-11-21T06:00:00.000Z',
              },
              {
                id: 'le4',
                kind: 'delivery_edit',
                amount: '-500.00',
                entryDate: '2026-11-20',
                source: { type: 'delivery', id: 'd1', code: 'DEL-0001' },
                reason: 'Price corrected',
                createdBy: { id: 'u1', name: 'Jesan Owner' },
                createdAt: '2026-11-20T06:00:00.000Z',
              },
            ],
          }),
        ),
    });
    renderInBusiness(<CustomerLedger slug="example-cement" businessId={BID} customerId="cu1" />, {
      me: managerP,
    });
    expect(await screen.findByText('Collection voided')).toBeInTheDocument();
    expect(screen.getByText('Delivery corrected')).toBeInTheDocument();
    expect(screen.getByText('Money refunded')).toBeInTheDocument();
    expect(screen.getByText('−৳20,000.00')).toBeInTheDocument();
    expect(screen.getByText('+৳500.00')).toBeInTheDocument();
  });

  it('the date filter goes into the URL and the query', async () => {
    nav.search = 'from=2026-11-01&to=2026-11-30';
    const { calls } = mockApi({ [LEDGER]: () => json(200, ledgerPage()) });
    renderInBusiness(<CustomerLedger slug="example-cement" businessId={BID} customerId="cu1" />, {
      me: managerP,
    });
    await screen.findByRole('rowheader', { name: 'COL-0001' });
    expect(calls[0]!.url).toBe(
      '/api/v1/b/example-cement/customers/cu1/ledger?page=1&from=2026-11-01&to=2026-11-30',
    );
    await userEvent.clear(screen.getByLabelText('From'));
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/b/example-cement/customers/cu1/ledger?to=2026-11-30',
      { scroll: false },
    );
  });

  it('an empty ledger says so instead of showing an empty table', async () => {
    mockApi({ [LEDGER]: () => json(200, ledgerPage({ items: [], total: 0 })) });
    renderInBusiness(<CustomerLedger slug="example-cement" businessId={BID} customerId="cu1" />, {
      me: managerP,
    });
    expect(await screen.findByText('The ledger is empty')).toBeInTheDocument();
  });
});

describe('<CustomerActivity>', () => {
  const routes = {
    [`GET ${B}/orders`]: () => json(200, page([orderSummary()])),
    [`GET ${B}/deliveries`]: () => json(200, page([deliverySummary()])),
  };

  it('orders and deliveries of one customer, filtered by one date range', async () => {
    nav.search = 'from=2026-11-01';
    const { calls } = mockApi(routes);
    const { container } = renderInBusiness(
      <CustomerActivity slug="example-cement" businessId={BID} customerId="cu1" />,
      { me: managerP },
    );
    // Both sections can name the order, so look inside each one.
    const ordersSection = (await screen.findByRole('heading', { name: 'Orders' })).closest(
      'section',
    )!;
    expect(await within(ordersSection).findByRole('link', { name: 'ORD-0001' })).toHaveAttribute(
      'href',
      `${B}/sales/o1`,
    );
    const deliveriesSection = (await screen.findByRole('heading', { name: 'Deliveries' })).closest(
      'section',
    )!;
    expect(
      await within(deliveriesSection).findByRole('link', { name: 'DEL-0001' }),
    ).toHaveAttribute('href', `${B}/deliveries/d1`);
    for (const path of [`${B}/orders`, `${B}/deliveries`]) {
      expect(calls.find((c) => c.path === path)!.url).toContain('customerId=cu1');
      expect(calls.find((c) => c.path === path)!.url).toContain('from=2026-11-01');
    }
    await expectNoA11yViolations(container);
  });

  it('a salesman sees their orders but no deliveries section', async () => {
    const { calls } = mockApi(routes);
    renderInBusiness(<CustomerActivity slug="example-cement" businessId={BID} customerId="cu1" />, {
      me: salesmanP,
    });
    expect(await screen.findByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Deliveries' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.path === `${B}/deliveries`)).toBe(false);
  });
});
