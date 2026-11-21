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
import {
  B,
  BID,
  DECIMAL_UNIT,
  WHOLE_UNIT,
  customerRecord,
  delivery,
  deliverySummary,
  order,
  page,
  productRecord,
  unitsRoute,
  type UnitFixture,
} from './fixtures';
import { DeliveriesList } from './deliveries/deliveries-list';
import { DeliveryDetail } from './deliveries/delivery-detail';
import { DeliveryForm, moreThan } from './deliveries/delivery-form';

const nav = vi.hoisted(() => ({
  search: 'orderId=o1',
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
  usePathname: () => '/b/example-cement/deliveries',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
beforeEach(() => {
  nav.search = 'orderId=o1';
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

const routes = (unit: UnitFixture) => ({
  [`GET ${B}/product-units`]: unitsRoute(unit),
  [`GET ${B}/products`]: () => json(200, page([productRecord(unit)])),
  [`GET ${B}/customers`]: () => json(200, page([customerRecord()])),
  [`GET ${B}/orders/o1`]: () => json(200, order(unit)),
});

describe('moreThan (decimal strings, no floats)', () => {
  it('compares without turning anything into a number', () => {
    expect(moreThan('61', '60')).toBe(true);
    expect(moreThan('60', '60')).toBe(false);
    expect(moreThan('9', '10')).toBe(false);
    expect(moreThan('10.501', '10.5')).toBe(true);
    expect(moreThan('10.5', '10.50')).toBe(false);
    expect(moreThan('0999999999999.5', '1000000000000')).toBe(false);
  });
});

describe.each([WHOLE_UNIT, DECIMAL_UNIT])('<DeliveryForm> with $nameEn', (unit) => {
  it('part of an order may go out; empty lines are left out', async () => {
    const { calls } = mockApi({
      ...routes(unit),
      [`POST ${B}/deliveries`]: () => json(201, delivery(unit, { id: 'd9' })),
    });
    renderInBusiness(<DeliveryForm slug="example-cement" businessId={BID} />, { me: managerP });
    const qty = await screen.findByLabelText(`Quantity (${unit.nameEn})`);
    expect(screen.getByText('60')).toBeInTheDocument(); // what is left on the line
    await userEvent.type(qty, unit === WHOLE_UNIT ? '25' : '10.5');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Save' }));
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body).toEqual({
      orderId: 'o1',
      deliveryDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      items: [{ orderItemId: 'oi1', quantity: unit === WHOLE_UNIT ? '25' : '10.5' }],
    });
    expect(posts[0]!.headers.get('Idempotency-Key')).toMatch(/^[\w-]{8,64}$/);
  });

  it('refuses more than is left, and a quantity against the unit’s rule', async () => {
    const { calls } = mockApi(routes(unit));
    renderInBusiness(<DeliveryForm slug="example-cement" businessId={BID} />, { me: managerP });
    const qty = await screen.findByLabelText(`Quantity (${unit.nameEn})`);
    await userEvent.type(qty, '61');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('More than is left on this line.')).toBeInTheDocument();
    await userEvent.clear(qty);
    await userEvent.type(qty, unit.bad);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Enter a quantity above zero that fits the unit’s rule.'),
    ).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });
});

describe('<DeliveryForm> errors from the API', () => {
  it('"deliver everything left" fills the line; nothing to deliver disables Save', async () => {
    mockApi({
      ...routes(WHOLE_UNIT),
      [`GET ${B}/orders/o1`]: () =>
        json(
          200,
          order(WHOLE_UNIT, {
            remainingQuantity: '0',
            deliveryStatus: 'delivered',
            items: [
              {
                id: 'oi1',
                product: productRecord(WHOLE_UNIT),
                quantity: '100',
                deliveredQuantity: '100',
                remainingQuantity: '0',
                unitPrice: '565.00',
                lineTotal: '56500.00',
              },
            ],
          }),
        ),
    });
    renderInBusiness(<DeliveryForm slug="example-cement" businessId={BID} />, { me: managerP });
    expect(
      await screen.findByText('Everything on this order has been delivered.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('STOCK_INSUFFICIENT says how much is in stock, under the line', async () => {
    mockApi({
      ...routes(WHOLE_UNIT),
      [`POST ${B}/deliveries`]: () =>
        json(409, {
          statusCode: 409,
          message: 'English text the UI must not show',
          code: 'STOCK_INSUFFICIENT',
          field: 'items.0.quantity',
          errors: [{ field: 'items.0.quantity', code: 'STOCK_INSUFFICIENT', message: 'x' }],
          details: { productId: 'p1', available: '18', required: '25' },
        }),
    });
    renderInBusiness(<DeliveryForm slug="example-cement" businessId={BID} />, { me: managerP });
    await userEvent.type(await screen.findByLabelText('Quantity (Bag)'), '25');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Only 18 .*are in stock/)).toBeInTheDocument();
  });

  it('DELIVERY_QUANTITY_TOO_LARGE says what is left; CREDIT_LIMIT_EXCEEDED shows both numbers', async () => {
    let code: 'large' | 'credit' = 'large';
    mockApi({
      ...routes(WHOLE_UNIT),
      [`POST ${B}/deliveries`]: () =>
        code === 'large'
          ? json(400, {
              statusCode: 400,
              message: 'x',
              code: 'DELIVERY_QUANTITY_TOO_LARGE',
              field: 'items.0.quantity',
              errors: [
                { field: 'items.0.quantity', code: 'DELIVERY_QUANTITY_TOO_LARGE', message: 'x' },
              ],
              details: { remaining: '60' },
            })
          : json(409, {
              statusCode: 409,
              message: 'x',
              code: 'CREDIT_LIMIT_EXCEEDED',
              field: 'items',
              errors: [{ field: 'items', code: 'CREDIT_LIMIT_EXCEEDED', message: 'x' }],
              details: { creditLimit: '30000.00', balanceAfter: '35100.00' },
            }),
    });
    renderInBusiness(<DeliveryForm slug="example-cement" businessId={BID} />, { me: managerP });
    await userEvent.type(await screen.findByLabelText('Quantity (Bag)'), '25');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Only 60 .*left to deliver on this line/)).toBeInTheDocument();
    code = 'credit';
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        'The credit limit is ৳30,000.00; after this delivery the due would be ৳35,100.00.',
      ),
    ).toBeInTheDocument();
  });

  it('without an orderId it asks for one instead of guessing', async () => {
    nav.search = '';
    mockApi(routes(WHOLE_UNIT));
    renderInBusiness(<DeliveryForm slug="example-cement" businessId={BID} />, { me: managerP });
    expect(await screen.findByText('Open a delivery from an order.')).toBeInTheDocument();
  });
});

