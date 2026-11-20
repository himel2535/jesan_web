import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/core/auth/types';
import { formatDate } from '@/core/i18n/format';
import { OWNER_PERMISSIONS, business, managerMe } from '../../../../test/fixtures/me';
import { json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import { CollectionsReport } from './collections-report';
import { DuesReport } from './dues-report';
import { SalesReport } from './sales-report';
import { B, BID, duesReportResponse, salesReportResponse } from './fixtures';

const nav = vi.hoisted(() => ({
  search: '',
  replace: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/b/example-cement/reports/sales',
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace }),
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

describe('<SalesReport>', () => {
  it('shows the day groups localized (not the raw API date), with totals and pagination', async () => {
    mockApi({
      [`GET ${B}/reports/sales`]: () => json(200, salesReportResponse({ total: 25 })),
    });
    const { container } = renderInBusiness(<SalesReport slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    const localizedDay = formatDate('2026-11-19T00:00:00+06:00', 'en');
    expect(await screen.findByText(localizedDay)).toBeInTheDocument();
    expect(screen.queryByText('2026-11-19')).not.toBeInTheDocument();
    expect(screen.getByText('৳1,20,000.00')).toBeInTheDocument(); // totalAmount footer
    expect(screen.getByRole('link', { name: 'Page 2' })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('switching groupBy writes to the URL and resets the page', async () => {
    nav.search = 'page=2';
    mockApi({ [`GET ${B}/reports/sales`]: () => json(200, salesReportResponse()) });
    renderInBusiness(<SalesReport slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    await screen.findByText('৳1,20,000.00');
    await userEvent.selectOptions(screen.getByLabelText('Group by'), 'customer');
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/b/example-cement/reports/sales?groupBy=customer',
      { scroll: false },
    );
  });

  it('changing the date range writes to the URL', async () => {
    mockApi({ [`GET ${B}/reports/sales`]: () => json(200, salesReportResponse()) });
    renderInBusiness(<SalesReport slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    await screen.findByText('৳1,20,000.00');
    await userEvent.type(screen.getByLabelText('From'), '2026-11-01');
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/b/example-cement/reports/sales?from=2026-11-01',
      { scroll: false },
    );
  });
});

describe('<CollectionsReport>', () => {
  it('method groupBy labels the API-provided key through useMethodLabel, not a hardcoded name', async () => {
    mockApi({
      [`GET ${B}/reports/collections`]: () =>
        json(200, {
          from: '2026-11-01',
          to: '2026-11-19',
          groupBy: 'method',
          items: [{ key: 'bkash', count: 2, amount: '1000.00' }],
          totalAmount: '1000.00',
          page: 1,
          pageSize: 10,
          total: 1,
        }),
    });
    nav.search = 'groupBy=method';
    renderInBusiness(<CollectionsReport slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    // The raw key never reaches the page; useMethodLabel resolves it (`dealership.sales.collections`).
    expect(await screen.findByText('bKash')).toBeInTheDocument();
    expect(screen.queryByText('bkash')).not.toBeInTheDocument();
  });
});

describe('<DuesReport>', () => {
  it('shows the three aging buckets and the due/advance totals', async () => {
    mockApi({ [`GET ${B}/reports/dues`]: () => json(200, duesReportResponse()) });
    const { container } = renderInBusiness(<DuesReport slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    const row = await screen.findByRole('row', { name: /City Hardware/ });
    expect(row).toHaveTextContent('৳4,000.00');
    expect(row).toHaveTextContent('৳3,000.00');
    expect(row).toHaveTextContent('৳2,000.00');
    const totalRow = screen.getByRole('row', { name: /Total/ });
    expect(totalRow).toHaveTextContent('৳9,000.00'); // totalDue
    expect(totalRow).toHaveTextContent('৳1,500.00'); // totalAdvance
    await expectNoA11yViolations(container);
  });
});
