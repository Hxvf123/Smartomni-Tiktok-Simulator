import { expect, request as pwRequest, test } from '@playwright/test';
import { BUYER_A, demoSession, placePaidOrder, resetAll, SELLER_A, shot, signInAs } from './helpers';

/** Phase 07a UI: an ON_HOLD order cannot be shipped; after the hold the seller ships, the buyer follows tracking, the label PDF downloads. */
test.describe.configure({ mode: 'serial' });

let orderId = '';
const SKU = 'sim-sku-a-BAG-NAT';

test.beforeAll(async ({ baseURL }) => {
  await resetAll(baseURL);
  const api = await pwRequest.newContext({ baseURL });
  const buyer = await demoSession(api, 'BUYER', BUYER_A);
  orderId = await placePaidOrder(api, buyer, SKU, 1);
  await api.dispose();
});

test('an ON_HOLD order shows "cannot ship yet" and the API refuses to arrange shipment', async ({ page, request }) => {
  await page.goto('/seller');
  await signInAs(page, SELLER_A);
  await page.getByRole('link', { name: 'Shipping' }).click();
  const row = page.getByRole('row').filter({ hasText: orderId });
  await expect(row.getByText('ON_HOLD', { exact: true })).toBeVisible();
  await expect(row.getByText('On hold: cannot ship yet')).toBeVisible();
  await expect(row.getByRole('button', { name: 'Arrange shipment' })).toHaveCount(0);
  await shot(page, 'phase07a-on-hold');

  // even bypassing the UI, the backend refuses (400 order_on_hold) and creates nothing
  const seller = await demoSession(request, 'SELLER', SELLER_A);
  const res = await request.post(`/demo/shops/${seller.shopId}/orders/${orderId}/arrange-shipment`, { headers: { 'x-demo-session': seller.token }, data: {} });
  expect(res.status()).toBe(400);
  expect(JSON.stringify(await res.json())).toContain('order_on_hold');
});

test('after the hold the seller arranges shipment and the buyer sees tracking progress', async ({ page, request }) => {
  await request.put('/test-admin/clock', { data: { advanceMs: 31 * 60_000 } });
  const released = await request.post('/test-admin/orders/release-due', { data: {} });
  expect((await released.json()).released).toContain(orderId);

  await page.goto('/seller/shipping');
  await signInAs(page, SELLER_A);
  await page.getByRole('link', { name: 'Shipping' }).click();
  const row = page.getByRole('row').filter({ hasText: orderId });
  await expect(row.getByText('AWAITING_SHIPMENT', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Arrange shipment' }).click();
  await expect(row.getByText('AWAITING_COLLECTION', { exact: true })).toBeVisible();
  await expect(row.getByRole('cell').nth(3)).toHaveText(/^SIM\d+/); // fake tracking number
  await row.getByRole('button', { name: 'Carrier collected' }).click();
  await expect(row.getByText('IN_TRANSIT', { exact: true })).toBeVisible();
  await shot(page, 'phase07a-seller-in-transit');

  await page.goto('/buyer/tracking');
  await signInAs(page, BUYER_A);
  await page.getByRole('link', { name: 'Tracking' }).click();
  const card = page.getByLabel(`tracking ${orderId}`);
  await expect(card.getByText('IN_TRANSIT', { exact: true })).toBeVisible();
  await expect(card.getByText(/tracking SIM\d+/)).toBeVisible();
  await expect(card.getByRole('listitem').first()).toBeVisible();
  const before = await card.getByRole('listitem').count();

  // seller delivers; buyer timeline grows
  await page.goto('/seller/shipping');
  await signInAs(page, SELLER_A);
  await page.getByRole('link', { name: 'Shipping' }).click();
  await page.getByRole('row').filter({ hasText: orderId }).getByRole('button', { name: 'Mark delivered' }).click();
  await expect(page.getByRole('row').filter({ hasText: orderId }).getByText('DELIVERED', { exact: true })).toBeVisible();
  await page.goto('/buyer/tracking');
  await expect(page.getByLabel(`tracking ${orderId}`).getByText('DELIVERED', { exact: true })).toBeVisible();
  // the status pill renders before the timeline items are fetched: wait for the timeline instead of reading the count once
  await expect.poll(() => page.getByLabel(`tracking ${orderId}`).getByRole('listitem').count()).toBeGreaterThan(before);
  await shot(page, 'phase07a-buyer-delivered');
  await request.put('/test-admin/clock', { data: { reset: true } });
});

test('the shipping label link downloads a PDF stamped as test data', async ({ page, request }) => {
  await page.goto('/seller/shipping');
  await signInAs(page, SELLER_A);
  await page.getByRole('link', { name: 'Shipping' }).click();
  const row = page.getByRole('row').filter({ hasText: orderId });
  await row.getByRole('button', { name: 'Shipping label' }).click();
  const link = row.getByRole('link', { name: 'Open PDF (test data)' });
  await expect(link).toBeVisible();
  const href = (await link.getAttribute('href'))!;
  expect(href).toMatch(/\.pdf$/);
  const pdf = await request.get(href);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('pdf');
  const body = await pdf.body();
  expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(body.length).toBeGreaterThan(300);
  expect(body.toString('latin1')).toContain('TEST DATA');
  await shot(page, 'phase07a-label');
});
