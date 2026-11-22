import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/core/auth/types';
import {
  MANAGER_PERMISSIONS,
  OWNER_PERMISSIONS,
  business,
  managerMe,
} from '../../../../test/fixtures/me';
import { apiError, json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import { collectionsReportResponse } from '../reports/fixtures';
import {
  B,
  BID,
  WHOLE_UNIT,
  collection,
  customerRecord,
  orderSummary,
  page,
  unitsRoute,
} from './fixtures';
import { CollectionDetail } from './collections/collection-detail';
import { CollectionForm } from './collections/collection-form';
import { CollectionsList } from './collections/collections-list';

const nav = vi.hoisted(() => ({
  search: '',
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: nav.replace,
    push: nav.push,
    back: nav.back,
    prefetch: nav.prefetch,
    refresh: vi.fn(),
  }),
  usePathname: () => '/b/example-cement/collections',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
beforeEach(() => {
  nav.search = '';
  nav.replace.mockReset();
  nav.push.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const meWith = (permissions: string[]): Me => ({
  ...managerMe,
  businesses: [business({ permissions })],
});
const managerP = meWith([...MANAGER_PERMISSIONS, 'change.request', 'change.view.own']);
const ownerP = meWith(OWNER_PERMISSIONS);

const routes = {
  [`GET ${B}/product-units`]: unitsRoute(WHOLE_UNIT),
  [`GET ${B}/customers`]: () => json(200, page([customerRecord()])),
  [`GET ${B}/customers/cu1`]: () => json(200, customerRecord()),
  // The methods are the business's own list; no method name lives in the code.
  [`GET ${B}/collection-methods`]: () => json(200, { items: ['cash', 'bkash', 'cheque'] }),
  [`GET ${B}/orders`]: () => json(200, page([orderSummary()])),
  [`GET ${B}/reports/collections`]: () => json(200, collectionsReportResponse()),
};

describe('<CollectionForm>', () => {
  it('money, a method from the API list and no order: a general advance', async () => {
    const { calls } = mockApi({
      ...routes,
      [`POST ${B}/collections`]: () => json(201, collection({ id: 'col9' })),
    });
    const { container } = renderInBusiness(
      <CollectionForm slug="example-cement" businessId={BID} />,
      { me: managerP },
    );
    await userEvent.click(await screen.findByRole('button', { name: /C-00001/ }));
    // Every offered method comes from the response, labelled where a translation exists.
    const method = screen.getByLabelText('Method');
    expect(
      within(method)
        .getAllByRole('option')
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual(['cash', 'bkash', 'cheque']);
    await userEvent.type(screen.getByLabelText('Amount'), '20000.50');
    await userEvent.selectOptions(method, 'cheque');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Save' }));
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body).toEqual({
      customerId: 'cu1',
      method: 'cheque',
      amount: '20000.50',
      collectionDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(posts[0]!.headers.get('Idempotency-Key')).toMatch(/^[\w-]{8,64}$/);
    expect(nav.push).toHaveBeenCalledWith('/b/example-cement/collections/col9?saved=created');
    await expectNoA11yViolations(container);
  });

  it('an order may be named as a reference; inactive customers may still pay', async () => {
    const { calls } = mockApi({
      ...routes,
      [`POST ${B}/collections`]: () => json(201, collection({ id: 'col9' })),
    });
    renderInBusiness(<CollectionForm slug="example-cement" businessId={BID} />, { me: managerP });
    await userEvent.click(await screen.findByRole('button', { name: /C-00001/ }));
    expect(calls.find((c) => c.path === `${B}/customers`)!.url).toContain('active=all');
    await userEvent.type(screen.getByLabelText('Amount'), '5000');
    await userEvent.selectOptions(screen.getByLabelText('Against which order'), 'o1');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(calls.filter((c) => c.method === 'POST')[0]!.body).toMatchObject({ orderId: 'o1' });
    // Only the customer's open orders are offered.
    expect(calls.find((c) => c.path === `${B}/orders`)!.url).toContain('status=open');
  });

  it('refuses zero or malformed money; keeps what was typed', async () => {
    const { calls } = mockApi(routes);
    renderInBusiness(<CollectionForm slug="example-cement" businessId={BID} />, { me: managerP });
    await userEvent.click(await screen.findByRole('button', { name: /C-00001/ }));
    const amount = screen.getByLabelText('Amount');
    await userEvent.type(amount, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Enter an amount above zero, like 570 or 570.50.'),
    ).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(amount).toHaveValue('0');
  });

  it('customerId prop locks the customer: no picker, shows current due, onSaved instead of navigating', async () => {
    const onSaved = vi.fn();
    const { calls } = mockApi({
      ...routes,
      [`POST ${B}/collections`]: () => json(201, collection({ id: 'col9' })),
    });
    renderInBusiness(
      <CollectionForm slug="example-cement" businessId={BID} customerId="cu1" onSaved={onSaved} />,
      { me: managerP },
    );
    expect(await screen.findByText(/C-00001/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change customer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /C-00001/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Current due/)).toBeInTheDocument();
    expect(screen.getByText('৳12,500.00')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Amount'), '5000');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith('The collection was saved.'));
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({ customerId: 'cu1' });
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('a field error from the API lands under its field, in Bengali', async () => {
    mockApi({
      ...routes,
      [`POST ${B}/collections`]: () => apiError(400, 'COLLECTION_METHOD_UNKNOWN', 'method'),
    });
    const { container } = renderInBusiness(
      <CollectionForm slug="example-cement" businessId={BID} />,
      { me: managerP, locale: 'bn' },
    );
    await userEvent.click(await screen.findByRole('button', { name: /C-00001/ }));
    await userEvent.type(screen.getByLabelText('টাকা'), '20000');
    await userEvent.click(screen.getByRole('button', { name: 'সেভ করুন' }));
    expect(await screen.findByText('দেওয়া আদায়ের পদ্ধতিগুলোর একটা বেছে নিন।')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('English developer text');
  });
});

describe('<CollectionsList>', () => {
  it('rows with method and amount; the method filter comes from the API', async () => {
    const { calls } = mockApi({
      ...routes,
      [`GET ${B}/collections`]: () => json(200, page([collection()])),
    });
    renderInBusiness(<CollectionsList slug="example-cement" businessId={BID} />, {
      me: managerP,
    });
    const row = (await screen.findByRole('rowheader', { name: 'COL-0001' })).closest('tr')!;
    expect(row).toHaveTextContent('bKash');
    expect(row).toHaveTextContent('৳20,000.00');
    expect(row).toHaveTextContent('ORD-0001');
    // Current due: a per-row lookup of the customer (a collection never embeds the balance).
    expect(await within(row).findByText('৳12,500.00')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Method'), 'cash');
    expect(nav.replace).toHaveBeenLastCalledWith('/b/example-cement/collections?method=cash', {
      scroll: false,
    });
    expect(calls.some((c) => c.path === `${B}/collection-methods`)).toBe(true);
  });

  it('no "Take a collection" without collection.create', async () => {
    mockApi({ ...routes, [`GET ${B}/collections`]: () => json(200, page([collection()])) });
    renderInBusiness(<CollectionsList slug="example-cement" businessId={BID} />, {
      me: meWith(['collection.view', 'customer.view']),
    });
    await screen.findByRole('rowheader', { name: 'COL-0001' });
    expect(screen.queryByRole('link', { name: 'Take a collection' })).not.toBeInTheDocument();
  });

  it('no Current Due column without customer.due.view', async () => {
    mockApi({ ...routes, [`GET ${B}/collections`]: () => json(200, page([collection()])) });
    const { container } = renderInBusiness(
      <CollectionsList slug="example-cement" businessId={BID} />,
      { me: meWith(['collection.view', 'collection.create', 'customer.view']) },
    );
    await screen.findByRole('rowheader', { name: 'COL-0001' });
    expect(screen.queryByRole('columnheader', { name: 'Current due' })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('৳12,500.00');
  });

  it('shows the three KPI cards with totals from the collections report (report.view)', async () => {
    mockApi({
      ...routes,
      [`GET ${B}/collections`]: () => json(200, page([collection()])),
      [`GET ${B}/reports/collections`]: () =>
        json(200, collectionsReportResponse({ totalAmount: '11500.00' })),
    });
    renderInBusiness(<CollectionsList slug="example-cement" businessId={BID} />, { me: ownerP });
    await screen.findByRole('rowheader', { name: 'COL-0001' });
    expect(await screen.findByText('Total Collection Amount')).toBeInTheDocument();
    expect(screen.getByText("Today's Collection")).toBeInTheDocument();
    expect(screen.getByText("This Month's Collection")).toBeInTheDocument();
    expect(screen.getAllByText('৳11,500.00')).toHaveLength(3);
  });

  it('hides the KPI cards without report.view; the list itself still works', async () => {
    mockApi({
      ...routes,
      [`GET ${B}/collections`]: () => json(200, page([collection()])),
      [`GET ${B}/reports/collections`]: () => apiError(403, 'FORBIDDEN'),
    });
    renderInBusiness(<CollectionsList slug="example-cement" businessId={BID} />, {
      me: meWith(['collection.view', 'collection.create', 'customer.view']),
    });
    await screen.findByRole('rowheader', { name: 'COL-0001' });
    expect(screen.queryByText('Total Collection Amount')).not.toBeInTheDocument();
  });

  it('puts the customer filter button on the same line as the other filters', async () => {
    mockApi({ ...routes, [`GET ${B}/collections`]: () => json(200, page([collection()])) });
    renderInBusiness(<CollectionsList slug="example-cement" businessId={BID} />, {
      me: managerP,
    });
    await screen.findByRole('rowheader', { name: 'COL-0001' });
    const customerButton = screen.getByRole('button', { name: 'Customer' });
    const fromInput = screen.getByLabelText('From');
    expect(customerButton.closest('div.flex.items-end')).toBe(
      fromInput.closest('div.flex.items-end'),
    );
  });
});

describe('<CollectionDetail>', () => {
  const detailRoutes = (c = collection()) => ({
    ...routes,
    [`GET ${B}/collections/col1`]: () => json(200, c),
  });

  it('owner voids with a reason; refreshes collections, customers, the ledger and accounts', async () => {
    const { calls } = mockApi({
      ...detailRoutes(),
      [`POST ${B}/collections/col1/void`]: () => json(200, collection({ status: 'void' })),
    });
    const { invalidate } = renderInBusiness(
      <CollectionDetail slug="example-cement" businessId={BID} id="col1" />,
      { me: ownerP },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Void' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Reason for the change'), 'Money refunded');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Void the collection' }));
    expect(calls.find((c) => c.path === `${B}/collections/col1/void`)!.body).toEqual({
      reason: 'Money refunded',
    });
    expect(invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))).toEqual([
      JSON.stringify(['dealership', BID, 'collections']),
      JSON.stringify(['dealership', BID, 'customers']),
      JSON.stringify(['dealership', BID, 'ledger']),
      JSON.stringify(['dealership', BID, 'accountsSummary']),
      JSON.stringify(['dealership', BID, 'accountsLedger']),
    ]);
  });

  it('owner corrects: only changed fields plus a reason', async () => {
    const { calls } = mockApi({
      ...detailRoutes(),
      [`PATCH ${B}/collections/col1`]: () => json(200, collection({ amount: '18000.00' })),
    });
    renderInBusiness(<CollectionDetail slug="example-cement" businessId={BID} id="col1" />, {
      me: ownerP,
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Correct' }));
    const dialog = screen.getByRole('dialog');
    const amount = within(dialog).getByLabelText('Amount');
    await userEvent.clear(amount);
    await userEvent.type(amount, '18000');
    await userEvent.type(within(dialog).getByLabelText('Reason for the change'), 'Counted again');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save the correction' }));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      amount: '18000',
      reason: 'Counted again',
    });
  });

  it('a manager who may only ask sees the request dialog, not Void or Correct', async () => {
    mockApi(detailRoutes());
    renderInBusiness(<CollectionDetail slug="example-cement" businessId={BID} id="col1" />, {
      me: managerP,
    });
    expect(await screen.findByRole('button', { name: 'Request a correction' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Void' })).not.toBeInTheDocument();
  });
});
