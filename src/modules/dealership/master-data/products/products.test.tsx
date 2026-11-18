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
} from '../../../../../test/fixtures/me';
import { apiError, json, mockApi, renderInBusiness } from '../../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../../test/utils';
import { CategoriesPanel } from '../categories/categories-panel';
import { CategoryDetail } from '../categories/category-detail';
import type { Category, Product } from '../types';
import { ProductDetail } from './product-detail';
import { ProductForm } from './product-form';
import { ProductsList } from './products-list';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn(), push: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: nav.replace,
    push: nav.push,
    back: nav.back,
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/b/example-cement/products',
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
const salesmanMe = meWith(SALESMAN_PERMISSIONS);
const ownerMe = meWith(OWNER_PERMISSIONS);

const opc: Category = {
  id: 'c1',
  nameEn: 'OPC',
  nameBn: 'ওপিসি',
  sortOrder: 1,
  isActive: true,
  createdAt: '2026-11-17T08:38:04.236Z',
  updatedAt: '2026-11-17T08:38:04.236Z',
};
const pcc: Category = { ...opc, id: 'c2', nameEn: 'PCC', nameBn: 'পিসিসি', sortOrder: 2 };

function product(overrides: Partial<Product> = {}, withCost = true): Product {
  const p: Product = {
    id: 'p1',
    code: 'P-0001',
    category: { id: 'c1', nameEn: 'OPC', nameBn: 'ওপিসি' },
    nameEn: 'Sample OPC 50kg',
    nameBn: 'নমুনা ওপিসি ৫০ কেজি',
    unitKey: 'bag',
    purchasePrice: '540.00',
    isActive: true,
    createdAt: '2026-11-17T08:38:04.236Z',
    updatedAt: '2026-11-17T08:38:04.236Z',
    ...overrides,
  };
  if (!withCost) delete p.purchasePrice; // the API leaves the field out entirely
  return p;
}

const page = (items: Product[], total = items.length) => ({ items, page: 1, pageSize: 10, total });
const baseRoutes = {
  [`GET ${B}/product-categories`]: () => json(200, { items: [opc, pcc] }),
  [`GET ${B}/product-units`]: () =>
    json(200, {
      defaultUnitKey: 'bag',
      items: [{ key: 'bag', nameEn: 'Bag', nameBn: 'বস্তা', decimals: 0 }],
    }),
};

