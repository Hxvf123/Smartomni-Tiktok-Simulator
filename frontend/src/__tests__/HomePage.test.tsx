import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/lib/auth';
import type { DemoSession, StorefrontProduct } from '@/lib/types';
import { mockCatalog } from '@/mocks';
import { HomePage } from '@/pages/shop/HomePage';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const future = new Date(Date.now() + 3600_000).toISOString();
const buyer: DemoSession = { sessionToken: 'tok-b', role: 'BUYER', shopId: 'shop-1', buyerId: 'buyer_1', expiresAt: future };

const real = (id: string, title: string): StorefrontProduct => ({
  id,
  title,
  description: '',
  imageUrl: `/demo/media/products/${id}.svg`,
  minPriceVnd: 100000,
  maxPriceVnd: 100000,
  skus: [{ id: `${id}-s`, name: 'M', attributeName: 'Size', priceVnd: 100000, available: true, stock: 5 }],
});
const storefront = [real('750001', 'Bình giữ nhiệt 500ml'), ...Array.from({ length: 11 }, (_, i) => real(`7501${i}`, `Real item ${i + 1}`))];

const renderHome = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

const region = (name: string) => screen.getByRole('region', { name });

describe('HomePage', () => {
  const urls: { url: string; headers: Record<string, string> }[] = [];
  beforeEach(() => {
    urls.length = 0;
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        urls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
        return json({ currency: 'VND', items: storefront });
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the mock catalog to guests in both sections without calling the API', async () => {
    renderHome();
    expect(await screen.findByRole('region', { name: 'Deals on 4★+ products for you' })).toBeTruthy();
    expect(within(region('Best sellers')).getAllByRole('link')).toHaveLength(mockCatalog.length);
    // best sellers are ordered by sold count
    const top = [...mockCatalog].sort((a, b) => b.sold - a.sold)[0];
    expect(within(region('Best sellers')).getAllByRole('link')[0].textContent).toContain(top.title);
    // deals only list discounted products
    const discounted = mockCatalog.filter((p) => p.discountPct > 0).length;
    expect(within(region('Deals on 4★+ products for you')).getAllByRole('link')).toHaveLength(discounted);
    expect(urls).toEqual([]);
  });

  it('loads the storefront for a signed-in buyer and enriches it, with See more paging', async () => {
    sessionStorage.setItem('sim.demo-session.BUYER', JSON.stringify(buyer));
    renderHome();
    await screen.findByRole('region', { name: 'Best sellers' });
    expect(urls).toEqual([{ url: '/demo/shops/shop-1/storefront/products', headers: { 'x-demo-session': 'tok-b' } }]);
    expect(within(region('Best sellers')).getAllByRole('link')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'See more' }));
    expect(within(region('Best sellers')).getAllByRole('link')).toHaveLength(12);
    // the seeded title gets its mock sold count (1300 -> "1.3K sold")
    const bottle = within(region('Best sellers')).getByRole('link', { name: /Bình giữ nhiệt 500ml/ });
    expect(bottle.textContent).toContain('1.3K sold');
    expect(screen.queryByRole('button', { name: 'See more' })).toBeNull();
  });

  it('filters by name for ?q=, ignoring case and diacritics', async () => {
    sessionStorage.setItem('sim.demo-session.BUYER', JSON.stringify(buyer));
    renderHome('/?q=BINH');
    const results = await screen.findByRole('region', { name: 'Results for “BINH” (1)' });
    expect(within(results).getByRole('link').textContent).toContain('Bình giữ nhiệt 500ml');
  });

  it('offers to clear a search with no results', async () => {
    renderHome('/?q=zzz');
    expect(await screen.findByText('No products match “zzz”.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Clear search' }).getAttribute('href')).toBe('/');
  });
});
