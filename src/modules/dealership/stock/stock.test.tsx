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
import { apiError, json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import { ProductDetail } from '../master-data/products/product-detail';
import { ProductsList } from '../master-data/products/products-list';
import { StockHistory } from './stock-history';
import { StockList } from './stock-list';
import type { Movement, StockRow } from './types';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/b/example-cement/stock/p1',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
beforeEach(() => {
  nav.search = '';
  nav.replace.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const BID = 'b1';
const B = '/b/example-cement';
const meWith = (permissions: string[]): Me => ({
  ...managerMe,
  businesses: [business({ permissions })],
});
const managerS = meWith([...MANAGER_PERMISSIONS, 'change.request', 'change.view.own']);
const salesmanS = meWith(SALESMAN_PERMISSIONS);

const row = (o: Partial<StockRow> = {}, withCost = true): StockRow => {
  const r: StockRow = {
    id: 'p1',
    code: 'P-0001',
    nameEn: 'Sample OPC',
    nameBn: 'নমুনা ওপিসি',
    unitKey: 'bag',
    category: { id: 'c1', nameEn: 'OPC', nameBn: 'ওপিসি' },
    currentStock: '1500',
    isActive: true,
    lastPurchasePrice: '570.00',
    lastPurchasedAt: '2026-11-17T18:00:00.000Z',
    ...o,
  };
  if (!withCost) {
    delete r.lastPurchasePrice;
    delete r.lastPurchasedAt;
  }
  return r;
};
const movement = (o: Partial<Movement> = {}): Movement => ({
  id: 'm1',
  kind: 'purchase',
  quantity: '500',
  balanceAfter: '1500',
  movementDate: '2026-11-18',
  source: { type: 'purchase', id: 'pu1', code: 'PUR-0001' },
  reason: null,
  createdBy: { id: 'u2', name: 'Rahim Uddin' },
  createdAt: '2026-11-18T11:00:00.000Z',
  ...o,
});
const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 10, total: items.length });
const baseRoutes = {
  [`GET ${B}/product-units`]: () =>
    json(200, {
      defaultUnitKey: 'bag',
      items: [{ key: 'bag', nameEn: 'Bag', nameBn: 'বস্তা', decimals: 0 }],
    }),
  [`GET ${B}/product-categories`]: () => json(200, { items: [] }),
};
const history = (items: Movement[]) => ({
  [`GET ${B}/stock/p1/movements`]: () =>
    json(200, {
      product: { ...row({}, false), currentStock: '1500' },
      ...page(items),
    }),
});

describe('<StockList>', () => {
  it('manager: quantity with unit, last purchase price and date; history and adjust per row', async () => {
    const { container } = (() => {
      mockApi({ ...baseRoutes, [`GET ${B}/stock`]: () => json(200, page([row()])) });
      return renderInBusiness(<StockList slug="example-cement" businessId={BID} />, {
        me: managerS,
      });
    })();
    const tr = (await screen.findByRole('rowheader', { name: /Sample OPC/ })).closest('tr')!;
    expect(tr).toHaveTextContent('1,500 Bag');
    expect(tr).toHaveTextContent('৳570.00');
    expect(screen.getByRole('link', { name: 'Stock history of Sample OPC' })).toHaveAttribute(
      'href',
      `${B}/stock/p1`,
    );
    expect(screen.getByRole('button', { name: 'Adjust stock of Sample OPC' })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('salesman: only quantities (no price column or amount), no adjust (Bengali)', async () => {
    mockApi({ ...baseRoutes, [`GET ${B}/stock`]: () => json(200, page([row({}, false)])) });
    const { container } = renderInBusiness(<StockList slug="example-cement" businessId={BID} />, {
      me: salesmanS,
      locale: 'bn',
    });
    expect(await screen.findByText('১,৫০০ বস্তা')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('৳');
    expect(container).not.toHaveTextContent('শেষ কেনা-দাম');
    expect(screen.queryByRole('button', { name: /সমন্বয়/ })).not.toBeInTheDocument();
  });

  it('adjust: signed quantity + reason; only stock refreshes', async () => {
    const { calls } = mockApi({
      ...baseRoutes,
      [`GET ${B}/stock`]: () => json(200, page([row()])),
      [`POST ${B}/stock/adjustments`]: () => json(201, row({ currentStock: '1497' })),
    });
    const { invalidate } = renderInBusiness(<StockList slug="example-cement" businessId={BID} />, {
      me: managerS,
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Adjust stock of Sample OPC' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Adjust stock: Sample OPC' });
    await userEvent.type(within(dialog).getByLabelText('Change (with sign)'), '0');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save adjustment' }));
    expect(within(dialog).getByLabelText('Change (with sign)')).toHaveAccessibleDescription(
      /non-zero quantity with sign/,
    );
    expect(within(dialog).getByLabelText('Reason')).toHaveAccessibleDescription(/Write a reason/);
    await userEvent.clear(within(dialog).getByLabelText('Change (with sign)'));
    await userEvent.type(within(dialog).getByLabelText('Change (with sign)'), '-৩');
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Torn bags');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save adjustment' }));
    expect(await screen.findByText('Stock adjusted.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
      productId: 'p1',
      quantity: '-3',
      reason: 'Torn bags',
    });
    expect(invalidate.mock.calls.map(([f]) => JSON.stringify(f?.queryKey))).toEqual([
      JSON.stringify(['dealership', BID, 'stock']),
    ]);
  });

  it('over the daily limit: limit shown, then the same values go to the owner as a request', async () => {
    const { calls } = mockApi({
      ...baseRoutes,
      [`GET ${B}/stock`]: () => json(200, page([row()])),
      [`POST ${B}/stock/adjustments`]: () =>
        json(403, {
          statusCode: 403,
          message: 'x',
          code: 'ADJUSTMENT_APPROVAL_REQUIRED',
          field: 'quantity',
          details: { limit: '10', usedToday: '3' },
        }),
      [`POST ${B}/change-requests/preview`]: () =>
        json(200, {
          entityLabel: 'P-0001',
          impact: [
            {
              key: 'stock.p1',
              label: 'Stock P-0001',
              before: '1500',
              after: '1470',
              delta: '-30',
              unit: 'bag',
            },
          ],
        }),
      [`POST ${B}/change-requests`]: () => json(201, { id: 'cr1' }),
    });
    renderInBusiness(<StockList slug="example-cement" businessId={BID} />, { me: managerS });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Adjust stock of Sample OPC' }),
    );
    let dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Change (with sign)'), '-30');
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Water damage');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save adjustment' }));
    expect(
      await within(dialog).findByText(
        'This is above your daily limit of 10 (used today: 3). The owner must approve it.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send for approval' }));
    dialog = screen.getByRole('dialog', { name: 'Request a correction: Sample OPC' });
    expect(within(dialog).getByLabelText('Reason for the request')).toHaveValue('Water damage');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Review' }));
    // Quantities read as quantities (not money); the stock line is labelled by product code.
    const line = (await within(dialog).findByText('Stock P-0001')).closest('li')!;
    expect(line).toHaveTextContent('1,500 → 1,470');
    expect(line).toHaveTextContent('(-30)');
    expect(line).not.toHaveTextContent('৳');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send request' }));
    await vi.waitFor(() =>
      expect(calls.find((c) => c.path === `${B}/change-requests`)!.body).toEqual({
        entityType: 'product_stock',
        entityId: 'p1',
        kind: 'edit',
        reason: 'Water damage',
        proposedChange: { adjustBy: '-30' },
      }),
    );
  });
});

