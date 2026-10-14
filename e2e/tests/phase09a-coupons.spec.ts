import { expect, Page, test } from '@playwright/test';
import { BUYER_A, resetAll, SELLER_A, shot, signInAs } from './helpers';

/** Phase 09a UI: Seller creates coupons (demo data), Buyer applies a code at checkout; bad codes show clear errors; no voucher-creation route is exposed. */
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ baseURL }) => {
  await resetAll(baseURL);
});

async function createCoupon(page: Page, title: string, code: string, valueVnd: string, minSpend = '') {
  await page.getByLabel('coupon title').fill(title);
  await page.getByLabel('coupon promo code').fill(code);
  await page.getByLabel('discount value').fill(valueVnd);
  if (minSpend) await page.getByLabel('minimum spend').fill(minSpend);
  await page.getByRole('button', { name: 'Create coupon' }).click();
  await expect(page.getByRole('row').filter({ hasText: code })).toBeVisible();
}

async function addTwoWhiteTees(page: Page) {
  await page.goto('/buyer/product/sim-product-a-tee');
  await signInAs(page, BUYER_A);
  const detail = page.getByLabel('product detail');
  await detail.getByRole('radio', { name: 'Trắng / M' }).click();
  await detail.getByLabel('quantity').fill('2');
  await detail.getByRole('button', { name: 'Add to cart' }).click();
  await expect(detail.getByText('Added 2 × Trắng / M to your cart.')).toBeVisible();
  await page.getByRole('link', { name: 'Cart' }).first().click();
  await expect(page.getByText('Items total:')).toContainText('258.000');
}

test('seller creates coupons; the buyer applies one at checkout and the order total reflects the discount', async ({ page }) => {
  await page.goto('/seller/coupons');
  await signInAs(page, SELLER_A);
  await page.getByRole('link', { name: 'Coupons' }).click();
  await createCoupon(page, 'E2E 50k off', 'E2EOFF50', '50000');
  await createCoupon(page, 'E2E big spender', 'E2EMIN1M', '10000', '1000000');
  await createCoupon(page, 'E2E to deactivate', 'E2EOLD99', '5000');
  await expect(page.getByRole('row').filter({ hasText: 'E2EOFF50' }).getByText('ONGOING')).toBeVisible();
  await page.getByRole('row').filter({ hasText: 'E2EOLD99' }).getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'E2EOLD99' }).getByText('DEACTIVATED')).toBeVisible();
  await shot(page, 'phase09a-seller-coupons');

  await addTwoWhiteTees(page);
  await page.getByLabel('coupon code').fill('e2eoff50'); // the input upper-cases
  await expect(page.getByLabel('coupon code')).toHaveValue('E2EOFF50');
  await page.getByRole('button', { name: 'Checkout' }).click();
  const placed = page.getByLabel('order placed');
  await expect(placed.getByText('UNPAID')).toBeVisible();
  // 2 x 129.000 = 258.000 - 50.000 coupon = 208.000 items; + 25.000 shipping = 233.000
  await expect(placed.getByText(/Total:/)).toContainText('233.000');
  await expect(placed.getByText(/items .*208\.000/)).toBeVisible();
  await shot(page, 'phase09a-buyer-discounted');
  await placed.getByRole('button', { name: 'Pay now (fake payment)' }).click();
  await expect(placed.getByText('ON_HOLD')).toBeVisible();
});

test('unknown, deactivated and under-minimum coupons are refused with a visible error and no order is created', async ({ page }) => {
  await addTwoWhiteTees(page);
  for (const code of ['NOPE1234', 'E2EOLD99', 'E2EMIN1M']) {
    await page.getByLabel('coupon code').fill(code);
    await page.getByRole('button', { name: 'Checkout' }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).not.toBeEmpty();
    await expect(page.getByLabel('order placed')).toHaveCount(0);
    await shot(page, `phase09a-error-${code}`);
  }
  // the cart is untouched, so a valid retry without a code still works
  await page.getByLabel('coupon code').fill('');
  await expect(page.getByText('Items total:')).toContainText('258.000');
});

test('no voucher-creation operation is exposed: the router answers 404 and the UI says coupons are demo data', async ({ page, request }) => {
  for (const [method, path] of [['POST', '/promotion/202406/coupons'], ['POST', '/promotion/202406/coupons/create'], ['PUT', '/promotion/202406/coupons/1']] as const) {
    // the TikTok router lives on the API port (the UI proxy only forwards /demo, /test-admin, /health)
    const res = await request.fetch(`${process.env.E2E_API_URL ?? 'http://localhost:8090'}${path}`, { method, data: { title: 'x' } });
    expect(res.status(), `${method} ${path}`).toBe(404);
  }
  await page.goto('/seller/coupons');
  await signInAs(page, SELLER_A);
  await page.getByRole('link', { name: 'Coupons' }).click();
  await expect(page.getByText('Coupons are Seller-created demo data.')).toBeVisible();
  await expect(page.locator('main').getByText(/TikTok|OpenAPI/i)).toHaveCount(0);
});
