import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import type { DemoSession } from '@/lib/types';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const future = new Date(Date.now() + 3600_000).toISOString();
const sellerSession: DemoSession = { sessionToken: 'tok-s', role: 'SELLER', shopId: 'shop-1', buyerId: null, expiresAt: future };
const identities = { sellers: [{ id: 'seller_1', name: 'Seller One', shops: [{ id: 'shop-1', name: 'Demo Shop VN' }] }], buyers: [] };

function Location() {
  const l = useLocation();
  return <output data-testid="location">{l.pathname + l.search}</output>;
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Location />
    </MemoryRouter>,
  );

describe('routes', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/demo/identities' ? json(identities) : json({}))));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps the legacy topbar on legacy routes', async () => {
    renderAt('/seller');
    expect(screen.getByText('TikTok Shop Simulator')).toBeTruthy();
    expect(await screen.findByText('Choose a demo seller')).toBeTruthy();
  });

  it('renders the new shop layout without the legacy topbar', async () => {
    renderAt('/');
    expect(await screen.findByRole('region', { name: 'Best sellers' })).toBeTruthy();
    expect(screen.queryByText('TikTok Shop Simulator')).toBeNull();
    expect(screen.getByRole('search')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login?next=%2F');
  });

  it('sends a guest from a buyer-only page to /login with next', () => {
    renderAt('/cart');
    expect(screen.getByTestId('location').textContent).toBe('/login?next=%2Fcart');
  });

  it('sends a guest from Seller Center to the seller sign-in', () => {
    renderAt('/seller-center/orders');
    expect(screen.getByTestId('location').textContent).toBe('/login?next=%2Fseller-center%2Forders&role=seller');
  });

  it('shows the Seller Center menu with a seller session', async () => {
    sessionStorage.setItem('sim.demo-session.SELLER', JSON.stringify(sellerSession));
    renderAt('/seller-center/orders');
    expect(screen.getByRole('navigation', { name: 'Seller Center' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Manage orders' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('Demo Shop VN')).toBeTruthy();
  });
});
