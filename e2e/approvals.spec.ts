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

async function requestCorrection(
  page: Page,
  product: string,
  fill: (dialog: ReturnType<Page['getByRole']>) => Promise<void>,
) {
  await page.goto('/b/example-cement/products');
  await page.getByRole('link', { name: `Details of ${product}` }).click();
  await page.getByRole('button', { name: 'Request a correction' }).click();
  const dialog = page.getByRole('dialog', { name: `Request a correction: ${product}` });
  await fill(dialog);
  await dialog.getByLabel('Reason for the request').fill('e2e: supplier says so');
  await dialog.getByRole('button', { name: 'Review' }).click();
  await expect(dialog.getByText('Effect if approved')).toBeVisible();
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(
    page.getByText('Request sent. It takes effect when the owner approves it.'),
  ).toBeVisible();
}

/** Put a product back to active (direct owner change) so other specs see the seed data. */
async function reactivate(owner: Page, product: string) {
  await owner.goto('/b/example-cement/products?active=all');
  await owner.getByRole('button', { name: `Actions for ${product}` }).click();
  await owner.getByRole('button', { name: 'Activate' }).click();
  const dialog = owner.getByRole('dialog', { name: `Activate ${product}?` });
  await dialog.getByLabel('Reason for the change').fill('e2e restore');
  await dialog.getByRole('button', { name: 'Activate' }).click();
  await expect(owner.getByText('Status saved.')).toBeVisible();
}

test('manager requests a deactivation; owner sees the badge, approves; the product changes', async ({
  browser,
}) => {
  const manager = await as(browser, 'manager', '/b/example-cement/products');
  // The manager has no direct deactivate permission, so no Deactivate button, only the request.
  await manager.getByRole('link', { name: 'Details of Sample PCC 03' }).click();
  await expect(manager.getByRole('button', { name: 'Deactivate' })).toHaveCount(0);
  await requestCorrection(manager, 'Sample PCC 03', async (dialog) => {
    await dialog.getByText('Ask to deactivate').click();
  });
  // No badge for the manager (no change.view.all).
  await expect(manager.getByRole('link', { name: /Approvals/ })).not.toContainText('pending');

  const owner = await as(browser, 'owner', '/b/example-cement');
  const nav = owner.getByRole('link', { name: /Approvals/ });
  await expect(nav).toContainText('1 pending requests');
  await nav.click();
  await expect(owner).toHaveURL(/\/approvals\/all$/);
  await owner
    .getByRole('link', { name: /Details of the request for P-0003 Sample PCC 03/ })
    .click();
  await expect(owner.getByText('e2e: supplier says so')).toBeVisible();
  await expect(owner.getByText('Product status')).toBeVisible();
  await owner.getByRole('button', { name: 'Approve' }).click();
  await owner
    .getByRole('dialog', { name: 'Approve this request?' })
    .getByRole('button', { name: 'Approve' })
    .click();
  await expect(owner.getByText('Approved; the change is now in effect.')).toBeVisible();
  await expect(nav).not.toContainText('pending');
  await owner.getByRole('link', { name: 'Open the record' }).click();
  await expect(owner.getByRole('heading', { name: 'Sample PCC 03' })).toBeVisible();
  await expect(owner.locator('main')).toContainText('Inactive');

  await manager.goto('/b/example-cement/approvals');
  await expect(manager).toHaveURL(/\/approvals\/mine$/);
  await expect(manager.getByRole('row', { name: /Sample PCC 03/ })).toContainText('Approved');
  await reactivate(owner, 'Sample PCC 03');
});

test('owner rejects with a required note; own request has no approve; stale request', async ({
  browser,
}) => {
  const manager = await as(browser, 'manager', '/b/example-cement/products');
  const askDeactivate = async (dialog: ReturnType<Page['getByRole']>) => {
    // Products have no requestable price any more: only (de)activation.
    await expect(dialog.getByText(/price/i)).toHaveCount(0);
    await dialog.getByText('Ask to deactivate').click();
  };
  await requestCorrection(manager, 'Sample PCC 05', askDeactivate);
  await requestCorrection(manager, 'Sample PCC 07', askDeactivate);

  // A second request on the same record: 409 names the pending one → direct link.
  await manager.goto('/b/example-cement/products/p5');
  await manager.getByRole('button', { name: 'Request a correction' }).click();
  const again = manager.getByRole('dialog', { name: 'Request a correction: Sample PCC 05' });
  await again.getByText('Ask to deactivate').click();
  await again.getByLabel('Reason for the request').fill('once more');
  await again.getByRole('button', { name: 'Review' }).click();
  await again.getByRole('button', { name: 'Send request' }).click();
  await expect(again.getByText('This record already has a pending request.')).toBeVisible();
  await again.getByRole('link', { name: 'See the pending request' }).click();
  await expect(manager).toHaveURL(/\/approvals\/cr\d+$/);
  await expect(manager.getByRole('heading', { name: 'P-0005 Sample PCC 05' })).toBeVisible();

  // The manager's own request: withdraw only, never approve/reject.
  await manager.goto('/b/example-cement/approvals/mine');
  await manager.getByRole('link', { name: /Details of the request for P-0005/ }).click();
  await expect(manager.getByRole('button', { name: 'Withdraw request' })).toBeVisible();
  await expect(manager.getByRole('button', { name: 'Approve' })).toHaveCount(0);

  const owner = await as(browser, 'owner', '/b/example-cement/approvals/all');
  await owner.getByLabel('Status').selectOption('pending');
  await owner.getByRole('link', { name: /Details of the request for P-0005/ }).click();
  await owner.getByRole('button', { name: 'Reject' }).click();
  const reject = owner.getByRole('dialog', { name: 'Reject this request?' });
  await reject.getByRole('button', { name: 'Reject' }).click();
  await expect(reject.getByText(/Write why it is rejected/)).toBeVisible();
  await reject.getByLabel('Note').fill('The new rate starts next month');
  await reject.getByRole('button', { name: 'Reject' }).click();
  await expect(owner.getByText('Rejected; the record was not changed.')).toBeVisible();

  // The owner changes PCC 07 directly → the pending request becomes stale.
  await owner.goto('/b/example-cement/products');
  await owner.getByRole('button', { name: 'Actions for Sample PCC 07' }).click();
  await owner.getByRole('button', { name: 'Deactivate' }).click();
  const deactivate = owner.getByRole('dialog', { name: 'Deactivate Sample PCC 07?' });
  await deactivate.getByLabel('Reason for the change').fill('direct change');
  await deactivate.getByRole('button', { name: 'Deactivate' }).click();
  await expect(owner.getByText('Status saved.')).toBeVisible();
  await owner.goto('/b/example-cement/approvals/all?status=pending');
  await owner.getByRole('link', { name: /Details of the request for P-0007/ }).click();
  await expect(owner.getByText('This request is out of date')).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(
    owner.getByRole('link', { name: 'Open the record to request again' }),
  ).toHaveAttribute('href', /\/products\/p7$/);

  await manager.goto('/b/example-cement/approvals/mine?status=rejected');
  await manager.getByRole('link', { name: /Details of the request for P-0005/ }).click();
  await expect(manager.getByText('The new rate starts next month')).toBeVisible();
  await reactivate(owner, 'Sample PCC 07');
});
