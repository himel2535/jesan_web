import { act, screen } from '@testing-library/react';
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
import { PurchaseDetail } from './purchase-detail';
import { PurchaseForm } from './purchase-form';
import { PurchasesList } from './purchases-list';
import type { Purchase, PurchaseSummary } from './types';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn(), push: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: nav.replace,
    push: nav.push,
    back: nav.back,
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/b/example-cement/purchases',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
beforeEach(() => {
  nav.search = '';
  nav.replace.mockReset();
  nav.push.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const BID = 'b1';
const B = '/b/example-cement';
const meWith = (permissions: string[]): Me => ({
  ...managerMe,
  businesses: [business({ permissions })],
});
const managerP = meWith([...MANAGER_PERMISSIONS, 'change.request', 'change.view.own']);
const ownerP = meWith(OWNER_PERMISSIONS);
const salesmanP = meWith([...SALESMAN_PERMISSIONS, 'purchase.view']);

const supplier = {
  id: 's1',
  code: 'S-001',
  nameEn: 'Example Supplier',
  nameBn: 'উদাহরণ সরবরাহকারী',
};
const summary = (o: Partial<PurchaseSummary> = {}, withCost = true): PurchaseSummary => {
  const s: PurchaseSummary = {
    id: 'pu1',
    code: 'PUR-0001',
    purchaseDate: '2026-11-18',
    supplier,
    paymentMethod: 'cash',
    itemCount: 2,
    totalQuantity: '700',
    totalAmount: '394100.00',
    status: 'active',
    supplierReference: 'CH-5521',
    createdBy: { id: 'u2', name: 'Rahim Uddin' },
    createdAt: '2026-11-18T11:11:13.040Z',
    ...o,
  };
  if (!withCost) delete s.totalAmount;
  return s;
};
const purchase = (o: Partial<Purchase> = {}, withCost = true): Purchase => {
  const p: Purchase = {
    ...summary({}, withCost),
    note: 'Truck 12',
    version: 1,
    items: [
      {
        id: 'it1',
        product: {
          id: 'p1',
          code: 'P-0001',
          nameEn: 'Sample OPC',
          nameBn: 'নমুনা ওপিসি',
          unitKey: 'bag',
        },
        quantity: '500',
        unitPrice: '570.00',
        lineTotal: '285000.00',
      },
      {
        id: 'it2',
        product: {
          id: 'p3',
          code: 'P-0003',
          nameEn: 'Sample PCC',
          nameBn: 'নমুনা পিসিসি',
          unitKey: 'bag',
        },
        quantity: '200',
        unitPrice: '545.50',
        lineTotal: '109100.00',
      },
    ],
    voidedAt: null,
    voidReason: null,
    voidedBy: null,
    updatedAt: '2026-11-18T11:11:13.040Z',
    ...o,
  };
  if (!withCost) {
    for (const i of p.items) {
      delete i.unitPrice;
      delete i.lineTotal;
    }
  }
  return p;
};
const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 10, total: items.length });
const product = (id: string, code: string, nameEn: string) => ({
  id,
  code,
  category: { id: 'c1', nameEn: 'OPC', nameBn: 'ওপিসি' },
  nameEn,
  nameBn: nameEn,
  unitKey: 'bag',
  isActive: true,
  createdAt: '2026-11-17T08:38:04.236Z',
  updatedAt: '2026-11-17T08:38:04.236Z',
});
const baseRoutes = {
  [`GET ${B}/product-units`]: () =>
    json(200, {
      defaultUnitKey: 'bag',
      items: [{ key: 'bag', nameEn: 'Bag', nameBn: 'বস্তা', decimals: 0 }],
    }),
  [`GET ${B}/suppliers`]: () =>
    json(
      200,
      page([{ ...supplier, phone: null, address: null, isPrincipal: true, isActive: true }]),
    ),
  [`GET ${B}/products`]: () =>
    json(200, page([product('p1', 'P-0001', 'Sample OPC'), product('p3', 'P-0003', 'Sample PCC')])),
};

