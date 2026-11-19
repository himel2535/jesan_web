import { expect, test, type Browser, type Page } from '@playwright/test';

/** Test-only accounts of e2e/mock-api.mjs (no real passwords). */
const ACCOUNTS = {
  owner: ['owner@example.com', 'e2e-owner-pass'],
  manager: ['manager@example.com', 'e2e-manager-pass'],
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

async function stockOf(page: Page, product: string) {
  await page.goto(`/b/example-cement/stock?search=${encodeURIComponent(product)}`);
  return page.getByRole('row', { name: new RegExp(product) });
}

test('purchase raises stock; manager asks to void; owner approves; stock goes back down', async ({
  browser,
}) => {
  const manager = await as(browser, 'manager', '/b/example-cement/purchases');
  await manager.getByRole('link', { name: 'New purchase' }).click();
  await manager.getByRole('searchbox', { name: 'Add a product' }).fill('PCC 09');
  await manager.getByRole('button', { name: /P-0009 Sample PCC 09/ }).click();
  await manager.getByLabel('Quantity (Bag)').fill('100');
  await manager.getByLabel('Unit price').fill('520');
  await expect(manager.getByText('৳52,000.00').first()).toBeVisible();
  await manager.getByLabel('Paper number').fill('CH-E2E');
  await manager.getByRole('button', { name: 'Save purchase' }).click();
  await expect(manager.getByRole('heading', { name: /Purchase PUR-\d+/ })).toBeVisible();
  await expect(manager.getByText('Purchase saved.')).toBeVisible();
  const code = (await manager.getByRole('heading', { name: /Purchase PUR-\d+/ }).textContent())!
    .replace('Purchase ', '')
    .trim();

  await expect(await stockOf(manager, 'Sample PCC 09')).toContainText('100 Bag');

  // The manager cannot void directly: request it (preview first).
  await manager.goto('/b/example-cement/purchases');
  await manager.getByRole('link', { name: `Details of ${code}` }).click();
  await expect(manager.getByRole('button', { name: 'Void purchase' })).toHaveCount(0);
  await manager.getByRole('button', { name: 'Request a correction' }).click();
  const dialog = manager.getByRole('dialog', { name: `Request a correction: ${code}` });
  await dialog.getByLabel('Void this record').check();
  await dialog.getByLabel('Reason for the request').fill('e2e: entered by mistake');
  await dialog.getByRole('button', { name: 'Review' }).click();
  await expect(dialog.getByText('Stock P-0009')).toBeVisible();
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(
    manager.getByText('Request sent. It takes effect when the owner approves it.'),
  ).toBeVisible();

  const owner = await as(browser, 'owner', '/b/example-cement');
  const nav = owner.getByRole('link', { name: /Approvals/ });
  await expect(nav).toContainText('pending requests');
  await owner.goto('/b/example-cement/approvals/all?entityType=purchase&status=pending');
  await owner.getByRole('link', { name: `Details of the request for ${code}` }).click();
  await expect(owner.getByText('Asks to void this record.')).toBeVisible();
  await expect(owner.getByText('100 → 0')).toBeVisible();
  await owner.getByRole('button', { name: 'Approve' }).click();
  await owner
    .getByRole('dialog', { name: 'Approve this request?' })
    .getByRole('button', { name: 'Approve' })
    .click();
  await expect(owner.getByText('Approved; the change is now in effect.')).toBeVisible();
  await owner.getByRole('link', { name: 'Open the record' }).click();
  await expect(owner.getByText('This purchase is void')).toBeVisible();

  await expect(await stockOf(owner, 'Sample PCC 09')).toContainText('0 Bag');
  await owner.getByRole('link', { name: 'Stock history of Sample PCC 09' }).click();
  await expect(owner.getByRole('row', { name: /Purchase void/ })).toContainText('-100');
  await expect(owner.getByRole('link', { name: code }).first()).toBeVisible();
});

test('adjustment above the daily limit goes to the owner as a request', async ({ browser }) => {
  const manager = await as(browser, 'manager', '/b/example-cement/stock');
  await manager.goto('/b/example-cement/stock?search=PCC%2011');
  await manager.getByRole('button', { name: 'Adjust stock of Sample PCC 11' }).click();
  const dialog = manager.getByRole('dialog', { name: 'Adjust stock: Sample PCC 11' });
  await dialog.getByLabel('Change (with sign)').fill('30');
  await dialog.getByLabel('Reason').fill('e2e: bags found in the store');
  await dialog.getByRole('button', { name: 'Save adjustment' }).click();
  await expect(dialog.getByText(/above your daily limit of 10/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Send for approval' }).click();
  const request = manager.getByRole('dialog', { name: 'Request a correction: Sample PCC 11' });
  await request.getByRole('button', { name: 'Review' }).click();
  await expect(request.getByText('0 → 30')).toBeVisible();
  await request.getByRole('button', { name: 'Send request' }).click();
  await expect(
    manager.getByText('Request sent. It takes effect when the owner approves it.'),
  ).toBeVisible();

  const owner = await as(browser, 'owner', '/b/example-cement/approvals/all');
  await owner.getByLabel('Record type').selectOption('product_stock');
  await owner.getByRole('link', { name: /Details of the request for P-0011/ }).click();
  await owner.getByRole('button', { name: 'Approve' }).click();
  await owner
    .getByRole('dialog', { name: 'Approve this request?' })
    .getByRole('button', { name: 'Approve' })
    .click();
  await expect(owner.getByText('Approved; the change is now in effect.')).toBeVisible();
  await expect(await stockOf(owner, 'Sample PCC 11')).toContainText('30 Bag');
});

test('Bengali and dark theme: purchase and stock pages render without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: 'bn', url: 'http://localhost:3000' },
    { name: 'theme', value: 'dark', url: 'http://localhost:3000' },
  ]);
  const [email, password] = ACCOUNTS.manager;
  await page.goto('/login?next=%2Fb%2Fexample-cement%2Fstock');
  await page.getByLabel('ইমেইল বা ফোন').fill(email);
  await page.getByLabel('পাসওয়ার্ড', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'লগইন' }).click();
  await expect(page.getByRole('heading', { name: 'স্টক' })).toBeVisible();
  await page.goto('/b/example-cement/purchases');
  await expect(page.getByRole('heading', { name: 'কেনা' })).toBeVisible();
  await page.goto('/b/example-cement/purchases/new');
  await expect(page.getByRole('heading', { name: 'নতুন কেনা' })).toBeVisible();
  expect(errors).toEqual([]);
});
