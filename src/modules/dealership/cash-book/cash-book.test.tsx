import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/core/auth/types';
import { OWNER_PERMISSIONS, business, managerMe } from '../../../../test/fixtures/me';
import { json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import { B, BID, cashBook } from '../expenses/fixtures';
import { CashBookView } from './cash-book-view';

const nav = vi.hoisted(() => ({
  search: '',
  replace: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/b/example-cement/cashbook',
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

describe('<CashBookView>', () => {
  it('shows opening/closing balance, the method breakdown and day rows, all from the API', async () => {
    mockApi({ [`GET ${B}/cash-book`]: () => json(200, cashBook()) });
    const { container } = renderInBusiness(
      <CashBookView slug="example-cement" businessId={BID} />,
      { me: meWith(OWNER_PERMISSIONS) },
    );
    expect(await screen.findByText('৳12,000.00')).toBeInTheDocument(); // opening balance
    expect(screen.getAllByText('৳18,500.00').length).toBeGreaterThan(0); // closing balance
    const bankRow = screen.getByRole('row', { name: /Bank transfer/ });
    expect(bankRow).toHaveTextContent('৳3,500.00');
    const dayRow = screen.getByRole('row', { name: /17,800/ });
    expect(dayRow).toHaveTextContent('৳18,500.00');
    await expectNoA11yViolations(container);
  });

  it('changing the date range writes to the URL and resets the page', async () => {
    mockApi({ [`GET ${B}/cash-book`]: () => json(200, cashBook()) });
    renderInBusiness(<CashBookView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    await screen.findByText('৳12,000.00');
    await userEvent.type(screen.getByLabelText('From'), '2026-11-01');
    expect(nav.replace).toHaveBeenLastCalledWith('/b/example-cement/cashbook?from=2026-11-01', {
      scroll: false,
    });
  });
});