describe('<StockHistory>', () => {
  it('movements with sign, stock after, purchase link; filters to the URL', async () => {
    const { calls } = mockApi({
      ...baseRoutes,
      ...history([
        movement({
          id: 'm2',
          kind: 'adjustment',
          quantity: '-3',
          balanceAfter: '1497',
          source: { type: 'adjustment', id: null, code: null },
          reason: 'Torn bags',
        }),
        movement(),
      ]),
    });
    const { container } = renderInBusiness(
      <StockHistory slug="example-cement" businessId={BID} productId="p1" />,
      { me: managerS },
    );
    expect(
      await screen.findByRole('heading', { name: 'Stock history of Sample OPC' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Now in stock: 1,500 Bag')).toBeInTheDocument();
    expect(screen.getByText('-3')).toBeInTheDocument();
    expect(screen.getByText('+500')).toBeInTheDocument();
    expect(screen.getByText('Torn bags')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PUR-0001' })).toHaveAttribute(
      'href',
      `${B}/purchases/pu1`,
    );
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'adjustment');
    expect(nav.replace).toHaveBeenLastCalledWith('/b/example-cement/stock/p1?kind=adjustment', {
      scroll: false,
    });
    expect(calls.find((c) => c.path.endsWith('/movements'))!.url).toContain('page=1');
    await expectNoA11yViolations(container);
  });

  it('empty vs filtered; 404 → product not found (Bengali)', async () => {
    mockApi({ ...baseRoutes, ...history([]) });
    const { unmount } = renderInBusiness(
      <StockHistory slug="example-cement" businessId={BID} productId="p1" />,
      { me: salesmanS, locale: 'bn' },
    );
    expect(await screen.findByText('এখনো কোনো চলাচল নেই')).toBeInTheDocument();
    unmount();
    mockApi({
      ...baseRoutes,
      [`GET ${B}/stock/p1/movements`]: () => apiError(404, 'PRODUCT_NOT_FOUND'),
    });
    renderInBusiness(<StockHistory slug="example-cement" businessId={BID} productId="p1" />, {
      me: salesmanS,
      locale: 'bn',
    });
    expect(await screen.findByRole('heading', { name: 'পণ্য পাওয়া যায়নি' })).toBeInTheDocument();
  });
});

describe('stock on product pages', () => {
  const product = {
    id: 'p1',
    code: 'P-0001',
    category: { id: 'c1', nameEn: 'OPC', nameBn: 'ওপিসি' },
    nameEn: 'Sample OPC',
    nameBn: 'নমুনা ওপিসি',
    unitKey: 'bag',
    lastPurchasePrice: '570.00',
    lastPurchasedAt: '2026-11-17T18:00:00.000Z',
    isActive: true,
    createdAt: '2026-11-17T08:38:04.236Z',
    updatedAt: '2026-11-17T08:38:04.236Z',
  };

  it('product list: current stock matched by id from GET stock (same filters)', async () => {
    nav.search = 'search=opc';
    const { calls } = mockApi({
      ...baseRoutes,
      [`GET ${B}/products`]: () => json(200, page([product])),
      [`GET ${B}/stock`]: () => json(200, page([row()])),
    });
    renderInBusiness(<ProductsList slug="example-cement" businessId={BID} />, { me: managerS });
    const tr = (await screen.findByRole('rowheader', { name: /Sample OPC/ })).closest('tr')!;
    await vi.waitFor(() => expect(tr).toHaveTextContent('1,500'));
    expect(calls.find((c) => c.path === `${B}/stock`)!.url).toBe(
      '/api/v1/b/example-cement/stock?page=1&search=opc',
    );
  });

  it('product detail: current stock and a link to its history; none without stock.view', async () => {
    const { calls } = mockApi({
      ...baseRoutes,
      [`GET ${B}/products/p1`]: () => json(200, product),
      ...history([movement()]),
    });
    const { unmount } = renderInBusiness(
      <ProductDetail slug="example-cement" businessId={BID} id="p1" />,
      { me: managerS },
    );
    expect(await screen.findByText('1,500')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Stock history' })).toHaveAttribute(
      'href',
      `${B}/stock/p1`,
    );
    unmount();
    calls.length = 0;
    renderInBusiness(<ProductDetail slug="example-cement" businessId={BID} id="p1" />, {
      me: meWith(['product.view']),
    });
    await screen.findByRole('heading', { name: 'Sample OPC' });
    expect(screen.queryByText('Current stock')).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/movements'))).toBe(false);
  });
});
