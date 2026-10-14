import { expect, test } from '@playwright/test';
import { BUYER_A, resetAll, SELLER_A, shot, signInAs } from './helpers';

/** Phase 06 UI: Seller stock edit -> before/after history; Buyer sees sold out at 0; Test Console shows the inventory panel and fault kinds. */
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ baseURL }) => {
  await resetAll(baseURL);
});

test('seller sets a SKU stock to 0 in both warehouses and the Inventory tab shows before/after', async ({ page }) => {
  await page.goto('/seller');
  await signInAs(page, SELLER_A);
  const row = page.getByRole('row').filter({ hasText: 'BAG-NVY' });
  await expect(row).toBeVisible();
  for (const [wh, before] of [['Kho Hà Nội', '20'], ['Kho TP.HCM', '10']] as const) {
    const input = row.getByLabel(`stock BAG-NVY ${wh}`);
    await expect(input).toHaveValue(before);
    await input.fill('0');
  }
  await row.getByRole('button', { name: 'Set' }).nth(1).click(); // the second "Set" in the row is the stock one
  await expect(row.getByLabel('stock BAG-NVY Kho Hà Nội')).toHaveValue('0');

  await page.getByRole('link', { name: 'Inventory' }).click();
  await expect(page.getByRole('heading', { name: 'Stock changes (before / after)' })).toBeVisible();
  const hn = page.getByRole('row').filter({ hasText: 'BAG-NVY' }).filter({ hasText: 'Kho Hà Nội' });
  await expect(hn.getByRole('cell').nth(3)).toHaveText('20'); // before
  await expect(hn.getByRole('cell').nth(4)).toHaveText('0'); // after
  await expect(hn.getByText('SELLER', { exact: true })).toBeVisible();
  const hcm = page.getByRole('row').filter({ hasText: 'BAG-NVY' }).filter({ hasText: 'Kho TP.HCM' });
  await expect(hcm.getByRole('cell').nth(3)).toHaveText('10');
  await expect(hcm.getByRole('cell').nth(4)).toHaveText('0');
  await shot(page, 'phase06-inventory-history');
});

test('the buyer sees the sold-out SKU disabled while another variant stays selectable', async ({ page }) => {
  await page.goto('/buyer/product/sim-product-a-bag');
  await signInAs(page, BUYER_A);
  const detail = page.getByLabel('product detail');
  const sold = detail.getByRole('radio', { name: 'Xanh navy (sold out)' });
  await expect(sold).toBeDisabled();
  const ok = detail.getByRole('radio', { name: 'Màu tự nhiên' });
  await expect(ok).toBeEnabled();
  await ok.click();
  await expect(ok).toHaveAttribute('aria-checked', 'true');
  await shot(page, 'phase06-buyer-sold-out');
});

test('the Test Console shows the Inventory panel and the inventory fault kinds', async ({ page }) => {
  await page.goto('/console');
  await page.getByRole('tab', { name: 'Inventory' }).click();
  await expect(page.getByText('TIMEOUT_BEFORE_WRITE / TIMEOUT_AFTER_WRITE / APP_ERROR_200')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Update Inventory API calls' })).toBeVisible();
  await page.getByRole('tab', { name: 'Faults' }).click();
  const kind = page.getByLabel('Kind');
  for (const k of ['TIMEOUT_BEFORE_WRITE', 'TIMEOUT_AFTER_WRITE', 'APP_ERROR_200']) await expect(kind.locator(`option[value="${k}"], option:text-is("${k}")`).first()).toBeAttached();
  await shot(page, 'phase06-console-faults');
});
