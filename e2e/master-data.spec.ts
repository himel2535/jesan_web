import { expect, test, type Page } from '@playwright/test';

/** Test-only accounts of e2e/mock-api.mjs (no real passwords). */
const ACCOUNTS = {
  owner: ['owner@example.com', 'e2e-owner-pass'],
  manager: ['manager@example.com', 'e2e-manager-pass'],
  salesman: ['salesman@example.com', 'e2e-salesman-pass'],
} as const;

async function signIn(page: Page, who: keyof typeof ACCOUNTS, next = '/') {
  const [email, password] = ACCOUNTS[who];
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email or phone').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === next.split('?')[0]);
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3000' }]);
});

test('manager sees purchase prices; salesman never does (column, cells, detail)', async ({
  page,
  browser,
}) => {
  await signIn(page, 'manager', '/b/example-cement/products');
  await expect(page.getByRole('columnheader', { name: 'Purchase price' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Sample PCC 01/ })).toContainText('৳501.00');

  const salesman = await browser.newPage();
  await salesman
    .context()
    .addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3000' }]);
  await signIn(salesman, 'salesman', '/b/example-cement/products');
  await expect(salesman.getByRole('rowheader', { name: /Sample PCC 01/ })).toBeVisible();
  await expect(salesman.getByRole('columnheader', { name: 'Purchase price' })).toHaveCount(0);
  await expect(salesman.locator('main')).not.toContainText('Purchase price');
  await expect(salesman.locator('main')).not.toContainText('৳501.00');
  await salesman.getByRole('link', { name: 'Sample PCC 01' }).click();
  await expect(salesman.getByRole('heading', { name: 'Sample PCC 01' })).toBeVisible();
  await expect(salesman.locator('main')).not.toContainText('Purchase price');
});

test('search (debounced, in the URL) and paging', async ({ page }) => {
  await signIn(page, 'manager', '/b/example-cement/products');
  await expect(page.getByText('Showing 1–10 of 12')).toBeVisible();
  await page.getByRole('link', { name: 'Page 2' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText('Showing 11–12 of 12')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search' }).fill('P-0003');
  await expect(page).toHaveURL(/search=P-0003/);
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page.getByRole('rowheader')).toHaveCount(1);
  await expect(page.getByRole('rowheader', { name: /Sample PCC 03/ })).toBeVisible();
});

test('customers: due hidden from salesman; duplicate phone message on create', async ({
  page,
  browser,
}) => {
  await signIn(page, 'manager', '/b/example-cement/customers');
  await expect(page.getByRole('row', { name: /Sample Store One/ })).toContainText('৳12,50,000.00');
  await expect(page.getByRole('row', { name: /Advance Shop/ })).toContainText('Advance');

  const salesman = await browser.newPage();
  await salesman
    .context()
    .addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3000' }]);
  await signIn(salesman, 'salesman', '/b/example-cement/customers');
  await expect(salesman.getByRole('rowheader', { name: /Sample Store One/ })).toBeVisible();
  await expect(salesman.getByRole('columnheader', { name: 'Current due' })).toHaveCount(0);
  await expect(salesman.locator('main')).not.toContainText('৳');

  await salesman.getByRole('link', { name: 'New customer' }).click();
  await expect(salesman.getByLabel('Opening due')).toHaveCount(0);
  await salesman.getByLabel('Name (English)').fill('Copy Store');
  await salesman.getByLabel('Phone').fill('01000000001');
  await salesman.getByRole('button', { name: 'Create' }).click();
  await expect(
    salesman.getByText('A customer with this phone number already exists.'),
  ).toBeVisible();
  await expect(salesman.getByLabel('Phone')).toHaveAttribute('aria-invalid', 'true');
});

test('keyboard only: reach search, type, open a product', async ({ page }) => {
  await signIn(page, 'manager', '/b/example-cement/products');
  const search = page.getByRole('searchbox', { name: 'Search' });
  await search.focus();
  await page.keyboard.type('Sample OPC 02');
  await expect(page).toHaveURL(/search=Sample/);
  const link = page.getByRole('link', { name: 'Sample OPC 02' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Sample OPC 02' })).toBeVisible();
});

test('Bengali and dark theme render the same data without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: 'bn', url: 'http://localhost:3000' },
    { name: 'theme', value: 'dark', url: 'http://localhost:3000' },
  ]);
  const [email, password] = ACCOUNTS.manager;
  await page.goto('/login?next=%2Fb%2Fexample-cement%2Fcustomers');
  await page.getByLabel('ইমেইল বা ফোন').fill(email);
  await page.getByLabel('পাসওয়ার্ড', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'লগইন' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'গ্রাহক' })).toBeVisible();
  await expect(page.getByRole('row', { name: /নমুনা স্টোর এক/ })).toContainText('৳১২,৫০,০০০.০০');
  await expect(page.getByRole('row', { name: /Advance Shop/ })).toContainText('অগ্রিম');
  await page.goto('/b/example-cement/suppliers');
  await expect(page.getByText('প্রধান সরবরাহকারী')).toBeVisible();
  expect(errors).toEqual([]);
});
