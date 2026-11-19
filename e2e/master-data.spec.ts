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

test('manager sees last purchase prices; salesman never does (column, cells, detail)', async ({
  page,
  browser,
}) => {
  await signIn(page, 'manager', '/b/example-cement/products');
  await expect(page.getByRole('columnheader', { name: 'Last purchase price' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Sample PCC 01/ })).toContainText('৳501.00');
  // Not purchased yet → a dash, no amount.
  await expect(page.getByRole('row', { name: /Sample PCC 07/ })).toContainText('—');

  const salesman = await browser.newPage();
  await salesman
    .context()
    .addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3000' }]);
  await signIn(salesman, 'salesman', '/b/example-cement/products');
  await expect(salesman.getByRole('rowheader', { name: /Sample PCC 01/ })).toBeVisible();
  await expect(salesman.getByRole('columnheader', { name: 'Last purchase price' })).toHaveCount(0);
  await expect(salesman.locator('main')).not.toContainText('Last purchase price');
  await expect(salesman.locator('main')).not.toContainText('৳501.00');
  await salesman.getByRole('link', { name: 'Sample PCC 01', exact: true }).click();
  await expect(salesman.getByRole('heading', { name: 'Sample PCC 01' })).toBeVisible();
  await expect(salesman.locator('main')).not.toContainText('Last purchase price');
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
  // The balance is always opening + delivered − collected (docs/API.md §11), so it is the
  // opening balance until something is delivered or collected.
  await expect(page.getByRole('row', { name: /Sample Store One/ })).toContainText('৳12,500.00');
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
  const link = page.getByRole('link', { name: 'Sample OPC 02', exact: true });
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
  await expect(page.getByRole('row', { name: /নমুনা স্টোর এক/ })).toContainText('৳১২,৫০০.০০');
  await expect(page.getByRole('row', { name: /Advance Shop/ })).toContainText('অগ্রিম');
  await page.goto('/b/example-cement/suppliers');
  await expect(page.getByText('প্রধান সরবরাহকারী')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Details button opens the record; owner deactivates from the Actions menu with a reason', async ({
  page,
}) => {
  await signIn(page, 'owner', '/b/example-cement/products');
  await page.getByRole('link', { name: 'Details of Sample OPC 02' }).click();
  await expect(page.getByRole('heading', { name: 'Sample OPC 02' })).toBeVisible();
  await page.goBack();

  await page.getByRole('button', { name: 'Actions for Sample OPC 02' }).click();
  await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
  await expect(page.getByText('Delete', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deactivate' }).click();
  const dialog = page.getByRole('dialog', { name: 'Deactivate Sample OPC 02?' });
  await dialog.getByRole('button', { name: 'Deactivate' }).click();
  await expect(dialog.getByText(/at least 3 characters/)).toBeVisible();
  await dialog.getByLabel('Reason for the change').fill('e2e check');
  await dialog.getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByText('Status saved.')).toBeVisible();
  // Active-only list: the row is gone; nothing else was reloaded by hand.
  await expect(page.getByRole('rowheader', { name: /Sample OPC 02/ })).toHaveCount(0);

  // Put it back so the other tests see the same data.
  await page.getByLabel('Status').selectOption('all');
  await page.getByRole('button', { name: 'Actions for Sample OPC 02' }).click();
  await page.getByRole('button', { name: 'Activate' }).click();
  const again = page.getByRole('dialog', { name: 'Activate Sample OPC 02?' });
  await again.getByLabel('Reason for the change').fill('e2e restore');
  await again.getByRole('button', { name: 'Activate' }).click();
  await expect(page.getByText('Status saved.')).toBeVisible();
});

test('category detail page links to its products', async ({ page }) => {
  await signIn(page, 'manager', '/b/example-cement/products/categories');
  await page.getByRole('link', { name: 'Details of OPC' }).click();
  await expect(page.getByRole('heading', { name: 'OPC', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Products in this category' }).click();
  await expect(page).toHaveURL(/category=c1/);
  await expect(page.getByRole('rowheader', { name: /Sample PCC/ })).toHaveCount(0);
});

test('new product without any price; a duplicate name is shown under the name field', async ({
  page,
}) => {
  await signIn(page, 'manager', '/b/example-cement/products/new');
  // Prices come only from purchases: no price field on the form.
  await expect(page.getByLabel(/price/i)).toHaveCount(0);
  await page.getByLabel('Category').selectOption({ label: 'OPC' });
  await page.getByLabel('Name (English)').fill('sample opc 02');
  await page.getByLabel('Name (Bangla)').fill('নমুনা ডুপ্লিকেট');
  await page.getByRole('button', { name: 'Create' }).click();
  // NAME_EN_DUPLICATE (code + field) from the API → under the field, not the English text.
  await expect(page.getByLabel('Name (English)')).toHaveAccessibleDescription(
    'This English name is already used in this business.',
  );

  await page.getByLabel('Name (English)').fill('Sample OPC 40kg');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Sample OPC 40kg' })).toBeVisible();
  await expect(page.locator('main')).toContainText('Not purchased yet');
});

test('platform owner adds an existing user from another business', async ({ page }) => {
  await signIn(page, 'owner', '/b/example-cement/settings/users');
  await page.getByRole('button', { name: 'Add existing user' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add an existing user' });
  await dialog.getByLabel('Email or phone').fill('nobody@example.com');
  await dialog.getByRole('button', { name: 'Search' }).click();
  await expect(dialog.getByLabel('Email or phone')).toHaveAccessibleDescription(
    /No user with this email or phone was found/,
  );

  await dialog.getByLabel('Email or phone').fill('manager@example.com');
  await dialog.getByRole('button', { name: 'Search' }).click();
  await expect(dialog.getByText('Already in this business, as Manager.')).toBeVisible();

  await dialog.getByLabel('Email or phone').fill('01700000004');
  await dialog.getByRole('button', { name: 'Search' }).click();
  await expect(dialog.getByText('Example Accountant')).toBeVisible();
  await dialog.getByLabel('Role').selectOption('accountant');
  await dialog.getByRole('button', { name: 'Add to this business' }).click();
  await expect(page.getByText('Example Accountant was added as Accountant.')).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Example Accountant' })).toBeVisible();
});
