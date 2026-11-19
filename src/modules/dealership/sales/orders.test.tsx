import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/core/auth/types';
import {
  MANAGER_PERMISSIONS,
  OWNER_PERMISSIONS,
  SALESMAN_PERMISSIONS,
  business,
  managerMe,
} from '../../../../test/fixtures/me';
import { apiError, json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import {
  B,
  BID,
  DECIMAL_UNIT,
  WHOLE_UNIT,
  customerRecord,
  order,
  orderSummary,
  page,
  productRecord,
  unitsRoute,
  type UnitFixture,
} from './fixtures';
import { OrderDetail } from './orders/order-detail';
import { OrderForm } from './orders/order-form';
import { OrdersList } from './orders/orders-list';

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
  usePathname: () => '/b/example-cement/sales',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
beforeEach(() => {
  nav.search = '';
  nav.replace.mockReset();
  nav.push.mockReset();
  nav.prefetch.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const meWith = (permissions: string[]): Me => ({
  ...managerMe,
  businesses: [business({ permissions })],
});
const managerP = meWith([...MANAGER_PERMISSIONS, 'change.request', 'change.view.own']);
const ownerP = meWith(OWNER_PERMISSIONS);
const salesmanP = meWith([...SALESMAN_PERMISSIONS, 'change.request', 'change.view.own']);

const routes = (unit: UnitFixture) => ({
  [`GET ${B}/product-units`]: unitsRoute(unit),
  [`GET ${B}/products`]: () =>
    json(200, page([productRecord(unit), productRecord(unit, 'p2', 'P-0002')])),
  [`GET ${B}/customers`]: () => json(200, page([customerRecord()])),
  [`GET ${B}/collection-methods`]: () => json(200, { items: ['cash', 'bkash'] }),
  [`GET ${B}/collections`]: () => json(200, page([])),
});

describe('<OrdersList>', () => {
  it('manager: rows, filters in the URL, New order link, prefetch on hover', async () => {
    nav.search = 'status=open&page=2';
    const { calls } = mockApi({
      ...routes(WHOLE_UNIT),
      [`GET ${B}/orders`]: () => json(200, page([orderSummary()])),
    });
    const { container } = renderInBusiness(<OrdersList slug="example-cement" businessId={BID} />, {
      me: managerP,
    });
    const row = (await screen.findByRole('rowheader', { name: 'ORD-0001' })).closest('tr')!;
    expect(row).toHaveTextContent('Sample Store One');
    expect(row).toHaveTextContent('100');
    expect(row).toHaveTextContent('60');
    expect(row).toHaveTextContent('৳56,500.00');
    expect(row).toHaveTextContent('Part delivered');
    expect(screen.getByRole('link', { name: 'New order' })).toHaveAttribute(
      'href',
      `${B}/sales/new`,
    );
    expect(calls.find((c) => c.path === `${B}/orders`)!.url).toBe(
      '/api/v1/b/example-cement/orders?page=2&status=open',
    );
    await userEvent.hover(row);
    expect(nav.prefetch).toHaveBeenCalledWith(`${B}/sales/o1`);
    await userEvent.selectOptions(screen.getByLabelText('Delivery'), 'delivered');
    expect(nav.replace).toHaveBeenLastCalledWith('/b/example-cement/sales?status=delivered', {
      scroll: false,
    });
    await expectNoA11yViolations(container);
  });

  it('no total column when the API sends no amount; no New order without sale.create', async () => {
    mockApi({
      ...routes(WHOLE_UNIT),
      [`GET ${B}/orders`]: () => json(200, page([orderSummary({}, false)])),
    });
    const { container } = renderInBusiness(<OrdersList slug="example-cement" businessId={BID} />, {
      me: meWith(['sale.view.all', 'customer.view']),
    });
    await screen.findByRole('rowheader', { name: 'ORD-0001' });
    expect(screen.queryByRole('columnheader', { name: 'Total' })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('৳');
    expect(screen.queryByRole('link', { name: 'New order' })).not.toBeInTheDocument();
  });

  it('customer filter: pick one → customerId in the URL (Bengali)', async () => {
    mockApi({ ...routes(WHOLE_UNIT), [`GET ${B}/orders`]: () => json(200, page([])) });
    renderInBusiness(<OrdersList slug="example-cement" businessId={BID} />, {
      me: managerP,
      locale: 'bn',
    });
    expect(await screen.findByText('এখনো কোনো অর্ডার নেই')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'গ্রাহক' }));
    await userEvent.click(await screen.findByRole('button', { name: /C-00001/ }));
    expect(nav.replace).toHaveBeenLastCalledWith('/b/example-cement/sales?customerId=cu1', {
      scroll: false,
    });
  });
});

/** Every form is tried with a whole-number unit and with a decimal one. */
describe.each([WHOLE_UNIT, DECIMAL_UNIT])('<OrderForm> with $nameEn', (unit) => {
  const addLine = async () =>
    userEvent.click(await screen.findByRole('button', { name: /P-0001 Sample Product One/ }));
  const pickCustomer = async () =>
    userEvent.click(await screen.findByRole('button', { name: /C-00001/ }));

  it(`sends strings, shows exact totals, one request per double click`, async () => {
    let resolve: (r: Response) => void = () => {};
    const { calls } = mockApi({
      ...routes(unit),
      [`POST ${B}/orders`]: () => new Promise<Response>((r) => (resolve = r)),
    });
    renderInBusiness(<OrderForm slug="example-cement" businessId={BID} />, { me: managerP });
    await pickCustomer();
    await addLine();
    const qty = screen.getByLabelText(`Quantity (${unit.nameEn})`);
    await userEvent.type(qty, unit.good);
    expect(qty).toHaveAttribute('inputmode', unit.decimals > 0 ? 'decimal' : 'numeric');
    await userEvent.type(screen.getByLabelText('Unit price'), '565');
    // Line total and order total are shown for checking only, computed on strings.
    const expected = unit === WHOLE_UNIT ? '৳56,500.00' : '৳5,932.50';
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    await userEvent.selectOptions(screen.getByLabelText('Urgency'), 'today');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Save' }));
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body).toEqual({
      customerId: 'cu1',
      deliveryWindow: 'today',
      orderDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      items: [{ productId: 'p1', quantity: unit.good, unitPrice: '565' }],
    });
    expect(posts[0]!.headers.get('Idempotency-Key')).toMatch(/^[\w-]{8,64}$/);
    await act(async () => resolve(json(201, order(unit, { id: 'o9' }))));
    expect(nav.push).toHaveBeenCalledWith('/b/example-cement/sales/o9?saved=created');
  });

  it(`refuses a quantity that breaks the unit's rule and keeps what was typed`, async () => {
    const { calls } = mockApi({ ...routes(unit) });
    renderInBusiness(<OrderForm slug="example-cement" businessId={BID} />, { me: managerP });
    await pickCustomer();
    await addLine();
    const qty = screen.getByLabelText(`Quantity (${unit.nameEn})`);
    await userEvent.type(qty, unit.bad);
    await userEvent.type(screen.getByLabelText('Unit price'), '565');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Enter a quantity above zero that fits the unit’s rule.'),
    ).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(qty).toHaveValue(unit.bad);
  });
});