describe('<DeliveriesList>', () => {
  it('rows with order and customer; filters in the URL', async () => {
    nav.search = '';
    const { calls } = mockApi({
      ...routes(WHOLE_UNIT),
      [`GET ${B}/deliveries`]: () => json(200, page([deliverySummary()])),
    });
    const { container } = renderInBusiness(
      <DeliveriesList slug="example-cement" businessId={BID} />,
      { me: managerP },
    );
    const row = (await screen.findByRole('rowheader', { name: 'DEL-0001' })).closest('tr')!;
    expect(row).toHaveTextContent('ORD-0001');
    expect(row).toHaveTextContent('Sample Store One');
    expect(row).toHaveTextContent('৳22,600.00');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'void');
    expect(nav.replace).toHaveBeenLastCalledWith('/b/example-cement/deliveries?status=void', {
      scroll: false,
    });
    expect(calls.find((c) => c.path === `${B}/deliveries`)!.url).toBe(
      '/api/v1/b/example-cement/deliveries?page=1',
    );
    await expectNoA11yViolations(container);
  });

  it('no total column when the API sends no amount', async () => {
    nav.search = '';
    const summary = deliverySummary();
    delete summary.totalAmount;
    mockApi({
      ...routes(WHOLE_UNIT),
      [`GET ${B}/deliveries`]: () => json(200, page([summary])),
    });
    const { container } = renderInBusiness(
      <DeliveriesList slug="example-cement" businessId={BID} />,
      { me: meWith(['delivery.view', 'customer.view']) },
    );
    await screen.findByRole('rowheader', { name: 'DEL-0001' });
    expect(screen.queryByRole('columnheader', { name: 'Total' })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('৳');
  });
});