describe('<PurchasesList>', () => {
  it('manager: rows with total; filters from/to the URL; New purchase link', async () => {
    nav.search = 'from=2026-11-01&status=active&page=2';
    const { calls, container } = (() => {
      const api = mockApi({
        ...baseRoutes,
        [`GET ${B}/purchases`]: () => json(200, page([summary()])),
      });
      return {
        ...api,
        ...renderInBusiness(<PurchasesList slug="example-cement" businessId={BID} />, {
          me: managerP,
        }),
      };
    })();
    const row = (await screen.findByRole('rowheader', { name: 'PUR-0001' })).closest('tr')!;
    expect(row).toHaveTextContent('Example Supplier');
    expect(row).toHaveTextContent('700');
    expect(row).toHaveTextContent('৳3,94,100.00');
    expect(screen.getByRole('link', { name: 'New purchase' })).toHaveAttribute(
      'href',
      `${B}/purchases/new`,
    );
    expect(calls.find((c) => c.path === `${B}/purchases`)!.url).toBe(
      '/api/v1/b/example-cement/purchases?page=2&from=2026-11-01&status=active',
    );
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'void');
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/b/example-cement/purchases?from=2026-11-01&status=void',
      { scroll: false },
    );
    await expectNoA11yViolations(container);
  });

  it('without product.cost.view: no total column or amount; no New purchase', async () => {
    mockApi({ ...baseRoutes, [`GET ${B}/purchases`]: () => json(200, page([summary({}, false)])) });
    const { container } = renderInBusiness(
      <PurchasesList slug="example-cement" businessId={BID} />,
      { me: salesmanP },
    );
    await screen.findByRole('rowheader', { name: 'PUR-0001' });
    expect(screen.queryByRole('columnheader', { name: 'Total' })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('৳');
    expect(screen.queryByRole('link', { name: 'New purchase' })).not.toBeInTheDocument();
  });

  it('empty vs nothing matches (Bengali)', async () => {
    mockApi({ ...baseRoutes, [`GET ${B}/purchases`]: () => json(200, page([])) });
    const { unmount } = renderInBusiness(<PurchasesList slug="example-cement" businessId={BID} />, {
      me: managerP,
      locale: 'bn',
    });
    expect(await screen.findByText('এখনো কোনো কেনা নেই')).toBeInTheDocument();
    unmount();
    nav.search = 'status=void';
    renderInBusiness(<PurchasesList slug="example-cement" businessId={BID} />, {
      me: managerP,
      locale: 'bn',
    });
    expect(await screen.findByRole('button', { name: /ফিল্টার/ })).toBeInTheDocument();
  });

  it('product filter: pick from search → productId in the URL, chip with its name', async () => {
    mockApi({ ...baseRoutes, [`GET ${B}/purchases`]: () => json(200, page([summary()])) });
    renderInBusiness(<PurchasesList slug="example-cement" businessId={BID} />, { me: managerP });
    await userEvent.click(await screen.findByRole('button', { name: 'Product' }));
    await userEvent.click(await screen.findByRole('button', { name: /P-0003 Sample PCC/ }));
    expect(nav.replace).toHaveBeenLastCalledWith('/b/example-cement/purchases?productId=p3', {
      scroll: false,
    });
  });
});

