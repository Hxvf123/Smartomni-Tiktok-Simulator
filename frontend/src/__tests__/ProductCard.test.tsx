import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ProductCard } from '@/components/shop/ProductCard';
import { shopPrice } from '@/lib/format';
import type { EnrichedProduct } from '@/mocks';

const product: EnrichedProduct = {
  id: '7500 1',
  title: 'Oversized cotton tee',
  description: '',
  imageUrl: '',
  minPriceVnd: 129000,
  maxPriceVnd: 135000,
  skus: [],
  originalPriceVnd: 199000,
  discountPct: 35,
  rating: 4.8,
  sold: 2400,
  trending: false,
  imageBg: '#FDE2E4',
};

describe('ProductCard', () => {
  afterEach(cleanup);

  it('shows price, discount, rating and sold count, linking to the product page', () => {
    render(<MemoryRouter><ProductCard product={product} /></MemoryRouter>);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/product/7500%201');
    expect(screen.getByText('₫129.000')).toBeTruthy();
    expect(screen.getByText('-35%')).toBeTruthy();
    expect(screen.getByText('4.8')).toBeTruthy();
    expect(screen.getByText('2.4K sold')).toBeTruthy();
  });

  it('hides the discount badge when there is none, and never shows a mock free-shipping badge', () => {
    render(<MemoryRouter><ProductCard product={{ ...product, discountPct: 0 }} /></MemoryRouter>);
    expect(screen.queryByText(/^-\d+%$/)).toBeNull();
    expect(screen.queryByText('Free shipping')).toBeNull();
  });

  it('formats prices like the boards', () => {
    expect(shopPrice(1250000)).toBe('₫1.250.000');
  });
});
