import { expect, test } from '@playwright/test';
import { BUYER_A, resetAll, SELLER_A, shot, signInAs } from './helpers';

/** Phase 08 UI: buyer writes -> seller sees and replies -> buyer sees the reply; unsupported message types are stated explicitly. */
test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString(36);
const buyerText = `Shop oi, don cua minh khi nao giao? [${stamp}]`;
const sellerText = `Da nhan yeu cau, shop se gui hang som [${stamp}]`;

test.beforeAll(async ({ baseURL }) => {
  await resetAll(baseURL);
});

test('the chat page states which message types are supported and which are not simulated', async ({ page }) => {
  await page.goto('/buyer/chat');
  await signInAs(page, BUYER_A);
  const note = page.getByRole('note');
  await expect(note).toContainText('Supported message types: TEXT');
  await expect(note).toContainText('Not simulated:');
  await shot(page, 'phase08-supported-types');
});

test('buyer sends a message, seller sees it and replies, buyer sees the reply', async ({ browser }) => {
  const buyerCtx = await browser.newContext();
  const sellerCtx = await browser.newContext();
  const buyer = await buyerCtx.newPage();
  const seller = await sellerCtx.newPage();
  try {
    await buyer.goto('/buyer/chat');
    await signInAs(buyer, BUYER_A);
    const thread = buyer.getByLabel('chat thread');
    await thread.getByLabel('message', { exact: true }).fill(buyerText);
    await thread.getByRole('button', { name: 'Send' }).click();
    await expect(thread.getByRole('list', { name: 'messages' }).getByText(buyerText)).toBeVisible();

    await seller.goto('/seller/chat');
    await signInAs(seller, SELLER_A);
    await seller.getByLabel('conversations').getByRole('button', { name: new RegExp(BUYER_A) }).click();
    const sthread = seller.getByLabel('chat thread');
    await expect(sthread.getByText(buyerText)).toBeVisible();
    await sthread.getByLabel('message', { exact: true }).fill(sellerText);
    await sthread.getByRole('button', { name: 'Send' }).click();
    await expect(sthread.getByText(sellerText)).toBeVisible();
    await shot(seller, 'phase08-seller-thread');

    // the buyer view polls every 3 s
    await expect(thread.getByText(sellerText)).toBeVisible({ timeout: 15_000 });
    const items = await thread.getByRole('list', { name: 'messages' }).getByRole('listitem').allInnerTexts();
    const iBuyer = items.findIndex((t) => t.includes(buyerText));
    const iSeller = items.findIndex((t) => t.includes(sellerText));
    expect(iBuyer).toBeGreaterThanOrEqual(0);
    expect(iSeller).toBeGreaterThan(iBuyer); // order preserved
    await shot(buyer, 'phase08-buyer-thread');
  } finally {
    await buyerCtx.close();
    await sellerCtx.close();
  }
});

test('an empty message cannot be sent and the seller sees only its own shop conversations', async ({ page }) => {
  await page.goto('/seller/chat');
  await signInAs(page, SELLER_A);
  const list = page.getByLabel('conversations');
  await expect(list.getByRole('button', { name: new RegExp(BUYER_A) })).toBeVisible();
  await expect(list.getByText('Hoàng Đức Long')).toHaveCount(0); // a buyer of the other shop
  await list.getByRole('button', { name: new RegExp(BUYER_A) }).click();
  const thread = page.getByLabel('chat thread');
  await thread.getByLabel('message', { exact: true }).fill('   ');
  await expect(thread.getByRole('button', { name: 'Send' })).toBeDisabled();
});