describe('<ProductsList>', () => {
  it('manager (product.cost.view): purchase-price column, ৳ with lakh grouping', async () => {
    mockApi({ ...baseRoutes, [`GET ${B}/products`]: () => json(200, page([product()])) });
    renderInBusiness(<ProductsList slug="example-cement" businessId={BID} />, { me: managerMe });
    expect(await screen.findByRole('columnheader', { name: 'Purchase price' })).toBeInTheDocument();
    const row = screen.getByRole('rowheader', { name: /Sample OPC 50kg/ }).closest('tr')!;
    expect(row).toHaveTextContent('৳540.00');
    // Products have no sale price any more (set per sale on the invoice).
    expect(screen.queryByRole('columnheader', { name: /sale price/i })).not.toBeInTheDocument();
    expect(row).toHaveTextContent('Bag');
  });

  it('salesman (no product.cost.view): no purchase-price column or text at all', async () => {
    mockApi({ ...baseRoutes, [`GET ${B}/products`]: () => json(200, page([product({}, false)])) });
    const { container } = renderInBusiness(
      <ProductsList slug="example-cement" businessId={BID} />,
      { me: salesmanMe },
    );
    await screen.findByRole('rowheader', { name: /Sample OPC 50kg/ });
    expect(screen.queryByRole('columnheader', { name: 'Purchase price' })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('Purchase price');
    expect(container).not.toHaveTextContent('540');
    expect(screen.queryByRole('link', { name: 'New product' })).not.toBeInTheDocument();
  });

  it('search is debounced 300 ms and written to the URL (page reset)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    nav.search = 'page=3';
    mockApi({ ...baseRoutes, [`GET ${B}/products`]: () => json(200, page([product()])) });
    renderInBusiness(<ProductsList slug="example-cement" businessId={BID} />, { me: managerMe });
    const box = await screen.findByRole('searchbox', { name: 'Search' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(box, 'opc 50');
    expect(nav.replace).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(300));
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenCalledWith('/b/example-cement/products?search=opc+50', {
      scroll: false,
    });
  });

  it('sends search, category, status and page from the URL to the API', async () => {
    nav.search = 'search=opc&category=c2&active=all&page=2';
    const { calls } = mockApi({
      ...baseRoutes,
      [`GET ${B}/products`]: () => json(200, { ...page([product()], 15), page: 2 }),
    });
    renderInBusiness(<ProductsList slug="example-cement" businessId={BID} />, { me: managerMe });
    await screen.findByRole('rowheader', { name: /Sample OPC 50kg/ });
    const call = calls.find((c) => c.path === `${B}/products`)!;
    expect(call.url).toBe(
      '/api/v1/b/example-cement/products?search=opc&categoryId=c2&active=all&page=2',
    );
    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('Category')).toHaveValue('c2');
  });

  it('empty vs no results; 403 shows the permission message without retry', async () => {
    mockApi({ ...baseRoutes, [`GET ${B}/products`]: () => json(200, page([])) });
    const first = renderInBusiness(<ProductsList slug="example-cement" businessId={BID} />, {
      me: managerMe,
    });
    expect(await screen.findByText('No products yet')).toBeInTheDocument();
    first.unmount();

    nav.search = 'search=zzz';
    renderInBusiness(<ProductsList slug="example-cement" businessId={BID} />, { me: managerMe });
    expect(await screen.findByText('Nothing matches')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }));
    expect(nav.replace).toHaveBeenCalledWith('/b/example-cement/products', { scroll: false });
  });

  it('403 → "no permission", no retry button', async () => {
    mockApi({ ...baseRoutes, [`GET ${B}/products`]: () => json(403, { statusCode: 403 }) });
    renderInBusiness(<ProductsList slug="example-cement" businessId={BID} />, { me: managerMe });
    expect(await screen.findByText('You do not have permission to do this.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('phones get cards instead of a table; Bengali labels; no a11y violations', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    mockApi({
      ...baseRoutes,
      [`GET ${B}/products`]: () => json(200, page([product({ purchasePrice: '1234567.50' })])),
    });
    const { container } = renderInBusiness(
      <ProductsList slug="example-cement" businessId={BID} />,
      { me: managerMe, locale: 'bn' },
    );
    const card = await screen.findByRole('link', { name: /^নমুনা ওপিসি ৫০ কেজি(?!-এর)/ });
    // Every card also has a visible Details link that names the record.
    expect(screen.getByRole('link', { name: 'নমুনা ওপিসি ৫০ কেজি-এর বিস্তারিত' })).toHaveAttribute(
      'href',
      `${B}/products/p1`,
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(card).toHaveTextContent('৳১২,৩৪,৫৬৭.৫০');
    expect(card).toHaveTextContent('বস্তা');
    await expectNoA11yViolations(container);
  });
});

