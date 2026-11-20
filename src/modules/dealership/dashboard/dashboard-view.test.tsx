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

describe('<DashboardView>', () => {
  it("shows today's four stat cards and the cash cards when the API includes them", async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () => json(200, dailySummaryResponse()),
    });
    const { container } = renderInBusiness(
      <DashboardView slug="example-cement" businessId={BID} />,
      { me: meWith(OWNER_PERMISSIONS) },
    );
    expect(await screen.findByText('৳48,000.00')).toBeInTheDocument(); // orders amount
    expect(screen.getByText('৳36,000.00')).toBeInTheDocument(); // deliveries amount
    expect(screen.getByText('৳12,000.00')).toBeInTheDocument(); // cash opening balance
    expect(screen.getByText('৳18,500.00')).toBeInTheDocument(); // cash closing balance
    await expectNoA11yViolations(container);
  });

  it('shows no cash cards when the API omits `cash` (no cashbook.view)', async () => {
    mockApi({
      [`GET ${B}/reports/daily-summary`]: () =>
        json(200, dailySummaryResponse({ cash: undefined })),
    });
    renderInBusiness(<DashboardView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    expect(await screen.findByText('৳48,000.00')).toBeInTheDocument();
    expect(screen.queryByText('৳12,000.00')).not.toBeInTheDocument();
  });
});
