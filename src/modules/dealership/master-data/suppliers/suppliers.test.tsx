import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { managerMe } from '../../../../../test/fixtures/me';
import { json, mockApi, renderInBusiness } from '../../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../../test/utils';
import { SupplierDetail, SuppliersList } from './suppliers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/b/example-cement/suppliers',
  useSearchParams: () => new URLSearchParams(),
}));
afterEach(() => vi.unstubAllGlobals());

const B = '/b/example-cement';
const supplier = {
  id: 's1',
  code: 'S-001',
  nameEn: 'Example Supplier',
  nameBn: 'উদাহরণ সরবরাহকারী',
  phone: null,
  address: null,
  isPrincipal: true,
  isActive: true,
};

describe('suppliers (view only)', () => {
  it('lists with the principal badge, no search box, no add button', async () => {
    const { calls } = mockApi({
      [`GET ${B}/suppliers`]: () =>
        json(200, { items: [supplier], page: 1, pageSize: 10, total: 1 }),
    });
    const { container } = renderInBusiness(
      <SuppliersList slug="example-cement" businessId="b1" />,
      { me: managerMe },
    );
    expect(await screen.findByRole('link', { name: /^Example Supplier/ })).toHaveAttribute(
      'href',
      `${B}/suppliers/s1`,
    );
    expect(screen.getByRole('link', { name: 'Details of Example Supplier' })).toHaveAttribute(
      'href',
      `${B}/suppliers/s1`,
    );
    expect(screen.getByText('Principal supplier')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /New/ })).not.toBeInTheDocument();
    expect(calls[0]!.url).toBe('/api/v1/b/example-cement/suppliers?page=1');
    await expectNoA11yViolations(container);
  });

  it('detail page in Bengali', async () => {
    mockApi({ [`GET ${B}/suppliers/s1`]: () => json(200, supplier) });
    renderInBusiness(<SupplierDetail slug="example-cement" businessId="b1" id="s1" />, {
      me: managerMe,
      locale: 'bn',
    });
    expect(await screen.findByRole('heading', { name: 'উদাহরণ সরবরাহকারী' })).toBeInTheDocument();
    expect(screen.getByText('প্রধান সরবরাহকারী')).toBeInTheDocument();
  });

  it('404 → not found message, no retry', async () => {
    mockApi({});
    renderInBusiness(<SupplierDetail slug="example-cement" businessId="b1" id="nope" />, {
      me: managerMe,
    });
    expect(await screen.findByText(/was not found/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});