describe('<PurchaseForm>', () => {
  async function addLine(name: RegExp) {
    await userEvent.click(await screen.findByRole('button', { name }));
  }

  it('lines, display totals (exact), principal supplier default; sends strings; one request with one key', async () => {
    let resolve: (r: Response) => void = () => {};
    const { calls } = mockApi({
      ...baseRoutes,
      [`POST ${B}/purchases`]: () => new Promise<Response>((r) => (resolve = r)),
    });
    renderInBusiness(<PurchaseForm slug="example-cement" businessId={BID} />, { me: managerP });
    expect(await screen.findByLabelText('Supplier')).toHaveValue('s1');
    await addLine(/P-0001 Sample OPC/);
    await addLine(/P-0003 Sample PCC/);
    // Already-added products cannot be added twice.
    expect(screen.getByRole('button', { name: /P-0001 Sample OPC/ })).toBeDisabled();
    const qty = screen.getAllByLabelText('Quantity (Bag)');
    const price = screen.getAllByLabelText('Unit price');
    await userEvent.type(qty[0]!, '৫০০');
    await userEvent.type(price[0]!, '570');
    await userEvent.type(qty[1]!, '200');
    await userEvent.type(price[1]!, '545.50');
    expect(screen.getByText('৳2,85,000.00')).toBeInTheDocument();
    expect(screen.getByText('৳3,94,100.00')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Paper number'), 'CH-1');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Save purchase' }));
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body).toEqual({
      purchaseDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      supplierId: 's1',
      supplierReference: 'CH-1',
      items: [
        { productId: 'p1', quantity: '500', unitPrice: '570' },
        { productId: 'p3', quantity: '200', unitPrice: '545.50' },
      ],
    });
    expect(posts[0]!.headers.get('Idempotency-Key')).toMatch(/^[\w-]{8,64}$/);
    await act(async () => resolve(json(201, purchase({ id: 'pu9' }))));
    expect(nav.push).toHaveBeenCalledWith('/b/example-cement/purchases/pu9?saved=created');
  });

  it('validates lines; bags are whole numbers; failure keeps everything and reuses the key', async () => {
    let fail = true;
    const { calls } = mockApi({
      ...baseRoutes,
      [`POST ${B}/purchases`]: () =>
        fail
          ? apiError(400, 'VALIDATION_FAILED', undefined, [
              { field: 'items.0.quantity', code: 'QUANTITY_INVALID' },
            ])
          : json(201, purchase({ id: 'pu9' })),
    });
    renderInBusiness(<PurchaseForm slug="example-cement" businessId={BID} />, { me: managerP });
    await userEvent.click(await screen.findByRole('button', { name: 'Save purchase' }));
    expect(screen.getByText('Add at least one product.')).toBeInTheDocument();
    await addLine(/P-0001 Sample OPC/);
    await userEvent.type(screen.getByLabelText('Quantity (Bag)'), '12.5');
    await userEvent.type(screen.getByLabelText('Unit price'), '12.345');
    await userEvent.click(screen.getByRole('button', { name: 'Save purchase' }));
    expect(screen.getByLabelText('Quantity (Bag)')).toHaveAccessibleDescription(
      'Enter a quantity above zero (bags are whole numbers).',
    );
    expect(screen.getByLabelText('Unit price')).toHaveAccessibleDescription(
      'Enter the price like 570 or 570.50.',
    );
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await userEvent.clear(screen.getByLabelText('Quantity (Bag)'));
    await userEvent.type(screen.getByLabelText('Quantity (Bag)'), '10');
    await userEvent.clear(screen.getByLabelText('Unit price'));
    await userEvent.type(screen.getByLabelText('Unit price'), '570');
    await userEvent.click(screen.getByRole('button', { name: 'Save purchase' }));
    expect(
      await screen.findByText('Enter a quantity above zero (bags are whole numbers).'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity (Bag)')).toHaveValue('10');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Save purchase' }));
    await vi.waitFor(() => expect(nav.push).toHaveBeenCalled());
    const keys = calls
      .filter((c) => c.method === 'POST')
      .map((c) => c.headers.get('Idempotency-Key'));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('remove a line by keyboard; Bengali labels; a11y', async () => {
    mockApi(baseRoutes);
    const { container } = renderInBusiness(
      <PurchaseForm slug="example-cement" businessId={BID} />,
      {
        me: managerP,
        locale: 'bn',
      },
    );
    await addLine(/P-0001 Sample OPC/);
    const remove = screen.getByRole('button', { name: 'Sample OPC বাদ দিন' });
    remove.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('button', { name: 'Sample OPC বাদ দিন' })).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe('<PurchaseDetail>', () => {
  it('manager: lines with prices and totals; created notice', async () => {
    nav.search = 'saved=created';
    mockApi({ ...baseRoutes, [`GET ${B}/purchases/pu1`]: () => json(200, purchase()) });
    renderInBusiness(<PurchaseDetail slug="example-cement" businessId={BID} id="pu1" />, {
      me: managerP,
    });
    expect(await screen.findByRole('heading', { name: 'Purchase PUR-0001' })).toBeInTheDocument();
    expect(screen.getByText('Purchase saved.')).toBeInTheDocument();
    const line = screen.getByRole('rowheader', { name: /Sample OPC/ }).closest('tr')!;
    expect(line).toHaveTextContent('৳570.00');
    expect(line).toHaveTextContent('৳2,85,000.00');
    expect(screen.getByRole('link', { name: 'Stock history of Sample OPC' })).toHaveAttribute(
      'href',
      `${B}/stock/p1`,
    );
  });

  it('without product.cost.view: no price columns, no amounts at all', async () => {
    mockApi({ ...baseRoutes, [`GET ${B}/purchases/pu1`]: () => json(200, purchase({}, false)) });
    const { container } = renderInBusiness(
      <PurchaseDetail slug="example-cement" businessId={BID} id="pu1" />,
      { me: salesmanP },
    );
    await screen.findByRole('heading', { name: 'Purchase PUR-0001' });
    expect(screen.queryByRole('columnheader', { name: 'Unit price' })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('৳');
  });

  it('void purchase shows who, when and why', async () => {
    mockApi({
      ...baseRoutes,
      [`GET ${B}/purchases/pu1`]: () =>
        json(
          200,
          purchase({
            status: 'void',
            voidedAt: '2026-11-19T05:00:00.000Z',
            voidReason: 'Entered twice',
            voidedBy: { id: 'u1', name: 'Jesan Owner' },
          }),
        ),
    });
    renderInBusiness(<PurchaseDetail slug="example-cement" businessId={BID} id="pu1" />, {
      me: ownerP,
    });
    expect(await screen.findByText('This purchase is void')).toBeInTheDocument();
    expect(screen.getByText('Entered twice')).toBeInTheDocument();
  });
});