describe('<ProductForm> create', () => {
  it('sends money as strings, only filled fields, default unit; then opens the product', async () => {
    const { calls } = mockApi({
      ...baseRoutes,
      [`POST ${B}/products`]: () => json(201, product({ id: 'p9' })),
    });
    renderInBusiness(<ProductForm slug="example-cement" businessId={BID} />, { me: managerMe });
    await userEvent.selectOptions(await screen.findByLabelText('Category'), 'c1');
    await userEvent.type(screen.getByLabelText('Name (English)'), 'Sample OPC 40kg');
    await userEvent.type(screen.getByLabelText('Name (Bangla)'), 'নমুনা ওপিসি ৪০ কেজি');
    await userEvent.type(screen.getByLabelText('Purchase price'), '৪৫০');
    expect(screen.queryByLabelText(/sale price/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toEqual({
      categoryId: 'c1',
      nameEn: 'Sample OPC 40kg',
      nameBn: 'নমুনা ওপিসি ৪০ কেজি',
      unitKey: 'bag',
      purchasePrice: '450',
    });
    expect(nav.push).toHaveBeenCalledWith('/b/example-cement/products/p9?saved=created');
  });

  it('salesman-like (no cost permission): no purchase-price field, none sent', async () => {
    const perms = [...MANAGER_PERMISSIONS.filter((p) => p !== 'product.cost.view')];
    const { calls } = mockApi({
      ...baseRoutes,
      [`POST ${B}/products`]: () => json(201, product({}, false)),
    });
    renderInBusiness(<ProductForm slug="example-cement" businessId={BID} />, { me: meWith(perms) });
    await userEvent.selectOptions(await screen.findByLabelText('Category'), 'c1');
    expect(screen.queryByLabelText('Purchase price')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Name (English)'), 'X');
    await userEvent.type(screen.getByLabelText('Name (Bangla)'), 'এক্স');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(calls.find((c) => c.method === 'POST')!.body).not.toHaveProperty('purchasePrice');
  });

  it('validates required fields and money format; 409 marks the name; one request on double click', async () => {
    let resolve: (r: Response) => void = () => {};
    const { calls } = mockApi({
      ...baseRoutes,
      [`POST ${B}/products`]: () => new Promise<Response>((r) => (resolve = r)),
    });
    renderInBusiness(<ProductForm slug="example-cement" businessId={BID} />, { me: managerMe });
    await userEvent.click(await screen.findByRole('button', { name: 'Create' }));
    expect(screen.getByLabelText('Name (English)')).toHaveAccessibleDescription(
      'This field is required.',
    );
    await userEvent.type(screen.getByLabelText('Purchase price'), '12.345');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByLabelText('Purchase price')).toHaveAccessibleDescription(
      /Enter an amount like 570/,
    );
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await userEvent.selectOptions(screen.getByLabelText('Category'), 'c1');
    await userEvent.type(screen.getByLabelText('Name (English)'), 'Dup');
    await userEvent.type(screen.getByLabelText('Name (Bangla)'), 'ডুপ');
    await userEvent.clear(screen.getByLabelText('Purchase price'));
    await userEvent.type(screen.getByLabelText('Purchase price'), '500');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Create' }));
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    await act(async () => resolve(apiError(409, 'NAME_EN_DUPLICATE', 'nameEn')));
    expect(
      await screen.findByText('This English name is already used in this business.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name (English)')).toHaveAccessibleDescription(
      'This English name is already used in this business.',
    );
  });
});

describe('<ProductForm> edit', () => {
  it('manager (no product.price.edit): prices read-only, only changed names sent', async () => {
    const { calls } = mockApi({
      ...baseRoutes,
      [`PATCH ${B}/products/p1`]: () => json(200, product({ nameEn: 'Renamed' })),
    });
    renderInBusiness(<ProductForm slug="example-cement" businessId={BID} product={product()} />, {
      me: managerMe,
    });
    expect(
      await screen.findByText('Changing these needs owner-level permission.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Purchase price')).toHaveAttribute('readonly');
    expect(screen.queryByLabelText('Reason for the change')).not.toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Name (English)'));
    await userEvent.type(screen.getByLabelText('Name (English)'), 'Renamed');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ nameEn: 'Renamed' });
  });

  it('owner: changing a price needs a reason; only the price and reason are sent', async () => {
    const { calls } = mockApi({
      ...baseRoutes,
      [`PATCH ${B}/products/p1`]: () => json(200, product()),
    });
    renderInBusiness(
      <ProductForm
        slug="example-cement"
        businessId={BID}
        product={product({ purchasePrice: '560.00' })}
      />,
      { me: ownerMe },
    );
    const cost = await screen.findByLabelText('Purchase price');
    await userEvent.clear(cost);
    await userEvent.type(cost, '565');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const reason = screen.getByLabelText('Reason for the change');
    expect(reason).toHaveAccessibleDescription(/Write why this is being changed/);
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    await userEvent.type(reason, 'new rate from the supplier');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      purchasePrice: '565',
      reason: 'new rate from the supplier',
    });
  });

  it('"570" vs "570.00" is not a change; nothing changed → no request', async () => {
    const { calls } = mockApi(baseRoutes);
    renderInBusiness(
      <ProductForm
        slug="example-cement"
        businessId={BID}
        product={product({ purchasePrice: '570.00' })}
      />,
      { me: ownerMe },
    );
    const cost = await screen.findByLabelText('Purchase price');
    await userEvent.clear(cost);
    await userEvent.type(cost, '570');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Nothing has changed.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });
});

