import { expect, test, type Browser, type Page } from '@playwright/test';

/** Test-only accounts of e2e/mock-api.mjs (no real passwords). */
const ACCOUNTS = {
  owner: ['owner@example.com', 'e2e-owner-pass'],
} as const;

async function as(browser: Browser, who: keyof typeof ACCOUNTS, next: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3000' }]);
  const page = await context.newPage();
  const [email, password] = ACCOUNTS[who];
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email or phone').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === next.split('?')[0]);
  return page;
}

// The sidebar's "Reports" entry is gated by `reports.finance.view` (a separate, owner/finance-only
// nav stub for a future profit report — see docs/API.md and DECISIONS.md), so these pages
// are reached directly by URL here, same as a manager or accountant holding only `report.view`
// would reach them in production.

test('owner opens the sales report and switches groupBy', async ({ browser }) => {
  const owner = await as(browser, 'owner', '/b/example-cement/reports/sales');
  await expect(owner.getByRole('heading', { name: 'Sales report' })).toBeVisible();
  const groupBy = owner.getByLabel('Group by');
  await expect(groupBy).toHaveValue('date');
  await groupBy.selectOption('customer');
  await expect(owner).toHaveURL(/groupBy=customer/);
  await expect(groupBy).toHaveValue('customer');
});

test('owner sees the dues report with the three aging columns', async ({ browser }) => {
  const owner = await as(browser, 'owner', '/b/example-cement/reports/dues');
  await expect(owner.getByRole('heading', { name: 'Dues report' })).toBeVisible();
  await expect(owner.getByRole('columnheader', { name: '0-7 days' })).toBeVisible();
  await expect(owner.getByRole('columnheader', { name: '8-30 days' })).toBeVisible();
  await expect(owner.getByRole('columnheader', { name: '30+ days' })).toBeVisible();
  // Seeded customers: C-00001 owes, C-00002 is in advance (both have a non-zero balance).
  const dueRow = owner.getByRole('row', { name: /C-00001/ });
  await expect(dueRow).toBeVisible();
  const advanceRow = owner.getByRole('row', { name: /C-00002/ });
  await expect(advanceRow).toBeVisible();
});

test('owner sees every KPI card and chart panel on the dashboard', async ({ browser }) => {
  const owner = await as(browser, 'owner', '/b/example-cement');
  const main = owner.getByRole('main');
  // The two KPI rows: four monthly and four daily cards, each linking to its parent page.
  await expect(main.getByRole('heading', { name: 'This Month', level: 2 })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Today', level: 2 })).toBeVisible();
  for (const name of [
    'Total Collection: open page',
    'Total Sales: open page',
    'Sales Quantity: open page',
    'Purchase Quantity: open page',
    "Today's Collection: open page",
    "Today's Sales: open page",
    "Today's Sales Quantity: open page",
    "Today's Purchase Quantity: open page",
  ]) {
    await expect(main.getByRole('link', { name, exact: true })).toBeVisible();
  }
  // Excluded metrics must not appear anywhere as KPI cards.
  await expect(main.getByText('Total Orders')).toHaveCount(0);
  await expect(main.getByText('Total Deliveries')).toHaveCount(0);
  await expect(main.getByText('Total Customers')).toHaveCount(0);
  // No business-name heading above the KPI grid; the welcome line is the page heading.
  await expect(main.getByRole('heading', { name: 'Example Cement' })).toHaveCount(0);

  // The chart, commission, cash and financial panels.
  await expect(main.getByRole('heading', { name: 'Sales & Collection Overview' })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Commission Overview' })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Cash Position' })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Financial Summary' })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Monthly / Daily Summary' })).toBeVisible();
  // Net Profit is not shown as a number until the costing method is approved.
  await expect(main.getByText('Awaiting costing approval').first()).toBeVisible();
});

test('Bengali and dark theme: the dashboard renders without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: 'bn', url: 'http://localhost:3000' },
    { name: 'theme', value: 'dark', url: 'http://localhost:3000' },
  ]);
  const [email, password] = ACCOUNTS.owner;
  await page.goto('/login?next=%2Fb%2Fexample-cement');
  await page.getByLabel('ইমেইল বা ফোন').fill(email);
  await page.getByLabel('পাসওয়ার্ড', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'লগইন' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'এই মাস', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'আজ', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'বিক্রয় ও আদায়ের সারসংক্ষেপ' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'নগদ অবস্থান' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'আর্থিক সারসংক্ষেপ' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'মাসিক / দৈনিক সারসংক্ষেপ' })).toBeVisible();
  expect(errors).toEqual([]);
});
