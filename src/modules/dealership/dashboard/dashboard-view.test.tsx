import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Me } from '@/core/auth/types';
import { OWNER_PERMISSIONS, business, managerMe } from '../../../../test/fixtures/me';
import { json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import { BID, dailySummaryResponse } from '../reports/fixtures';
import { DashboardView } from './dashboard-view';

const B = '/b/example-cement';

const meWith = (permissions: string[]): Me => ({
  ...managerMe,
  businesses: [business({ permissions })],
});

/**
 * Mock endpoints every dashboard panel needs: KPI cards, Revenue Overview, Top 5, Sales Summary,
 * Target & Commission Progress, Stock Overview, Sales & Delivery Overview, Recent Transactions.
 */
const dashboardRoutes = () =>
  Object.fromEntries([
    [
      `GET ${B}/accounts/summary`,
      () =>
        json(200, { totalDue: '500', totalAdvance: '9300', totalIn: '0', totalOut: '0', net: '0' }),
    ],
    [
      `GET ${B}/reports/sales`,
      () =>
        json(200, {
          totalAmount: '36000',
          totalQuantity: '0',
          items: [],
          page: 1,
          pageSize: 10,
          total: 0,
        }),
    ],
    [
      `GET ${B}/reports/collections`,
      () => json(200, { totalAmount: '0', items: [], page: 1, pageSize: 10, total: 0 }),
    ],
    [
      `GET ${B}/reports/expenses`,
      () => json(200, { totalAmount: '0', items: [], page: 1, pageSize: 10, total: 0 }),
    ],
    [
      `GET ${B}/purchases/summary`,
      () => json(200, { totalAmount: '0', totalQuantity: '0', count: 0 }),
    ],
    [
      `GET ${B}/commission-summary`,
      () => json(200, { totalCalculated: '0', totalReceived: '0', totalPending: '0' }),
    ],
    [
      `GET ${B}/commission-scheme`,
      () =>
        json(200, {
          scheme: {
            rateBase: '10.00',
            targetQty: '10000',
            bonusRate: '1.00',
            updatedAt: '2026-11-01T00:00:00Z',
          },
        }),
    ],
    [
      `GET ${B}/purchase-counters`,
      () =>
        json(200, {
          year: 2026,
          months: Array.from({ length: 12 }, (_, i) => ({
            month: `2026-${String(i + 1).padStart(2, '0')}`,
            quantity: '0',
          })),
        }),
    ],
    [
      `GET ${B}/product-categories`,
      () =>
        json(200, {
          items: [
            {
              id: 'cat-opc',
              nameEn: 'OPC',
              nameBn: 'ওপিসি',
              sortOrder: 1,
              isActive: true,
              createdAt: '',
              updatedAt: '',
            },
            {
              id: 'cat-pcc',
              nameEn: 'PCC',
              nameBn: 'পিসিসি',
              sortOrder: 2,
              isActive: true,
              createdAt: '',
              updatedAt: '',
            },
          ],
        }),
    ],
    [`GET ${B}/stock`, () => json(200, { items: [], page: 1, pageSize: 10, total: 0 })],
    [`GET ${B}/accounts/ledger`, () => json(200, { items: [], page: 1, pageSize: 10, total: 0 })],
    [`GET ${B}/orders`, () => json(200, { items: [], page: 1, pageSize: 10, total: 0 })],
    [`GET ${B}/deliveries`, () => json(200, { items: [], page: 1, pageSize: 10, total: 0 })],
    [
      `GET ${B}/product-units`,
      () =>
        json(200, {
          defaultUnitKey: 'bag',
          items: [{ key: 'bag', nameEn: 'Bag', nameBn: 'বস্তা', decimals: 0 }],
        }),
    ],
  ]);

describe('<DashboardView>', () => {
  it('shows the Cash & Bank KPI card when cashbook.view is granted', async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () => json(200, dailySummaryResponse()),
      ...dashboardRoutes(),
    });
    const { container } = renderInBusiness(
      <DashboardView slug="example-cement" businessId={BID} />,
      { me: meWith(['cashbook.view', 'report.view']) },
    );
    expect(await screen.findByText('৳18,500.00')).toBeInTheDocument(); // closing balance
    expect(screen.getByText('Cash & Bank')).toBeInTheDocument(); // KPI card label

    await expectNoA11yViolations(container);
  });

  it('hides the Cash & Bank KPI card when cashbook.view is not granted', async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () =>
        json(200, dailySummaryResponse({ cash: undefined })),
      ...dashboardRoutes(),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(['report.view']),
    });
    await screen.findByText('Total Sales'); // KPI card renders
    expect(screen.queryByText('Cash & Bank')).not.toBeInTheDocument();
  });

  it('shows KPI cards and chart panels for all accessible metrics', async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () => json(200, dailySummaryResponse()),
      ...dashboardRoutes(),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    expect(await screen.findByText('Total Sales')).toBeInTheDocument();
    expect(screen.getByText('Total Purchase')).toBeInTheDocument();
    expect(screen.getByText('Total Collection')).toBeInTheDocument();
    expect(screen.getByText('Customer Due')).toBeInTheDocument();
    expect(await screen.findByText('Cash & Bank')).toBeInTheDocument();
    expect(screen.getByText('Commission')).toBeInTheDocument();
    expect(screen.getByText('Net Profit')).toBeInTheDocument();
    expect(screen.getByText('Revenue Overview')).toBeInTheDocument();
    expect(screen.getByText('Top 5 Customers')).toBeInTheDocument();
    expect(screen.getByText('Sales Summary')).toBeInTheDocument();
    expect(await screen.findByText('Commission Target')).toBeInTheDocument();
    expect(screen.getByText('Target & Commission Progress')).toBeInTheDocument();
    expect(screen.getByText('Stock Overview')).toBeInTheDocument();
    expect(screen.getByText('Sales & Delivery Overview')).toBeInTheDocument();
    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
  });

  it('hides owner-only panels (Commission Target card and Target & Commission Progress) without commission.view', async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () => json(200, dailySummaryResponse()),
      ...dashboardRoutes(),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(['report.view', 'sale.view.all', 'stock.view', 'ledger.view']),
    });
    await screen.findByText('Total Sales');
    expect(screen.queryByText('Commission Target')).not.toBeInTheDocument();
    expect(screen.queryByText('Target & Commission Progress')).not.toBeInTheDocument();
  });

  it('shows Stock Overview and Sales & Delivery Overview only with their permissions', async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () => json(200, dailySummaryResponse()),
      ...dashboardRoutes(),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(['report.view']),
    });
    await screen.findByText('Total Sales');
    expect(screen.queryByText('Stock Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Sales & Delivery Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent Transactions')).not.toBeInTheDocument();
  });

  it("computes Commission Target Progress from the scheme and this month's purchased bags", async () => {
    const currentMonth = '2026-11';
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () => json(200, dailySummaryResponse()),
      ...dashboardRoutes(),
      [`GET ${B}/purchase-counters`]: () =>
        json(200, {
          year: 2026,
          months: Array.from({ length: 12 }, (_, i) => ({
            month: `2026-${String(i + 1).padStart(2, '0')}`,
            quantity: `2026-${String(i + 1).padStart(2, '0')}` === currentMonth ? '4000' : '0',
          })),
        }),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    // targetQty 10000, achieved 4000 -> 40%
    expect(await screen.findByText('40%')).toBeInTheDocument();
  });

  it('shows "Target not configured" when no commission scheme exists', async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () => json(200, dailySummaryResponse()),
      ...dashboardRoutes(),
      [`GET ${B}/commission-scheme`]: () => json(200, { scheme: null }),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    expect(await screen.findByText('Not configured')).toBeInTheDocument();
    expect(screen.getByText('Target not configured')).toBeInTheDocument();
  });

  it('shows every active product dynamically in Stock Overview, grouped by unit, never by a hardcoded OPC/PCC category name', async () => {
    const row = (id: string, nameEn: string, stock: string, categoryNameEn: string) => ({
      id,
      code: id,
      nameEn,
      nameBn: nameEn,
      unitKey: 'bag',
      category: { id: `cat-${id}`, nameEn: categoryNameEn, nameBn: categoryNameEn },
      currentStock: stock,
      isActive: true,
    });
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () => json(200, dailySummaryResponse()),
      ...dashboardRoutes(),
      [`GET ${B}/stock`]: () =>
        json(200, {
          items: [
            // Real-world category names don't exactly equal "OPC"/"PCC" (e.g. "OPC / CEM-I") —
            // the dashboard must still total these correctly without any category-name matching.
            row('p1', 'OPC (Portland Cement) / CEM-I', '20005', 'OPC / CEM-I'),
            row('p2', 'PCC CEM-II/A-M', '40', 'PCC'),
            row('p3', 'PCC CEM-II/B-M', '0', 'PCC'),
          ],
          page: 1,
          pageSize: 10,
          total: 3,
        }),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    expect(await screen.findByText('OPC (Portland Cement) / CEM-I')).toBeInTheDocument();
    expect(screen.getByText('PCC CEM-II/A-M')).toBeInTheDocument();
    expect(screen.getByText('PCC CEM-II/B-M')).toBeInTheDocument();
    expect(screen.getByText('20,045 Bag')).toBeInTheDocument(); // 20,005 + 40 + 0, single unit group
  });

  it('shows an uncapped achievement percentage and an exceeded badge when purchases pass the commission target', async () => {
    const currentMonth = '2026-11';
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () => json(200, dailySummaryResponse()),
      ...dashboardRoutes(),
      [`GET ${B}/purchase-counters`]: () =>
        json(200, {
          year: 2026,
          months: Array.from({ length: 12 }, (_, i) => ({
            month: `2026-${String(i + 1).padStart(2, '0')}`,
            quantity: `2026-${String(i + 1).padStart(2, '0')}` === currentMonth ? '11000' : '0',
          })),
        }),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    // targetQty 10000, achieved 11000 -> 110%, never capped at 100
    expect(await screen.findByText('110%')).toBeInTheDocument();
    expect(screen.getByText('Target exceeded')).toBeInTheDocument();
  });
});