describe('<ProductDetail>', () => {
  it('salesman: no purchase-price row; no edit or deactivate buttons', async () => {
    mockApi({ ...baseRoutes, [`GET ${B}/products/p1`]: () => json(200, product({}, false)) });
    const { container } = renderInBusiness(
      <ProductDetail slug="example-cement" businessId={BID} id="p1" />,
      { me: salesmanMe },
    );
    await screen.findByRole('heading', { name: 'Sample OPC 50kg' });
    expect(container).not.toHaveTextContent('Purchase price');
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
  });

  it('owner deactivates with a required reason; products refreshed', async () => {
    const { calls } = mockApi({
      ...baseRoutes,
      [`GET ${B}/products/p1`]: () => json(200, product()),
      [`PATCH ${B}/products/p1`]: () => json(200, product({ isActive: false })),
    });
    const { invalidate } = renderInBusiness(
      <ProductDetail slug="example-cement" businessId={BID} id="p1" />,
      { me: ownerMe },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate Sample OPC 50kg?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(within(dialog).getByLabelText('Reason for the change')).toHaveAccessibleDescription(
      /Write why/,
    );
    await userEvent.type(within(dialog).getByLabelText('Reason for the change'), 'discontinued');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText('Status saved.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      isActive: false,
      reason: 'discontinued',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dealership', BID, 'products'] });
  });
});

describe('<CategoriesPanel>', () => {
  it('creates a category; duplicate name (409) marks the name field', async () => {
    let first = true;
    const { calls } = mockApi({
      ...baseRoutes,
      [`POST ${B}/product-categories`]: () =>
        first
          ? ((first = false), apiError(409, 'NAME_EN_DUPLICATE', 'nameEn'))
          : json(201, { ...opc, id: 'c3' }),
    });
    const { invalidate } = renderInBusiness(
      <CategoriesPanel slug="example-cement" businessId={BID} />,
      { me: managerMe },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'New category' }));
    const dialog = screen.getByRole('dialog', { name: 'New category' });
    await userEvent.type(within(dialog).getByLabelText('Name (English)'), 'OPC');
    await userEvent.type(within(dialog).getByLabelText('Name (Bangla)'), 'ওপিসি');
    await userEvent.type(within(dialog).getByLabelText('Display order'), '৩');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(
      await within(dialog).findByText('This English name is already used in this business.'),
    ).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
      nameEn: 'OPC',
      nameBn: 'ওপিসি',
      sortOrder: 3,
    });

    await userEvent.clear(within(dialog).getByLabelText('Name (English)'));
    await userEvent.type(within(dialog).getByLabelText('Name (English)'), 'Special');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Created.')).toBeInTheDocument();
    // A category change refreshes categories and products (rows show category names), nothing else.
    const keys = invalidate.mock.calls.map(([f]) => JSON.stringify(f?.queryKey));
    expect(keys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['dealership', BID, 'categories']),
        JSON.stringify(['dealership', BID, 'products']),
      ]),
    );
    expect(keys.every((k) => k.includes('categories') || k.includes('products'))).toBe(true);
  });

  it('salesman sees the list read-only', async () => {
    mockApi(baseRoutes);
    renderInBusiness(<CategoriesPanel slug="example-cement" businessId={BID} />, {
      me: salesmanMe,
    });
    expect(await screen.findByRole('rowheader', { name: 'OPC' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New category' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
  });
});

describe('row Details and Actions (products)', () => {
  const listRoutes = {
    ...baseRoutes,
    [`GET ${B}/products`]: () => json(200, page([product()])),
  };

  it('salesman: a visible Details link, no Actions menu at all', async () => {
    mockApi(listRoutes);
    renderInBusiness(<ProductsList slug="example-cement" businessId={BID} />, { me: salesmanMe });
    expect(await screen.findByRole('link', { name: 'Details of Sample OPC 50kg' })).toHaveAttribute(
      'href',
      `${B}/products/p1`,
    );
    expect(screen.getByRole('link', { name: 'Details of Sample OPC 50kg' })).toHaveTextContent(
      'Details',
    );
    expect(
      screen.queryByRole('button', { name: 'Actions for Sample OPC 50kg' }),
    ).not.toBeInTheDocument();
  });

  it('manager: Actions has Edit only (no deactivate permission); no Delete anywhere', async () => {
    mockApi(listRoutes);
    renderInBusiness(<ProductsList slug="example-cement" businessId={BID} />, { me: managerMe });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Actions for Sample OPC 50kg' }),
    );
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `${B}/products/p1/edit`,
    );
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Delete/)).not.toBeInTheDocument();
  });

  it('owner: deactivate from the menu needs a reason; keyboard works; a11y clean', async () => {
    const { calls } = mockApi({
      ...listRoutes,
      [`PATCH ${B}/products/p1`]: () => json(200, product({ isActive: false })),
    });
    const { container, invalidate } = renderInBusiness(
      <ProductsList slug="example-cement" businessId={BID} />,
      { me: ownerMe },
    );
    const trigger = await screen.findByRole('button', { name: 'Actions for Sample OPC 50kg' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expectNoA11yViolations(container);
    await userEvent.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate Sample OPC 50kg?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(
      within(dialog).getByText('Write why this is being changed (at least 3 characters).'),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    await userEvent.type(within(dialog).getByLabelText('Reason for the change'), 'discontinued');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText('Status saved.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      isActive: false,
      reason: 'discontinued',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dealership', BID, 'products'] });
  });

  it('Bengali labels on the row', async () => {
    mockApi(listRoutes);
    renderInBusiness(<ProductsList slug="example-cement" businessId={BID} />, {
      me: ownerMe,
      locale: 'bn',
    });
    expect(
      await screen.findByRole('link', { name: 'নমুনা ওপিসি ৫০ কেজি-এর বিস্তারিত' }),
    ).toHaveTextContent('বিস্তারিত');
    await userEvent.click(screen.getByRole('button', { name: 'নমুনা ওপিসি ৫০ কেজি-এর কাজ' }));
    expect(screen.getByRole('link', { name: 'সম্পাদনা' })).toBeInTheDocument();
  });
});

describe('categories: Details, Actions and the detail page', () => {
  it('rows link to the category page; owner deactivates from the menu with a reason', async () => {
    const { calls } = mockApi({
      ...baseRoutes,
      [`PATCH ${B}/product-categories/c1`]: () => json(200, { ...opc, isActive: false }),
    });
    renderInBusiness(<CategoriesPanel slug="example-cement" businessId={BID} />, { me: ownerMe });
    expect(await screen.findByRole('link', { name: 'Details of OPC' })).toHaveAttribute(
      'href',
      `${B}/products/categories/c1`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Actions for OPC' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('dialog', { name: 'Edit OPC' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await userEvent.click(screen.getByRole('button', { name: 'Actions for OPC' }));
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate OPC?' });
    await userEvent.type(within(dialog).getByLabelText('Reason for the change'), 'merged');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText('Status saved.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      isActive: false,
      reason: 'merged',
    });
  });

  it('salesman: Details only, no Actions menu', async () => {
    mockApi(baseRoutes);
    renderInBusiness(<CategoriesPanel slug="example-cement" businessId={BID} />, {
      me: salesmanMe,
    });
    await screen.findByRole('link', { name: 'Details of OPC' });
    expect(screen.queryByRole('button', { name: 'Actions for OPC' })).not.toBeInTheDocument();
  });

  it('detail page: fields, link to its products, Bengali, a11y; unknown id → not found', async () => {
    const { calls } = mockApi(baseRoutes);
    const { container, unmount } = renderInBusiness(
      <CategoryDetail slug="example-cement" businessId={BID} id="c2" />,
      { me: salesmanMe, locale: 'bn' },
    );
    expect(await screen.findByRole('heading', { name: 'পিসিসি' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'এই ক্যাটাগরির পণ্য' })).toHaveAttribute(
      'href',
      `${B}/products?category=c2`,
    );
    expect(screen.queryByRole('button', { name: 'সম্পাদনা' })).not.toBeInTheDocument();
    expect(calls[0]!.url).toContain('active=all');
    await expectNoA11yViolations(container);
    unmount();

    renderInBusiness(<CategoryDetail slug="example-cement" businessId={BID} id="nope" />, {
      me: salesmanMe,
    });
    expect(await screen.findByRole('heading', { name: 'Not found' })).toBeInTheDocument();
  });
});

describe('<ProductForm> inline new category', () => {
  it('creates a category from the form and selects it at once; categories refreshed', async () => {
    const { calls } = mockApi({
      ...baseRoutes,
      [`POST ${B}/product-categories`]: () =>
        json(201, { ...opc, id: 'c3', nameEn: 'White cement', nameBn: 'সাদা সিমেন্ট' }),
    });
    const { invalidate } = renderInBusiness(
      <ProductForm slug="example-cement" businessId={BID} />,
      { me: managerMe },
    );
    const select = await screen.findByLabelText('Category');
    await userEvent.click(screen.getByRole('button', { name: 'New category' }));
    const dialog = screen.getByRole('dialog', { name: 'New category' });
    await userEvent.type(within(dialog).getByLabelText('Name (English)'), 'White cement');
    await userEvent.type(within(dialog).getByLabelText('Name (Bangla)'), 'সাদা সিমেন্ট');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('option', { name: 'White cement' })).toBeInTheDocument();
    expect(select).toHaveValue('c3');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dealership', BID, 'categories'] });
  });

  it('without product.manage there is no New category button', async () => {
    mockApi(baseRoutes);
    renderInBusiness(<ProductForm slug="example-cement" businessId={BID} />, {
      me: salesmanMe,
      locale: 'bn',
    });
    await screen.findByLabelText('ক্যাটাগরি');
    expect(screen.queryByRole('button', { name: 'নতুন ক্যাটাগরি' })).not.toBeInTheDocument();
  });
});

describe('<ProductForm> without cost permission (edit)', () => {
  it('no price section at all when the API sent no purchase price', async () => {
    mockApi(baseRoutes);
    renderInBusiness(
      <ProductForm slug="example-cement" businessId={BID} product={product({}, false)} />,
      { me: salesmanMe },
    );
    await screen.findByLabelText('Name (English)');
    expect(screen.queryByLabelText('Purchase price')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Changing these needs owner-level permission.'),
    ).not.toBeInTheDocument();
  });
});

describe('API error codes in the product form (docs/API.md §11)', () => {
  const fill = async () => {
    await userEvent.selectOptions(await screen.findByLabelText('Category'), 'c1');
    await userEvent.type(screen.getByLabelText('Name (English)'), 'New');
    await userEvent.type(screen.getByLabelText('Name (Bangla)'), 'নতুন');
  };

  it('inactive category and unknown unit appear under their own fields (Bengali)', async () => {
    mockApi({
      ...baseRoutes,
      [`POST ${B}/products`]: () =>
        apiError(400, 'VALIDATION_FAILED', undefined, [
          { field: 'categoryId', code: 'CATEGORY_NOT_FOUND_OR_INACTIVE' },
          { field: 'unitKey', code: 'UNIT_UNKNOWN' },
        ]),
    });
    renderInBusiness(<ProductForm slug="example-cement" businessId={BID} />, {
      me: managerMe,
      locale: 'bn',
    });
    await userEvent.selectOptions(await screen.findByLabelText('ক্যাটাগরি'), 'c1');
    await userEvent.type(screen.getByLabelText('নাম (ইংরেজি)'), 'New');
    await userEvent.type(screen.getByLabelText('নাম (বাংলা)'), 'নতুন');
    await userEvent.click(screen.getByRole('button', { name: 'তৈরি করুন' }));
    expect(await screen.findByLabelText('ক্যাটাগরি')).toHaveAccessibleDescription(
      'এই ক্যাটাগরি নেই বা নিষ্ক্রিয়। অন্য একটা বাছাই করুন।',
    );
    expect(screen.getByLabelText('একক')).toHaveAccessibleDescription('এই একক ব্যবসার সেটিংসে নেই।');
  });

  it('an unknown code falls back to the general message for its status, above the form', async () => {
    mockApi({ ...baseRoutes, [`POST ${B}/products`]: () => apiError(409, 'SOMETHING_NEW') });
    renderInBusiness(<ProductForm slug="example-cement" businessId={BID} />, { me: managerMe });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This already exists.');
    expect(screen.queryByText(/English developer text/)).not.toBeInTheDocument();
  });

  it('a reason rejected by the server shows under the reason field when deactivating', async () => {
    mockApi({
      ...baseRoutes,
      [`GET ${B}/products/p1`]: () => json(200, product()),
      [`PATCH ${B}/products/p1`]: () => apiError(400, 'REASON_TOO_SHORT', 'reason'),
    });
    renderInBusiness(<ProductDetail slug="example-cement" businessId={BID} id="p1" />, {
      me: ownerMe,
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Reason for the change'), 'abc');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(
      await within(dialog).findByText('The reason needs at least 3 characters.'),
    ).toBeInTheDocument();
  });
});
