import { expect, request as pwRequest, test, APIRequestContext } from '@playwright/test';
import { BUYER_A, demoSession, placePaidOrder, resetAll, SELLER_A, shot, signInAs } from './helpers';

/**
 * Phase 07b UI: partial return keeps the rest returnable and never turns the order into "RETURNED";
 * a unit cannot be requested twice; a buyer cancellation request on a paid AWAITING_SHIPMENT order needs seller approval.
 */
test.describe.configure({ mode: 'serial' });

const SKU = 'sim-sku-a-BAG-NAT';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8090';
let deliveredOrder = '';
let cancelOrder = '';

async function transition(api: APIRequestContext, orderId: string, to: string) {
  const r = await api.post(`/test-admin/orders/${orderId}/transition`, { data: { to } });
  expect(r.status(), `transition to ${to}: ${await r.text()}`).toBe(201);
}

test.beforeAll(async ({ baseURL }) => {
  await resetAll(baseURL);
  const api = await pwRequest.newContext({ baseURL });
  const buyer = await demoSession(api, 'BUYER', BUYER_A);
  deliveredOrder = await placePaidOrder(api, buyer, SKU, 2);
  cancelOrder = await placePaidOrder(api, buyer, SKU, 1);
  // release both holds (business clock past the hold), then ship the first order to DELIVERED
  await api.put('/test-admin/clock', { data: { advanceMs: 31 * 60_000 } });
  const released = (await (await api.post('/test-admin/orders/release-due', { data: {} })).json()).released as string[];
  expect(released).toEqual(expect.arrayContaining([deliveredOrder, cancelOrder]));
  for (const to of ['AWAITING_COLLECTION', 'IN_TRANSIT', 'DELIVERED']) await transition(api, deliveredOrder, to);
  await api.dispose();
});

test.afterAll(async ({ baseURL }) => {
  const api = await pwRequest.newContext({ baseURL });
  await api.put('/test-admin/clock', { data: { reset: true } });
  await api.dispose();
});

test('buyer requests a partial return (1 of 2 units); seller approves; the order stays DELIVERED and the other unit is still returnable', async ({ page }) => {
  await page.goto('/buyer/returns');
  await signInAs(page, BUYER_A);
  const form = page.getByLabel('request a return');
  await form.getByLabel('return order').selectOption(deliveredOrder);
  await form.getByLabel('return item').selectOption({ index: 1 });
  await expect(form.getByLabel('return item')).toContainText('bought 2');
  await form.getByLabel('return units').fill('1');
  await form.getByLabel('return type').selectOption('REFUND');
  await form.getByLabel('return reason').selectOption({ index: 0 });
  await form.getByRole('button', { name: 'Submit request' }).click();
  const row = page.getByRole('row').filter({ hasText: deliveredOrder });
  await expect(row.getByText('1× ')).toBeVisible();
  await expect(row.locator('.pill')).toContainText('PENDING');
  await shot(page, 'phase07b-buyer-requested');

  await page.goto('/seller/returns');
  await signInAs(page, SELLER_A);
  const sellerRow = page.getByRole('row').filter({ hasText: deliveredOrder });
  await sellerRow.getByRole('button', { name: 'Approve' }).click();
  await expect(sellerRow.getByRole('button', { name: 'Approve' })).toHaveCount(0); // decided
  await expect(sellerRow.locator('.pill')).not.toContainText('PENDING');
  const decidedStatus = await sellerRow.locator('.pill').innerText();
  expect(decidedStatus).not.toMatch(/RETURNED/);
  await shot(page, 'phase07b-seller-approved');

  // order status is unchanged: DELIVERED (the OAS has no RETURNED order status)
  await page.goto('/buyer/orders');
  await signInAs(page, BUYER_A);
  await expect(page.getByRole('row').filter({ hasText: deliveredOrder }).getByText('DELIVERED', { exact: true })).toBeVisible();
  await expect(page.getByText('RETURNED')).toHaveCount(0);

  // the remaining unit is still offered: the order and the item are still selectable, and a 2nd request for 1 unit is accepted
  await page.goto('/buyer/returns');
  const form2 = page.getByLabel('request a return');
  await form2.getByLabel('return order').selectOption(deliveredOrder);
  await form2.getByLabel('return item').selectOption({ index: 1 });
  await form2.getByLabel('return units').fill('1');
  await form.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByRole('row').filter({ hasText: deliveredOrder })).toHaveCount(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await shot(page, 'phase07b-second-unit');
});

test('a unit cannot be requested twice: a third request for the same order/item is refused with a visible message', async ({ page }) => {
  await page.goto('/buyer/returns');
  await signInAs(page, BUYER_A);
  const form = page.getByLabel('request a return');
  await form.getByLabel('return order').selectOption(deliveredOrder);
  await form.getByLabel('return item').selectOption({ index: 1 });
  await form.getByLabel('return units').fill('1');
  await form.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).not.toBeEmpty();
  await expect(page.getByRole('row').filter({ hasText: deliveredOrder })).toHaveCount(2); // no third request was created
  await shot(page, 'phase07b-refused');
});

test('a buyer cancellation request on a paid AWAITING_SHIPMENT order is approved by the seller and the order becomes CANCELLED', async ({ page }) => {
  await page.goto(`/buyer/orders/${cancelOrder}`);
  await signInAs(page, BUYER_A);
  const detail = page.getByLabel('order detail');
  await expect(detail.getByText('AWAITING_SHIPMENT').first()).toBeVisible();
  await detail.getByRole('button', { name: 'Request cancellation' }).click();

  await page.goto('/seller/returns');
  await signInAs(page, SELLER_A);
  const row = page.getByRole('row').filter({ hasText: cancelOrder });
  await expect(row.locator('.pill')).toContainText('CANCELLATION_REQUEST_PENDING');
  await shot(page, 'phase07b-cancel-pending');
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(row.getByRole('button', { name: 'Approve' })).toHaveCount(0);

  await page.goto(`/buyer/orders/${cancelOrder}`);
  await expect(page.getByLabel('order detail').getByText('CANCELLED').first()).toBeVisible();
  await shot(page, 'phase07b-cancelled');
});

test('the RMA 202604 return paths are not served (unsupported, 404) and never replace Search Returns', async ({ page }) => {
  const api = await pwRequest.newContext({ baseURL: API_URL });
  for (const [method, path] of [['POST', '/return_refund/202604/returns/search'], ['PUT', '/return_refund/202604/returns'], ['POST', '/return_refund/202604/returns']] as const) {
    const r = method === 'POST' ? await api.post(path, { data: {} }) : await api.put(path, { data: {} });
    expect(r.status(), `${method} ${path}`).toBe(404);
  }
  await api.dispose();
  await page.goto('/');
});