describe('<OrderForm> rules of its own', () => {
  it('a customer must be chosen; only active customers are offered', async () => {
    const { calls } = mockApi({ ...routes(WHOLE_UNIT) });
    renderInBusiness(<OrderForm slug="example-cement" businessId={BID} />, { me: managerP });
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Choose a customer.')).toBeInTheDocument();
    // The picker asks for active customers only: no `active=all` for a new order.
    expect(calls.find((c) => c.path === `${B}/customers`)!.url).not.toContain('active=all');
  });

  it('an advance is sent as a second collection, with its own key', async () => {
    const { calls } = mockApi({
      ...routes(WHOLE_UNIT),
      [`POST ${B}/orders`]: () => json(201, order(WHOLE_UNIT, { id: 'o9' })),
      [`POST ${B}/collections`]: () => json(201, { id: 'col9' }),
    });
    renderInBusiness(<OrderForm slug="example-cement" businessId={BID} />, { me: managerP });
    await userEvent.click(await screen.findByRole('button', { name: /C-00001/ }));
    await userEvent.click(await screen.findByRole('button', { name: /P-0001/ }));
    await userEvent.type(screen.getByLabelText('Quantity (Bag)'), '100');
    await userEvent.type(screen.getByLabelText('Unit price'), '565');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Take an advance now' }));
    await userEvent.type(screen.getByLabelText('Amount'), '20000');
    // Methods come from the business's own list, never from code.
    await userEvent.selectOptions(screen.getByLabelText('Method'), 'bkash');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts.map((p) => p.path)).toEqual([`${B}/orders`, `${B}/collections`]);
    expect(posts[1]!.body).toEqual({
      customerId: 'cu1',
      orderId: 'o9',
      method: 'bkash',
      amount: '20000',
    });
    expect(posts[1]!.headers.get('Idempotency-Key')).not.toBe(
      posts[0]!.headers.get('Idempotency-Key'),
    );
    expect(nav.push).toHaveBeenCalledWith('/b/example-cement/sales/o9?saved=created');
  });

  it('a failed advance keeps the order and says so', async () => {
    mockApi({
      ...routes(WHOLE_UNIT),
      [`POST ${B}/orders`]: () => json(201, order(WHOLE_UNIT, { id: 'o9' })),
      [`POST ${B}/collections`]: () => apiError(400, 'COLLECTION_METHOD_UNKNOWN', 'method'),
    });
    renderInBusiness(<OrderForm slug="example-cement" businessId={BID} />, { me: managerP });
    await userEvent.click(await screen.findByRole('button', { name: /C-00001/ }));
    await userEvent.click(await screen.findByRole('button', { name: /P-0001/ }));
    await userEvent.type(screen.getByLabelText('Quantity (Bag)'), '100');
    await userEvent.type(screen.getByLabelText('Unit price'), '565');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Take an advance now' }));
    await userEvent.type(screen.getByLabelText('Amount'), '20000');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(nav.push).toHaveBeenCalledWith(
      expect.stringContaining('/b/example-cement/sales/o9?saved=created-no-advance&reason='),
    );
  });

  it('no advance section without collection.create', async () => {
    mockApi({ ...routes(WHOLE_UNIT) });
    renderInBusiness(<OrderForm slug="example-cement" businessId={BID} />, { me: salesmanP });
    await screen.findByRole('button', { name: /C-00001/ });
    expect(screen.queryByRole('checkbox', { name: 'Take an advance now' })).not.toBeInTheDocument();
  });
});