describe('<DeliveryDetail>', () => {
  const detailRoutes = (d = delivery(WHOLE_UNIT)) => ({
    ...routes(WHOLE_UNIT),
    [`GET ${B}/deliveries/d1`]: () => json(200, d),
  });

  it('the credit warning appears only when the API sent the flag', async () => {
    mockApi(detailRoutes(delivery(WHOLE_UNIT, { creditLimitExceeded: true })));
    const { unmount } = renderInBusiness(
      <DeliveryDetail slug="example-cement" businessId={BID} id="d1" />,
      { me: managerP },
    );
    expect(
      await screen.findByText('This delivery passed the customer’s credit limit.'),
    ).toBeInTheDocument();
    unmount();
    mockApi(detailRoutes());
    renderInBusiness(<DeliveryDetail slug="example-cement" businessId={BID} id="d1" />, {
      me: managerP,
    });
    await screen.findByRole('heading', { name: 'Delivery DEL-0001' });
    expect(
      screen.queryByText('This delivery passed the customer’s credit limit.'),
    ).not.toBeInTheDocument();
  });

  it('owner voids with a reason and refreshes stock, orders, customers, the ledger, accounts and sales report', async () => {
    const { calls } = mockApi({
      ...detailRoutes(),
      [`POST ${B}/deliveries/d1/void`]: () => json(200, delivery(WHOLE_UNIT, { status: 'void' })),
    });
    const { invalidate } = renderInBusiness(
      <DeliveryDetail slug="example-cement" businessId={BID} id="d1" />,
      { me: ownerP },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Void' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Reason for the change'), 'Truck returned');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Void the delivery' }));
    expect(calls.find((c) => c.path === `${B}/deliveries/d1/void`)!.body).toEqual({
      reason: 'Truck returned',
    });
    const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keys).toEqual([
      JSON.stringify(['dealership', BID, 'deliveries']),
      JSON.stringify(['dealership', BID, 'orders']),
      JSON.stringify(['dealership', BID, 'stock']),
      JSON.stringify(['dealership', BID, 'customers']),
      JSON.stringify(['dealership', BID, 'ledger']),
      JSON.stringify(['dealership', BID, 'accountsSummary']),
      JSON.stringify(['dealership', BID, 'reportsSales']),
    ]);
  });

  it('a manager who may only ask gets the request dialog; a void delivery offers nothing', async () => {
    mockApi(detailRoutes());
    const { unmount } = renderInBusiness(
      <DeliveryDetail slug="example-cement" businessId={BID} id="d1" />,
      { me: managerP },
    );
    expect(await screen.findByRole('button', { name: 'Request a correction' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Correct' })).not.toBeInTheDocument();
    unmount();
    mockApi(detailRoutes(delivery(WHOLE_UNIT, { status: 'void', voidReason: 'Returned' })));
    renderInBusiness(<DeliveryDetail slug="example-cement" businessId={BID} id="d1" />, {
      me: ownerP,
    });
    expect(await screen.findByText('This record is void')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Void' })).not.toBeInTheDocument();
  });

  it('a 404 reads as "not found", never the API’s English message', async () => {
    mockApi({
      ...routes(WHOLE_UNIT),
      [`GET ${B}/deliveries/d1`]: () => apiError(404, 'DELIVERY_NOT_FOUND'),
    });
    const { container } = renderInBusiness(
      <DeliveryDetail slug="example-cement" businessId={BID} id="d1" />,
      { me: managerP },
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('English developer text');
  });
});
