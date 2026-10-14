import { expect, request as pwRequest, test } from '@playwright/test';

/**
 * Phase 05 UI flow: marketplace product link -> Buyer sign-in -> pick SKU -> cart -> checkout -> fake payment ->
 * Seller sees the order -> Test Console refuses an invalid jump and releases the hold.
 * Requires a seeded stack; resets the demo data at the start so the run is repeatable.
 */
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ baseURL }) => {
  const api = await pwRequest.newContext({ baseURL });
  await api.post('/test-admin/seed');
  // clear previous orders of earlier runs so counts are deterministic
  const prep = await (await api.post('/test-admin/reset/prepare', { data: { scope: 'ALL' } })).json();
  await api.post('/test-admin/reset', { data: { scope: 'ALL', confirmationToken: prep.confirmationToken } });
  await api.post('/test-admin/seed');
  await api.dispose();
});

let orderId = '';

async function signInAs(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Sign in' }).click();
}

test('a marketplace product link opens the right product for a buyer and the SKU picker selects the variant', async ({ page }) => {
  await page.goto('/buyer/product/sim-product-a-tee');
  await signInAs(page, 'Trần Văn An');
  await expect(page.getByRole('heading', { name: 'Shopping at Cửa hàng Mộc Lan (demo)' })).toBeVisible();
  const detail = page.getByLabel('product detail');
  await expect(detail.getByRole('heading', { name: 'Áo thun cotton basic' })).toBeVisible();
  await detail.getByRole('radio', { name: 'Đen / M' }).click();
  await expect(detail.getByText(/Selected: .*Đen \/ M.*135\.000/)).toBeVisible();
  await expect(detail.getByRole('radio', { name: 'Đen / M' })).toHaveAttribute('aria-checked', 'true');
  await expect(detail.getByRole('radio', { name: 'Trắng / M' })).toHaveAttribute('aria-checked', 'false');
});

test('buyer adds two units to the cart, checks out and pays with the fake payment', async ({ page }) => {
  await page.goto('/buyer/product/sim-product-a-tee');
  await signInAs(page, 'Trần Văn An');
  const detail = page.getByLabel('product detail');
  await detail.getByRole('radio', { name: 'Trắng / M' }).click();
  await detail.getByLabel('quantity').fill('2');
  await detail.getByRole('button', { name: 'Add to cart' }).click();
  await expect(detail.getByText('Added 2 × Trắng / M to your cart.')).toBeVisible();
  await page.getByRole('link', { name: 'Cart' }).first().click();
  await expect(page.getByText('Items total:')).toContainText('258.000');
  await page.getByRole('button', { name: 'Checkout' }).click();
  const placed = page.getByLabel('order placed');
  await expect(placed.getByText('UNPAID')).toBeVisible();
  await expect(placed.getByText(/Total:/)).toContainText('283.000'); // 258.000 items + 25.000 shipping
  orderId = (await placed.getByRole('heading').innerText()).replace('Order ', '').trim();
  await placed.getByRole('button', { name: 'Pay now (fake payment)' }).click();
  await expect(placed.getByText('ON_HOLD')).toBeVisible();
  await placed.getByRole('link', { name: 'View order' }).click();
  const od = page.getByLabel('order detail');
  await expect(od.getByText('ON_HOLD').first()).toBeVisible();
  await expect(od.getByText('UNPAID → ON_HOLD')).toBeVisible();
});

test('seller sees the order; the Test Console refuses to ship an ON_HOLD order then releases it', async ({ page, request }) => {
  await page.goto('/seller');
  await signInAs(page, 'Nguyễn Thị Lan');
  await page.getByRole('link', { name: 'Orders' }).click();
  await expect(page.getByRole('cell', { name: orderId })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(orderId) }).getByText('ON_HOLD')).toBeVisible();

  await page.goto('/console');
  await page.getByRole('tab', { name: 'Orders' }).click();
  const row = page.getByRole('row', { name: new RegExp(orderId) });
  await row.getByRole('button', { name: 'AWAITING_COLLECTION' }).click();
  await expect(page.getByRole('status')).toContainText('ON_HOLD -> AWAITING_COLLECTION is not allowed');
  await expect(row.getByText('ON_HOLD')).toBeVisible(); // unchanged

  // move the business clock past the hold, then release
  await request.put('/test-admin/clock', { data: { advanceMs: 31 * 60_000 } });
  await page.getByRole('button', { name: 'Release due holds' }).click();
  await expect(page.getByRole('status')).toContainText('Released 1 held order');
  await expect(page.getByRole('row', { name: new RegExp(orderId) }).getByText('AWAITING_SHIPMENT')).toBeVisible();
  await request.put('/test-admin/clock', { data: { reset: true } });
});