describe('<OrderDetail>', () => {
  const detailRoutes = (o = order(WHOLE_UNIT)) => ({
    ...routes(WHOLE_UNIT),
    [`GET ${B}/orders/o1`]: () => json(200, o),
  });

  it('lines with delivered and left, the deliveries of the order, and the Deliver button', async () => {
    mockApi(detailRoutes());
    const { container } = renderInBusiness(
      <OrderDetail slug="example-cement" businessId={BID} id="o1" />,
      { me: managerP },
    );
    expect(await screen.findByRole('heading', { name: 'Order ORD-0001' })).toBeInTheDocument();
    const line = screen.getByRole('rowheader', { name: /Sample Product One/ }).closest('tr')!;
    expect(line).toHaveTextContent('100');
    expect(line).toHaveTextContent('40');
    expect(line).toHaveTextContent('60');
    expect(line).toHaveTextContent('৳565.00');
    expect(screen.getByRole('link', { name: 'DEL-0001' })).toHaveAttribute(
      'href',
      `${B}/deliveries/d1`,
    );
    expect(screen.getByRole('link', { name: 'Deliver' })).toHaveAttribute(
      'href',
      `${B}/deliveries/new?orderId=o1`,
    );
    await expectNoA11yViolations(container);
  });

  it('salesman: no price columns, no Deliver, delivery codes without links', async () => {
    mockApi({
      ...routes(WHOLE_UNIT),
      [`GET ${B}/orders/o1`]: () => json(200, order(WHOLE_UNIT, {}, false)),
    });
    const { container } = renderInBusiness(
      <OrderDetail slug="example-cement" businessId={BID} id="o1" />,
      { me: salesmanP },
    );
    await screen.findByRole('heading', { name: 'Order ORD-0001' });
    expect(screen.queryByRole('columnheader', { name: 'Unit price' })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('৳');
    expect(screen.queryByRole('link', { name: 'Deliver' })).not.toBeInTheDocument();
    // The order's own deliveries are still visible as a summary (step-5b decision 9).
    expect(screen.getByText('DEL-0001')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'DEL-0001' })).not.toBeInTheDocument();
  });

  it('owner voids: a reason, the advance note, and DELIVERY_EXISTS read in Bengali', async () => {
    let fail = true;
    mockApi({
      ...detailRoutes(),
      [`POST ${B}/orders/o1/void`]: () =>
        fail ? apiError(409, 'DELIVERY_EXISTS') : json(200, order(WHOLE_UNIT)),
    });
    renderInBusiness(<OrderDetail slug="example-cement" businessId={BID} id="o1" />, {
      me: ownerP,
      locale: 'bn',
    });
    await userEvent.click(await screen.findByRole('button', { name: 'বাতিল' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/অগ্রিম হিসেবে জমা থাকে/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('বদলের কারণ'), 'ভুল অর্ডার');
    await userEvent.click(within(dialog).getByRole('button', { name: 'অর্ডার বাতিল করুন' }));
    expect(
      await within(dialog).findByText('এই অর্ডারে এখনো সক্রিয় ডেলিভারি আছে; আগে সেগুলো বাতিল করুন।'),
    ).toBeInTheDocument();
    fail = false;
    await userEvent.click(within(dialog).getByRole('button', { name: 'অর্ডার বাতিল করুন' }));
    expect(await screen.findByText('অর্ডার বাতিল হয়েছে।')).toBeInTheDocument();
  });

  it('owner corrects: only the changed fields, with a reason; invalidates exactly four keys', async () => {
    const { calls } = mockApi({
      ...detailRoutes(),
      [`PATCH ${B}/orders/o1`]: () => json(200, order(WHOLE_UNIT)),
    });
    const { invalidate } = renderInBusiness(
      <OrderDetail slug="example-cement" businessId={BID} id="o1" />,
      { me: ownerP },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Correct' }));
    const dialog = screen.getByRole('dialog');
    const qty = within(dialog).getByLabelText('Quantity (Bag)');
    await userEvent.clear(qty);
    await userEvent.type(qty, '120');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save the correction' }));
    expect(await within(dialog).findByText('Write why (3–500 characters).')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Reason for the change'), 'Shop asked');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save the correction' }));
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.body).toEqual({
      items: [{ id: 'oi1', quantity: '120' }],
      reason: 'Shop asked',
    });
    const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keys).toEqual([
      JSON.stringify(['dealership', BID, 'orders']),
      JSON.stringify(['dealership', BID, 'deliveries']),
      JSON.stringify(['dealership', BID, 'customers']),
      JSON.stringify(['dealership', BID, 'ledger']),
    ]);
  });

  it('a manager who may only ask gets the request dialog, not Void or Correct', async () => {
    mockApi({
      ...detailRoutes(),
      [`POST ${B}/change-requests/preview`]: () =>
        json(200, { entityLabel: 'ORD-0001', impact: [] }),
    });
    renderInBusiness(<OrderDetail slug="example-cement" businessId={BID} id="o1" />, {
      me: managerP,
    });
    expect(await screen.findByRole('button', { name: 'Request a correction' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Void' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Correct' })).not.toBeInTheDocument();
  });

  it('a void order offers nothing and shows who voided it', async () => {
    mockApi(
      detailRoutes(
        order(WHOLE_UNIT, {
          status: 'void',
          voidedAt: '2026-11-20T06:00:00.000Z',
          voidReason: 'Shop cancelled',
          voidedBy: { id: 'u1', name: 'Jesan Owner' },
        }),
      ),
    );
    renderInBusiness(<OrderDetail slug="example-cement" businessId={BID} id="o1" />, {
      me: ownerP,
    });
    expect(await screen.findByText('This record is void')).toBeInTheDocument();
    expect(screen.getByText(/Shop cancelled/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Void' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Deliver' })).not.toBeInTheDocument();
  });
});
