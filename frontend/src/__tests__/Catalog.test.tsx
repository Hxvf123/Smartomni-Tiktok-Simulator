import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BuyerStorefront } from '../components/BuyerStorefront';
import { SellerCatalog } from '../components/SellerCatalog';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const sku = (id: string, sellerSku: string, name: string, priceVnd: number) => ({
  id: `row-${id}`,
  externalId: id,
  sellerSku,
  name,
  attributeName: 'Size',
  priceVnd,
  status: 'NORMAL',
  stock: [{ warehouseId: 'w1', warehouseName: 'HN', quantity: 5 }],
  totalStock: 5,
});

describe('SellerCatalog', () => {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if ((init?.method ?? 'GET') === 'GET') {
          return json({
            warehouses: [{ externalId: 'w1', name: 'HN' }],
            items: [{ id: 'p-row', externalId: 'P1', title: 'Shoe', description: '', status: 'ACTIVATE', skus: [sku('S40', 'SHOE-40', '40', 450000), sku('S41', 'SHOE-41', '41', 460000)] }],
          });
        }
        return json({});
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('changes the price of one SKU only and refuses non-numeric prices', async () => {
    render(<SellerCatalog shopId="shop" token="tok" />);
    const input = (await screen.findByLabelText('price SHOE-40')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12.5' } });
    const row = input.closest('tr')!;
    expect((within(row).getAllByText('Set')[0] as HTMLButtonElement).disabled).toBe(true);
    expect(within(row).getByText('enter a whole VND amount')).toBeTruthy();
    fireEvent.change(input, { target: { value: '399000' } });
    fireEvent.click(within(row).getAllByText('Set')[0]);
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const patches = calls.filter((c) => c.method === 'PATCH');
    expect(patches).toHaveLength(1);
    expect(patches[0].url).toBe('/demo/shops/shop/catalog/skus/row-S40');
    expect(patches[0].body).toEqual({ priceVnd: 399000 });
  });

  it('shows an API error instead of reporting success', async () => {
    render(<SellerCatalog shopId="shop" token="tok" />);
    await screen.findByLabelText('price SHOE-40');
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_u: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'GET' ? json({ warehouses: [], items: [] }) : json({ message: 'Unknown SKU' }, 404),
    );
    fireEvent.change(screen.getByLabelText('price SHOE-40'), { target: { value: '1000' } });
    fireEvent.click(within(screen.getByLabelText('price SHOE-40').closest('tr')!).getAllByText('Set')[0]);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Unknown SKU');
  });
});

describe('BuyerStorefront', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('opens the product by marketplace id and lets the buyer pick the right SKU', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        return json({
          currency: 'VND',
          product: {
            id: 'P1',
            title: 'Shoe',
            description: 'Rubber sole',
            imageUrl: '/demo/media/products/x.svg',
            minPriceVnd: 450000,
            maxPriceVnd: 460000,
            skus: [
              { id: 'S40', name: '40', attributeName: 'Size', priceVnd: 450000, available: true, stock: 3 },
              { id: 'S41', name: '41', attributeName: 'Size', priceVnd: 460000, available: true, stock: 9 },
              { id: 'S42', name: '42', attributeName: 'Size', priceVnd: 470000, available: false, stock: 0 },
            ],
          },
        });
      }),
    );
    render(
      <MemoryRouter initialEntries={['/product/P1']}>
        <BuyerStorefront shopId="shop" token="tok" />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Rubber sole')).toBeTruthy();
    expect(urls[0]).toBe('/demo/shops/shop/storefront/products/P1');
    expect((screen.getByText('42 (sold out)') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('41'));
    expect(screen.getByText(/9 in stock/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: '41' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: '40' }).getAttribute('aria-checked')).toBe('false');
  });

  it('explains when a product link belongs to another shop', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'This product is not available' }, 404)));
    render(
      <MemoryRouter initialEntries={['/product/FOREIGN']}>
        <BuyerStorefront shopId="shop" token="tok" />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/not available in the shop you are signed in to/)).toBeTruthy();
  });
});
